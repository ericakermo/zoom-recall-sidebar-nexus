
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface ZoomMeeting {
  id: string;
  meeting_id: string;
  title: string;
  start_time: string;
  duration: number;
  user_id: string;
  join_url: string;
  created_at: string;
  updated_at: string;
}

const Meeting = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meetingData, setMeetingData] = useState<ZoomMeeting | null>(null);
  const { toast } = useToast();
  const clientRef = useRef<any>(null);
  const meetingContainerRef = useRef<HTMLDivElement>(null);

  const getMeetingPassword = async (meetingId: string, isHost: boolean) => {
    console.log('🔄 Attempting to get meeting password...', { meetingId, isHost });
    
    try {
      // First, try to get password from Zoom API if user is host
      if (isHost) {
        console.log('🔄 Host detected, fetching meeting details from Zoom API...');
        const { data: tokenData } = await supabase.functions.invoke('get-zoom-token', {
          body: { 
            meetingNumber: meetingId,
            role: 1 // Host role
          }
        });

        // Get meeting details from Zoom API
        const meetingResponse = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
          headers: {
            'Authorization': `Bearer ${tokenData.accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (meetingResponse.ok) {
          const meetingDetails = await meetingResponse.json();
          console.log('✅ Meeting details from Zoom API:', {
            hasPassword: !!meetingDetails.password,
            waitingRoom: meetingDetails.settings?.waiting_room,
            joinBeforeHost: meetingDetails.settings?.join_before_host
          });
          return meetingDetails.password || '';
        }
      }

      // Fallback: return empty password
      console.log('ℹ️ No password found, using empty string');
      return '';
    } catch (error) {
      console.error('⚠️ Error getting meeting password:', error);
      return '';
    }
  };

  const handleJoinError = (error: any, meetingId: string, isHost: boolean) => {
    console.error('❌ Meeting join error details:', {
      error,
      errorCode: error.errorCode,
      reason: error.reason,
      type: error.type,
      meetingId,
      isHost
    });

    let errorMessage = 'Failed to join meeting';
    let suggestion = '';

    switch (error.errorCode) {
      case 3004:
        errorMessage = 'Meeting password is required or incorrect';
        suggestion = isHost 
          ? 'As the host, try creating a new meeting without a password'
          : 'Please contact the meeting host for the correct password';
        break;
      case 3001:
        errorMessage = 'Meeting not found or has ended';
        suggestion = 'Please check the meeting ID and try again';
        break;
      case 3002:
        errorMessage = 'Meeting has not started yet';
        suggestion = 'Please wait for the host to start the meeting';
        break;
      case 3003:
        errorMessage = 'Meeting has ended';
        suggestion = 'This meeting is no longer active';
        break;
      case 3005:
        errorMessage = 'Meeting is locked by host';
        suggestion = 'Please contact the host to unlock the meeting';
        break;
      default:
        errorMessage = error.reason || error.message || 'Unknown error occurred';
        suggestion = 'Please try again or contact support';
    }

    setError(`${errorMessage}. ${suggestion}`);
    toast({
      title: "Meeting Join Failed",
      description: `${errorMessage}. ${suggestion}`,
      variant: "destructive",
    });
  };

  useEffect(() => {
    const initializeMeeting = async () => {
      console.log('🎯 Initializing Zoom meeting component...');
      try {
        setIsLoading(true);
        setError(null);

        if (!user) {
          console.error('❌ User not authenticated');
          throw new Error('User not authenticated');
        }
        console.log('✅ User authenticated:', user.email);

        // Get meeting details from Supabase
        console.log('🔄 Fetching meeting details from database...');
        const { data: meeting, error: meetingError } = await supabase
          .from('zoom_meetings')
          .select('*')
          .eq('id', id)
          .single();

        if (meetingError) {
          console.error('❌ Error fetching meeting:', meetingError);
          throw meetingError;
        }
        if (!meeting) {
          console.error('❌ Meeting not found');
          throw new Error('Meeting not found');
        }
        console.log('✅ Meeting details retrieved:', {
          meetingId: meeting.id,
          zoomMeetingId: meeting.meeting_id,
          title: meeting.title,
          startTime: meeting.start_time,
          duration: meeting.duration
        });

        setMeetingData(meeting);

        // Determine if user is host
        const isHost = meeting.user_id === user.id;
        console.log(`ℹ️ User role: ${isHost ? 'Host' : 'Participant'}`);

        // Get meeting password
        console.log('🔄 Getting meeting password...');
        const meetingPassword = await getMeetingPassword(meeting.meeting_id, isHost);
        console.log('✅ Meeting password retrieved:', { hasPassword: !!meetingPassword });

        // Get Zoom token and signature
        console.log('🔄 Requesting Zoom token and signature...');
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
          body: { 
            meetingNumber: meeting.meeting_id,
            role: isHost ? 1 : 0,
            expirationSeconds: 7200 // 2 hours
          }
        });

        if (tokenError) {
          console.error('❌ Error getting Zoom token:', tokenError);
          throw tokenError;
        }
        console.log('✅ Zoom token and signature received');

        // Get ZAK token if user is the host
        let zakToken = null;
        if (isHost) {
          console.log('🔄 User is host, requesting ZAK token...');
          const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
          if (!zakError && zakData) {
            zakToken = zakData.zak;
            console.log('✅ ZAK token received');
          } else {
            console.warn('⚠️ Could not get ZAK token, continuing without it');
          }
        }

        // Initialize Zoom client
        console.log('🔄 Initializing Zoom client...');
        const client = ZoomMtgEmbedded.createClient();
        clientRef.current = client;

        // Initialize the client
        console.log('🔄 Setting up Zoom client configuration...');
        await client.init({
          zoomAppRoot: meetingContainerRef.current,
          language: 'en-US',
          customize: {
            meetingInfo: ['topic', 'host', 'mn', 'pwd', 'invite', 'participant', 'dc'],
            toolbar: {
              buttons: [
                {
                  text: 'Leave Meeting',
                  className: 'CustomLeaveButton',
                  onClick: () => {
                    console.log('🔘 Leave meeting button clicked');
                    if (clientRef.current) {
                      clientRef.current.leave();
                    }
                    navigate('/calendar');
                  }
                }
              ]
            }
          }
        });
        console.log('✅ Zoom client initialized');

        // Prepare join configuration
        const joinConfig: any = {
          sdkKey: tokenData.sdkKey,
          signature: tokenData.signature,
          meetingNumber: meeting.meeting_id,
          password: meetingPassword, // Use the retrieved password
          userName: user.email || 'Anonymous',
          userEmail: user.email,
          success: (success: any) => {
            console.log('✅ Successfully joined meeting:', success);
            setIsLoading(false);
            toast({
              title: "Success",
              description: "Successfully joined the meeting",
            });
          },
          error: (error: any) => {
            console.error('❌ Error joining meeting:', error);
            handleJoinError(error, meeting.meeting_id, isHost);
            setIsLoading(false);
          }
        };

        // Add ZAK token for hosts
        if (isHost && zakToken) {
          joinConfig.zak = zakToken;
          console.log('✅ ZAK token added to join configuration');
        }

        // Join the meeting
        console.log('🔄 Joining Zoom meeting with configuration:', {
          meetingNumber: joinConfig.meetingNumber,
          hasPassword: !!joinConfig.password,
          hasZak: !!joinConfig.zak,
          role: isHost ? 'Host' : 'Participant'
        });

        await client.join(joinConfig);

      } catch (err: any) {
        console.error('❌ Meeting initialization error:', err);
        setError(err.message || 'Failed to initialize meeting');
        setIsLoading(false);
        toast({
          title: "Error",
          description: err.message || 'Failed to join meeting',
          variant: "destructive",
        });
      }
    };

    if (id && user) {
      initializeMeeting();
    }

    // Cleanup function
    return () => {
      if (clientRef.current) {
        try {
          console.log('🧹 Cleaning up meeting resources...');
          clientRef.current.leave();
          console.log('✅ Meeting cleanup complete');
        } catch (error) {
          console.error('❌ Error during meeting cleanup:', error);
        }
      }
    };
  }, [id, user, toast, navigate]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg mb-4">Please log in to join the meeting</p>
          <Button onClick={() => navigate('/auth')}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/calendar')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Calendar
          </Button>
        </div>
        {meetingData && (
          <div className="text-center">
            <h1 className="text-lg font-semibold">{meetingData.title}</h1>
            <p className="text-sm text-gray-600">Meeting ID: {meetingData.meeting_id}</p>
          </div>
        )}
        <div></div> {/* Spacer for flex layout */}
      </div>

      {/* Meeting Content */}
      <div className="flex-1 relative p-4">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Initializing meeting...</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
            <div className="text-center max-w-md mx-auto p-6">
              <p className="text-destructive mb-4 text-sm leading-relaxed">{error}</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => window.location.reload()}>
                  Retry
                </Button>
                <Button variant="outline" onClick={() => navigate('/calendar')}>
                  Go Back
                </Button>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex justify-center items-center h-full">
          <div 
            ref={meetingContainerRef} 
            id="meetingSDKElement"
            className="w-full max-w-4xl h-full min-h-[500px] border rounded-lg"
          />
        </div>
      </div>
    </div>
  );
};

export default Meeting;

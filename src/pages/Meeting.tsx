
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const Meeting = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meetingData, setMeetingData] = useState<any>(null);
  const { toast } = useToast();
  const clientRef = useRef<any>(null);
  const meetingContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initializeMeeting = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (!user) {
          throw new Error('User not authenticated');
        }

        // Get meeting details from Supabase
        const { data: meeting, error: meetingError } = await supabase
          .from('zoom_meetings')
          .select('*')
          .eq('id', id)
          .single();

        if (meetingError) throw meetingError;
        if (!meeting) throw new Error('Meeting not found');

        setMeetingData(meeting);

        // Determine if user is host
        const isHost = meeting.user_id === user.id;

        // Get Zoom token and signature
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
          body: { 
            meetingNumber: meeting.meeting_id,
            role: isHost ? 1 : 0, // 1 for host, 0 for participant
            expirationSeconds: 7200 // 2 hours
          }
        });

        if (tokenError) throw tokenError;

        // Get ZAK token if user is the host
        let zakToken = null;
        if (isHost) {
          const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
          if (!zakError && zakData) {
            zakToken = zakData.zak;
          }
        }

        // Initialize Zoom client
        const client = ZoomMtgEmbedded.createClient();
        clientRef.current = client;

        // Initialize the client
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

        // Join the meeting
        await client.join({
          sdkKey: tokenData.sdkKey,
          signature: tokenData.signature,
          meetingNumber: meeting.meeting_id,
          password: meeting.password || '',
          userName: user.email || 'Anonymous',
          userEmail: user.email,
          zak: zakToken,
          success: (success: any) => {
            console.log('Join meeting success:', success);
            setIsLoading(false);
            toast({
              title: "Success",
              description: "Successfully joined the meeting",
            });
          },
          error: (error: any) => {
            console.error('Join meeting error:', error);
            setError(error.message || 'Failed to join meeting');
            setIsLoading(false);
          }
        });

      } catch (err: any) {
        console.error('Meeting initialization error:', err);
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
          clientRef.current.leave();
        } catch (error) {
          console.error('Error leaving meeting:', error);
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
            <div className="text-center">
              <p className="text-destructive mb-4">{error}</p>
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

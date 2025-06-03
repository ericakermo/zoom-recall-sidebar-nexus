
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ZoomMeeting } from '@/components/ZoomMeeting';
import { MeetingExitDialog } from '@/components/MeetingExitDialog';
import { useMeetingExit } from '@/hooks/useMeetingExit';

interface ZoomMeetingData {
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
  const [meetingData, setMeetingData] = useState<ZoomMeetingData | null>(null);
  const [meetingPassword, setMeetingPassword] = useState<string>('');
  const [zoomClient, setZoomClient] = useState<any>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const { toast } = useToast();

  const { leaveMeeting, checkMeetingStatus } = useMeetingExit({
    zoomClient,
    isJoined,
    onConfirmExit: () => {
      console.log('✅ [MEETING] User confirmed exit');
    },
    onCancelExit: () => {
      console.log('🚫 [MEETING] User cancelled exit');
    }
  });

  const handleConfirmExit = useCallback(async () => {
    await leaveMeeting();
    setIsJoined(false);
    setShowExitDialog(false);
    navigate('/calendar');
  }, [leaveMeeting, navigate]);

  const handleCancelExit = useCallback(() => {
    setShowExitDialog(false);
  }, []);

  const handleBackToCalendar = useCallback(() => {
    if (checkMeetingStatus()) {
      setShowExitDialog(true);
    } else {
      navigate('/calendar');
    }
  }, [checkMeetingStatus, navigate]);

  useEffect(() => {
    const loadMeetingData = async () => {
      if (!user || !id) {
        setError('User not authenticated or meeting ID missing');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        console.log('🔄 [MEETING] Loading meeting data for ID:', id);

        // Get meeting details from database
        const { data: meeting, error: meetingError } = await supabase
          .from('zoom_meetings')
          .select('*')
          .eq('id', id)
          .single();

        if (meetingError || !meeting) {
          throw new Error('Meeting not found');
        }

        setMeetingData(meeting);
        console.log('✅ [MEETING] Meeting data loaded:', meeting);

        // Get meeting password
        try {
          const { data: meetingDetails, error: detailsError } = await supabase.functions.invoke('get-meeting-details', {
            body: { meetingId: meeting.meeting_id }
          });

          if (!detailsError && meetingDetails?.password) {
            setMeetingPassword(meetingDetails.password);
            console.log('✅ [MEETING] Meeting password retrieved');
          }
        } catch (passwordError) {
          console.warn('⚠️ [MEETING] Could not get meeting password:', passwordError);
          // Continue without password - not critical
        }

        setIsLoading(false);
        console.log('✅ [MEETING] Meeting page ready');

      } catch (err: any) {
        console.error('❌ [MEETING] Error loading meeting:', err);
        setError(err.message || 'Failed to load meeting');
        setIsLoading(false);
      }
    };

    loadMeetingData();
  }, [id, user]);

  const handleMeetingEnd = useCallback(async () => {
    console.log('🔄 [MEETING] Meeting ended');
    await leaveMeeting();
    setIsJoined(false);
    navigate('/calendar');
  }, [leaveMeeting, navigate]);

  const handleMeetingJoined = useCallback((client: any) => {
    console.log('✅ [MEETING] Meeting joined successfully');
    setZoomClient(client);
    setIsJoined(true);
  }, []);

  const handleMeetingError = useCallback((error: string) => {
    console.error('❌ [MEETING] Meeting error:', error);
    toast({
      title: "Meeting Error",
      description: error,
      variant: "destructive",
      duration: 5000
    });
  }, [toast]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <p className="text-lg mb-4">Please log in to join the meeting</p>
          <Button onClick={() => navigate('/auth')}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">Loading meeting...</p>
          <p className="text-sm text-gray-500 mt-2">Meeting ID: {id}</p>
        </div>
      </div>
    );
  }

  if (error || !meetingData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg text-red-600 mb-4">{error || 'Meeting not found'}</p>
          <div className="space-y-2">
            <Button onClick={() => navigate('/calendar')} className="w-full">
              Back to Calendar
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()} className="w-full">
              Reload Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isHost = meetingData.user_id === user.id;

  return (
    <>
      <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBackToCalendar}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Calendar
            </Button>
          </div>
          
          <div className="text-center">
            <h1 className="text-lg font-semibold">{meetingData.title}</h1>
            <p className="text-sm text-gray-600">
              Meeting ID: {meetingData.meeting_id} | Role: {isHost ? 'Host' : 'Attendee'}
            </p>
          </div>
          
          <div className="w-32"></div> {/* Spacer for centering */}
        </div>

        {/* Meeting Content */}
        <div className="flex-1 bg-gray-50">
          <ZoomMeeting
            meetingNumber={meetingData.meeting_id}
            meetingPassword={meetingPassword}
            userName={user.email || 'Guest'}
            role={isHost ? 1 : 0}
            onMeetingEnd={handleMeetingEnd}
            onMeetingJoined={handleMeetingJoined}
          />
        </div>
      </div>

      <MeetingExitDialog
        isOpen={showExitDialog}
        onConfirm={handleConfirmExit}
        onCancel={handleCancelExit}
        meetingId={meetingData.meeting_id}
      />
    </>
  );
};

export default Meeting;


import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ZoomMeeting } from '@/components/ZoomMeeting';

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
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadMeetingData = async () => {
      if (!user || !id) return;

      try {
        setIsLoading(true);
        setError(null);

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

        // Get meeting password
        const { data: meetingDetails, error: detailsError } = await supabase.functions.invoke('get-meeting-details', {
          body: { meetingId: meeting.meeting_id }
        });

        if (!detailsError && meetingDetails?.password) {
          setMeetingPassword(meetingDetails.password);
        }

        // Only set loading to false and activate meeting after all data is ready
        setIsLoading(false);
        setIsMeetingActive(true);
      } catch (err: any) {
        console.error('Error loading meeting:', err);
        setError(err.message || 'Failed to load meeting');
        setIsLoading(false);
      }
    };

    loadMeetingData();
  }, [id, user]);

  const handleMeetingEnd = () => {
    setIsMeetingActive(false);
    navigate('/calendar');
  };

  // Memoize meeting props to prevent unnecessary re-renders
  const meetingProps = useMemo(() => {
    if (!meetingData || !isMeetingActive) return null;
    
    const isHost = meetingData.user_id === user?.id;
    
    return {
      meetingNumber: meetingData.meeting_id,
      meetingPassword: meetingPassword,
      userName: user?.email || 'Guest',
      role: isHost ? 1 : 0,
      onMeetingEnd: handleMeetingEnd
    };
  }, [meetingData, meetingPassword, user?.email, user?.id, isMeetingActive]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">Loading meeting...</p>
        </div>
      </div>
    );
  }

  if (error || !meetingData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <p className="text-lg text-red-600 mb-4">{error || 'Meeting not found'}</p>
          <Button onClick={() => navigate('/calendar')}>
            Back to Calendar
          </Button>
        </div>
      </div>
    );
  }

  // Only render the meeting component when all conditions are met
  if (!meetingProps) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">Preparing meeting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/calendar')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Calendar
          </Button>
        </div>
        
        <div className="text-center">
          <h1 className="text-lg font-semibold">{meetingData.title}</h1>
          <p className="text-sm text-gray-600">Meeting ID: {meetingData.meeting_id}</p>
        </div>
        
        <div className="w-32"></div> {/* Spacer for centering */}
      </div>

      {/* Meeting Content - Fixed container */}
      <div className="flex-1 bg-gray-50" style={{ minHeight: '600px' }}>
        <ZoomMeeting
          key={`meeting-${meetingData.id}-${isMeetingActive}`}
          meetingNumber={meetingProps.meetingNumber}
          meetingPassword={meetingProps.meetingPassword}
          userName={meetingProps.userName}
          role={meetingProps.role}
          onMeetingEnd={meetingProps.onMeetingEnd}
        />
      </div>
    </div>
  );
};

export default Meeting;

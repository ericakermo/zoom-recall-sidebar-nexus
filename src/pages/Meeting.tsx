
import React, { useEffect, useState } from 'react';
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
  const { toast } = useToast();

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
        
        console.log('🔍 Loading meeting data for ID:', id);

        // Get meeting details from database with proper error handling
        const { data: meeting, error: meetingError } = await supabase
          .from('zoom_meetings')
          .select('*')
          .eq('id', id)
          .maybeSingle(); // Use maybeSingle instead of single to handle no results

        console.log('📋 Meeting query result:', { meeting, meetingError });

        if (meetingError) {
          console.error('❌ Database error:', meetingError);
          throw new Error(`Database error: ${meetingError.message}`);
        }

        if (!meeting) {
          console.error('❌ Meeting not found in database');
          throw new Error('Meeting not found. It may have been deleted or you may not have access to it.');
        }

        console.log('✅ Meeting found:', meeting.title, meeting.meeting_id);
        setMeetingData(meeting);

        // Get meeting password with error handling
        try {
          const { data: meetingDetails, error: detailsError } = await supabase.functions.invoke('get-meeting-details', {
            body: { meetingId: meeting.meeting_id }
          });

          if (!detailsError && meetingDetails?.password) {
            setMeetingPassword(meetingDetails.password);
            console.log('✅ Meeting password retrieved');
          } else {
            console.log('⚠️ No password found for meeting, proceeding without');
          }
        } catch (passwordError) {
          console.warn('⚠️ Failed to get meeting password, proceeding without:', passwordError);
          // Don't fail the entire flow if password retrieval fails
        }

        setIsLoading(false);
      } catch (err: any) {
        console.error('❌ Error loading meeting:', err);
        setError(err.message || 'Failed to load meeting');
        setIsLoading(false);
        
        // Show toast for better user feedback
        toast({
          title: "Meeting Load Error",
          description: err.message || 'Failed to load meeting',
          variant: "destructive"
        });
      }
    };

    loadMeetingData();
  }, [id, user, toast]);

  const handleMeetingEnd = () => {
    console.log('🔄 Meeting ended, navigating back to calendar');
    navigate('/calendar');
  };

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
          <p className="text-sm text-gray-600 mt-2">Meeting ID: {id}</p>
        </div>
      </div>
    );
  }

  if (error || !meetingData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md mx-auto p-6">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Meeting Not Found</h2>
          <p className="text-gray-600 mb-4">{error || 'The requested meeting could not be found.'}</p>
          <div className="text-sm text-gray-500 mb-6">
            <p>Meeting ID: {id}</p>
            <p className="mt-2">This could happen if:</p>
            <ul className="list-disc list-inside text-left mt-1">
              <li>The meeting was deleted</li>
              <li>You don't have access to this meeting</li>
              <li>The meeting ID is incorrect</li>
            </ul>
          </div>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/calendar')}>
              Back to Calendar
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline">
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isHost = meetingData.user_id === user.id;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
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
          <p className="text-xs text-gray-500">Role: {isHost ? 'Host' : 'Participant'}</p>
        </div>
        
        <div className="w-32"></div> {/* Spacer for centering */}
      </div>

      {/* Meeting Content */}
      <div className="flex-1 p-4 bg-gray-50">
        <ZoomMeeting
          meetingNumber={meetingData.meeting_id}
          meetingPassword={meetingPassword}
          userName={user.email || 'Guest'}
          role={isHost ? 1 : 0}
          onMeetingEnd={handleMeetingEnd}
        />
      </div>
    </div>
  );
};

export default Meeting;

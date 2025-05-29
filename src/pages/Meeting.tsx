
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Video, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ZoomMeetingContainer } from '@/components/ZoomMeetingContainer';

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
  const [isConnected, setIsConnected] = useState(false);
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

        setIsLoading(false);
      } catch (err: any) {
        console.error('Error loading meeting:', err);
        setError(err.message || 'Failed to load meeting');
        setIsLoading(false);
      }
    };

    loadMeetingData();
  }, [id, user]);

  const handleMeetingJoined = () => {
    setIsConnected(true);
    toast({
      title: "Connected",
      description: "You have joined the meeting"
    });
  };

  const handleMeetingError = (errorMessage: string) => {
    toast({
      title: "Meeting Error",
      description: errorMessage,
      variant: "destructive"
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">Loading meeting...</p>
        </div>
      </div>
    );
  }

  if (error || !meetingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <p className="text-lg text-red-600 mb-4">{error || 'Meeting not found'}</p>
          <Button onClick={() => navigate('/calendar')}>
            Back to Calendar
          </Button>
        </div>
      </div>
    );
  }

  const isHost = meetingData.user_id === user.id;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/calendar')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Calendar</span>
            </Button>
          </div>
          
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900">{meetingData.title}</h1>
            <p className="text-sm text-gray-600">Meeting ID: {meetingData.meeting_id}</p>
          </div>
          
          <div className="flex items-center space-x-3">
            {isConnected && (
              <div className="flex items-center space-x-2 text-green-600">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Connected</span>
              </div>
            )}
            <div className="flex items-center space-x-1 text-gray-500">
              <Users className="h-4 w-4" />
              <span className="text-sm">{isHost ? 'Host' : 'Participant'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Meeting Info Bar */}
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Video className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Zoom Meeting</span>
              </div>
              <div className="text-sm text-gray-600">
                {new Date(meetingData.start_time).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Zoom Meeting Container */}
          <div className="h-[600px] p-4">
            <ZoomMeetingContainer
              meetingNumber={meetingData.meeting_id}
              meetingPassword={meetingPassword}
              userName={user.email || 'Guest'}
              role={isHost ? 1 : 0}
              onJoinSuccess={handleMeetingJoined}
              onError={handleMeetingError}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Meeting;

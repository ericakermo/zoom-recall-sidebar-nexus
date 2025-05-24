
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ZoomComponentMeeting } from './ZoomComponentMeeting';

interface ZoomMeetingProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingEnd?: () => void;
  zak?: string; // Add ZAK token property
}

export function ZoomMeeting({
  meetingNumber,
  meetingPassword,
  userName,
  role = 0,
  onMeetingEnd,
  zak
}: ZoomMeetingProps) {
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleMeetingJoined = () => {
    setIsConnected(true);
    console.log('Meeting joined successfully');
  };

  const handleMeetingError = (errorMessage: string) => {
    setError(errorMessage);
    setIsConnected(false);
    console.error('Meeting error:', errorMessage);
  };

  const handleLeaveMeeting = () => {
    setIsConnected(false);
    onMeetingEnd?.();
    toast({
      title: "Meeting Ended",
      description: "You have left the meeting"
    });
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
        <p className="text-red-500 mb-4 text-center">{error}</p>
        <div className="text-sm text-gray-500 mb-6 max-w-md text-center">
          <p>Troubleshooting tips:</p>
          <ul className="list-disc list-inside mt-2 text-left">
            <li>Check your internet connection</li>
            <li>Verify the meeting ID is correct</li>
            <li>Allow camera and microphone access</li>
            <li>Try using Chrome browser</li>
          </ul>
        </div>
        <div className="flex gap-4">
          <Button
            onClick={() => {
              setError(null);
              window.location.reload();
            }}
            className="px-4 py-2"
          >
            Retry Connection
          </Button>
          <Button
            onClick={() => navigate('/meetings')}
            variant="outline"
            className="px-4 py-2"
          >
            Back to Meetings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 relative">
        <ZoomComponentMeeting
          meetingNumber={meetingNumber}
          meetingPassword={meetingPassword}
          userName={userName}
          role={role}
          onMeetingJoined={handleMeetingJoined}
          onMeetingError={handleMeetingError}
          zak={zak} // Pass ZAK token to ZoomComponentMeeting
        />
      </div>
      
      {isConnected && (
        <div className="flex items-center justify-center p-4 bg-background border-t">
          <Button
            onClick={handleLeaveMeeting}
            variant="destructive"
            className="px-6 py-2"
          >
            Leave Meeting
          </Button>
        </div>
      )}
    </div>
  );
}

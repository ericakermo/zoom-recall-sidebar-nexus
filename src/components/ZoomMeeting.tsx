
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ZoomComponentView } from './ZoomComponentView';

interface ZoomMeetingProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingEnd?: () => void;
  zak?: string;
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
    console.log('✅ Meeting joined successfully');
    toast({
      title: "Connected",
      description: "You have joined the meeting"
    });
  };

  const handleMeetingError = (errorMessage: string) => {
    setError(errorMessage);
    setIsConnected(false);
    console.error('❌ Meeting error:', errorMessage);
  };

  const handleMeetingLeft = () => {
    setIsConnected(false);
    onMeetingEnd?.();
    toast({
      title: "Meeting Ended",
      description: "You have left the meeting"
    });
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900">
        <div className="text-center max-w-md">
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 font-medium">Unable to Join Meeting</p>
            <p className="text-red-500 text-sm mt-1">{error}</p>
          </div>
          
          <div className="text-sm text-gray-300 mb-6">
            <p className="font-medium mb-2">Troubleshooting tips:</p>
            <ul className="list-disc list-inside text-left space-y-1">
              <li>Check your internet connection</li>
              <li>Verify the meeting ID is correct</li>
              <li>Allow camera and microphone access</li>
              <li>Try using Chrome browser</li>
              <li>Ensure meeting hasn't ended</li>
            </ul>
          </div>
          
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => {
                setError(null);
                window.location.reload();
              }}
            >
              Retry Connection
            </Button>
            <Button
              onClick={() => navigate('/calendar')}
              variant="outline"
            >
              Back to Calendar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      {/* Meeting content - render ZoomComponentView to fill entire screen */}
      <ZoomComponentView
        meetingNumber={meetingNumber}
        meetingPassword={meetingPassword}
        userName={userName}
        role={role}
        onMeetingJoined={handleMeetingJoined}
        onMeetingError={handleMeetingError}
        onMeetingLeft={handleMeetingLeft}
      />
    </div>
  );
}

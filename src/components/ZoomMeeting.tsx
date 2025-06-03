
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ZoomComponentView } from './ZoomComponentView';
import { ZoomLoadingOverlay } from './zoom/ZoomLoadingOverlay';

interface ZoomMeetingProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingEnd?: () => void;
  onMeetingJoined?: (client: any) => void;
  zak?: string;
}

export function ZoomMeeting({
  meetingNumber,
  meetingPassword,
  userName,
  role = 0,
  onMeetingEnd,
  onMeetingJoined,
  zak
}: ZoomMeetingProps) {
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState('Initializing Zoom SDK...');
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleMeetingJoined = (client: any) => {
    setIsConnected(true);
    setIsLoading(false);
    console.log('✅ Meeting joined successfully');
    onMeetingJoined?.(client);
    toast({
      title: "Connected",
      description: "You have joined the meeting"
    });
  };

  const handleMeetingError = (errorMessage: string) => {
    setError(errorMessage);
    setIsConnected(false);
    setIsLoading(false);
    console.error('❌ Meeting error:', errorMessage);
  };

  const handleMeetingLeft = () => {
    setIsConnected(false);
    setIsLoading(false);
    onMeetingEnd?.();
    toast({
      title: "Meeting Ended",
      description: "You have left the meeting"
    });
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
        <div className="text-center max-w-md">
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 font-medium">Unable to Join Meeting</p>
            <p className="text-red-500 text-sm mt-1">{error}</p>
          </div>
          
          <div className="text-sm text-gray-600 mb-6">
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
                setIsLoading(true);
                setLoadingStep('Retrying connection...');
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
    <div className="h-full w-full flex flex-col relative">
      {/* Loading overlay */}
      <ZoomLoadingOverlay
        isLoading={isLoading}
        currentStep={loadingStep}
        meetingNumber={meetingNumber}
        retryCount={0}
        maxRetries={2}
      />

      {/* Meeting header */}
      <div className="flex items-center justify-between p-4 bg-white border-b flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold">Zoom Meeting</h2>
          <p className="text-sm text-gray-600">Meeting ID: {meetingNumber}</p>
        </div>
        {isConnected && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-600 font-medium">Connected</span>
          </div>
        )}
      </div>
      
      {/* Meeting content - fixed positioned container */}
      <div className="relative flex-1">
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
    </div>
  );
}

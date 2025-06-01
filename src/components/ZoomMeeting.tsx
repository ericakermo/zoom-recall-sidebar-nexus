import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ZoomComponentView } from './ZoomComponentView';
import { ZoomLoadingOverlay } from '@/components/zoom/ZoomLoadingOverlay';
import { ZoomErrorDisplay } from '@/components/zoom/ZoomErrorDisplay';
import { X } from 'lucide-react';

interface ZoomMeetingProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingEnd?: () => void;
  password?: string;
}

export function ZoomMeeting({
  meetingNumber,
  meetingPassword,
  userName,
  role = 0,
  onMeetingEnd,
  password
}: ZoomMeetingProps) {
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState('Initializing...');
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleMeetingJoined = () => {
    setIsConnected(true);
    setIsLoading(false);
    setCurrentStep('Connected');
    setError(null);
    console.log('✅ Meeting joined successfully');
    toast({
      title: "Connected",
      description: "You have joined the meeting"
    });
  };

  const handleMeetingError = (errorMessage: string) => {
    setError(errorMessage);
    setIsConnected(false);
    setIsLoading(false);
    setCurrentStep('Error');
    console.error('❌ Meeting error:', errorMessage);
  };

  const handleMeetingLeft = () => {
    setIsConnected(false);
    setIsLoading(false);
    setCurrentStep('Left Meeting');
    onMeetingEnd?.();
    toast({
      title: "Meeting Ended",
      description: "You have left the meeting"
    });
  };

  const handleRetry = () => {
    window.location.reload();
  };

  if (error && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
        <div className="text-center max-w-md">
          <ZoomErrorDisplay
            error={error}
            meetingNumber={meetingNumber}
            retryCount={0}
            maxRetries={2}
            onRetry={handleRetry}
          />
          <div className="flex gap-3 justify-center mt-6">
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
    <div className="h-full w-full flex flex-col">
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
        {isLoading && !error && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-gray-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600 font-medium">{currentStep}</span>
          </div>
        )}
      </div>
      
      <div className="relative flex-1 min-h-[400px]">
        <ZoomComponentView
          meetingNumber={meetingNumber}
          meetingPassword={meetingPassword}
          userName={userName}
          role={role}
          onMeetingJoined={handleMeetingJoined}
          onMeetingError={handleMeetingError}
          onMeetingLeft={handleMeetingLeft}
        />

        <ZoomLoadingOverlay
          isLoading={isLoading}
          currentStep={currentStep}
          meetingNumber={meetingNumber}
          retryCount={0}
          maxRetries={2}
        />
      </div>
    </div>
  );
}


import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useZoomSDK } from '@/hooks/useZoomSDK';
import { useMeetingControls } from '@/hooks/useMeetingControls';
import { ZoomMeetingContainer } from './ZoomMeetingContainer';
import { ZoomMeetingControls } from './ZoomMeetingControls';

interface ZoomMeetingProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingEnd?: () => void;
}

export function ZoomMeeting({
  meetingNumber,
  meetingPassword,
  userName,
  role = 0,
  onMeetingEnd
}: ZoomMeetingProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const { sdkLoaded, error: sdkError, createClient, cleanup, client } = useZoomSDK();
  const { isMuted, isVideoOff, toggleMute, toggleVideo, leaveMeeting } = useMeetingControls(client);

  // Create client when SDK is loaded
  useEffect(() => {
    if (sdkLoaded && !client) {
      try {
        createClient();
        console.log('Zoom client created successfully');
      } catch (err: any) {
        console.error('Failed to create Zoom client:', err);
        setError(err.message);
      }
    }
  }, [sdkLoaded, client, createClient]);

  // Handle SDK loading
  useEffect(() => {
    if (sdkError) {
      setError(sdkError);
      setIsLoading(false);
    } else if (sdkLoaded) {
      setIsLoading(false);
    }
  }, [sdkLoaded, sdkError]);

  const handleMeetingJoined = () => {
    setIsConnected(true);
    setIsLoading(false);
  };

  const handleMeetingError = (errorMessage: string) => {
    setError(errorMessage);
    setIsLoading(false);
    toast({
      title: "Meeting Error",
      description: errorMessage,
      variant: "destructive"
    });
  };

  const handleLeaveMeeting = () => {
    leaveMeeting();
    setIsConnected(false);
    cleanup();
    onMeetingEnd?.();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isConnected) return;
      
      if (e.key === 'm') toggleMute();
      else if (e.key === 'v') toggleVideo();
      else if (e.key === 'l' && e.ctrlKey) handleLeaveMeeting();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConnected, toggleMute, toggleVideo, handleLeaveMeeting]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
        <p className="text-red-500 mb-4">{error}</p>
        <div className="text-sm text-gray-500 mb-6 max-w-md text-center">
          <p>Troubleshooting tips:</p>
          <ul className="list-disc list-inside mt-2 text-left">
            <li>Check your internet connection</li>
            <li>Verify that Zoom is not blocked by your network</li>
            <li>Allow camera and microphone access in your browser</li>
            <li>Try using a different browser (Chrome recommended)</li>
          </ul>
        </div>
        <div className="flex gap-4">
          <Button
            onClick={() => {
              setError(null);
              setIsLoading(true);
              window.location.reload();
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Retry Connection
          </Button>
          <Button
            onClick={() => navigate('/meetings')}
            variant="outline"
            className="px-4 py-2 rounded-md"
          >
            Back to Meetings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="w-full h-full min-h-[500px] relative">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full w-full absolute inset-0 bg-background/80">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p>Loading Zoom meeting...</p>
          </div>
        )}
        
        {client && (
          <ZoomMeetingContainer
            meetingNumber={meetingNumber}
            meetingPassword={meetingPassword}
            userName={userName}
            role={role}
            client={client}
            onMeetingJoined={handleMeetingJoined}
            onMeetingError={handleMeetingError}
          />
        )}
      </div>
      
      <ZoomMeetingControls
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onLeaveMeeting={handleLeaveMeeting}
        isConnected={isConnected}
      />
    </div>
  );
}

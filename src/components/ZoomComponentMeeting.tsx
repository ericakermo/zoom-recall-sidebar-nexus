
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useZoomComponentSDK } from '@/hooks/useZoomComponentSDK';
import { getZoomAccessToken } from '@/lib/zoom-config';

interface ZoomComponentMeetingProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingJoined?: () => void;
  onMeetingError?: (error: string) => void;
}

export function ZoomComponentMeeting({
  meetingNumber,
  meetingPassword,
  userName: providedUserName,
  role = 0,
  onMeetingJoined,
  onMeetingError
}: ZoomComponentMeetingProps) {
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  
  const {
    sdkLoaded,
    error: sdkError,
    isInitialized,
    initializeClient,
    joinMeeting,
    cleanup
  } = useZoomComponentSDK();

  // Initialize and join when ready
  useEffect(() => {
    if (!sdkLoaded || !containerRef.current || !meetingNumber || hasJoined || isJoining) {
      return;
    }

    const initAndJoin = async () => {
      setIsJoining(true);
      
      try {
        // Get OAuth token
        const tokenData = await getZoomAccessToken(meetingNumber, role || 0);
        console.log('Got OAuth token for Component SDK');

        // Initialize client with container
        await initializeClient(containerRef.current!);
        console.log('Client initialized, joining meeting...');

        // Join meeting with OAuth token
        await joinMeeting({
          meetingNumber,
          userName: providedUserName || user?.email || 'Guest',
          signature: tokenData.accessToken, // Component SDK expects OAuth token as signature
          password: meetingPassword || '',
          userEmail: user?.email || ''
        });

        setHasJoined(true);
        onMeetingJoined?.();
        
        toast({
          title: "Meeting Joined",
          description: "Successfully joined the Zoom meeting"
        });

      } catch (error: any) {
        console.error('Failed to initialize or join meeting:', error);
        const errorMessage = error.message || 'Failed to join meeting';
        onMeetingError?.(errorMessage);
        toast({
          title: "Meeting Error",
          description: errorMessage,
          variant: "destructive"
        });
      } finally {
        setIsJoining(false);
      }
    };

    initAndJoin();
  }, [sdkLoaded, meetingNumber, hasJoined, isJoining, initializeClient, joinMeeting, role, providedUserName, user, meetingPassword, onMeetingJoined, onMeetingError, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Handle SDK errors
  useEffect(() => {
    if (sdkError) {
      onMeetingError?.(sdkError);
    }
  }, [sdkError, onMeetingError]);

  return (
    <div className="w-full h-full min-h-[500px] relative">
      {(isJoining || !hasJoined) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg">
              {!sdkLoaded ? 'Loading Zoom SDK...' : 'Joining meeting...'}
            </p>
          </div>
        </div>
      )}
      
      <div 
        ref={containerRef}
        id="meetingSDKElement"
        className="w-full h-full"
        style={{ minHeight: '500px' }}
      />
    </div>
  );
}

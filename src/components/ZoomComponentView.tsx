
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSimpleZoom } from '@/hooks/useSimpleZoom';
import { ZoomMeetingControls } from '@/components/zoom/ZoomMeetingControls';
import { ZoomLoadingOverlay } from '@/components/zoom/ZoomLoadingOverlay';
import { ZoomErrorDisplay } from '@/components/zoom/ZoomErrorDisplay';
import { supabase } from '@/integrations/supabase/client';

interface ZoomComponentViewProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingJoined?: () => void;
  onMeetingError?: (error: string) => void;
  onMeetingLeft?: () => void;
}

export function ZoomComponentView({
  meetingNumber,
  meetingPassword,
  userName: providedUserName,
  role = 0,
  onMeetingJoined,
  onMeetingError,
  onMeetingLeft
}: ZoomComponentViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [hasStartedJoin, setHasStartedJoin] = useState(false);
  const [currentStep, setCurrentStep] = useState('Loading...');
  
  const { user } = useAuth();
  const MAX_RETRIES = 3;

  const {
    containerRef,
    isReady,
    isInitializing,
    sdkLoaded,
    joinMeeting,
    cleanup
  } = useSimpleZoom({
    onInitialized: () => {
      console.log('✅ Zoom client ready for meeting');
      setCurrentStep('Client ready');
    },
    onError: (error) => {
      console.error('❌ Zoom error:', error);
      setError(error);
      onMeetingError?.(error);
    }
  });

  const getTokens = useCallback(async (meetingNumber: string, role: number) => {
    try {
      setCurrentStep('Getting authentication tokens...');

      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
        body: {
          meetingNumber,
          role: role || 0,
          expirationSeconds: 7200
        }
      });

      if (tokenError) throw new Error(`Token error: ${tokenError.message}`);

      // Get ZAK token if host
      let zakToken = null;
      if (role === 1) {
        setCurrentStep('Getting host permissions...');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        if (!zakError && zakData) {
          zakToken = zakData.zak;
        }
      }

      return { ...tokenData, zak: zakToken };
    } catch (error) {
      console.error('❌ Token fetch failed:', error);
      throw error;
    }
  }, []);

  const handleJoinMeeting = useCallback(async () => {
    if (!isReady || hasStartedJoin) return;

    setHasStartedJoin(true);
    
    try {
      setCurrentStep('Preparing to join meeting...');
      const tokens = await getTokens(meetingNumber, role || 0);

      const joinConfig = {
        sdkKey: tokens.sdkKey,
        signature: tokens.signature,
        meetingNumber,
        userName: providedUserName || user?.email || 'Guest',
        userEmail: user?.email || '',
        passWord: meetingPassword || '',
        role: role || 0,
        ...(role === 1 && tokens.zak && { zak: tokens.zak })
      };

      setCurrentStep('Joining meeting...');
      await joinMeeting(joinConfig);
      
      setIsJoined(true);
      setIsLoading(false);
      setCurrentStep('Meeting joined successfully');
      onMeetingJoined?.();
    } catch (error: any) {
      console.error('❌ Join failed:', error);
      setError(error.message);
      setHasStartedJoin(false);
      setCurrentStep('Join failed');
    }
  }, [isReady, hasStartedJoin, meetingNumber, role, providedUserName, user, meetingPassword, getTokens, joinMeeting, onMeetingJoined]);

  const handleRetry = useCallback(() => {
    if (retryCount >= MAX_RETRIES) return;

    setRetryCount(prev => prev + 1);
    setError(null);
    setHasStartedJoin(false);
    setIsLoading(true);
    setCurrentStep('Retrying...');
  }, [retryCount]);

  // Update loading state based on SDK status
  useEffect(() => {
    if (sdkLoaded && !isInitializing) {
      setCurrentStep('SDK loaded, initializing...');
    } else if (isInitializing) {
      setCurrentStep('Initializing Zoom client...');
    } else if (!sdkLoaded) {
      setCurrentStep('Loading Zoom SDK...');
    }
  }, [sdkLoaded, isInitializing]);

  // Join when ready
  useEffect(() => {
    if (isReady && !hasStartedJoin && !isJoined) {
      const timer = setTimeout(handleJoinMeeting, 500);
      return () => clearTimeout(timer);
    }
  }, [isReady, hasStartedJoin, isJoined, handleJoinMeeting]);

  if (error) {
    return (
      <ZoomErrorDisplay
        error={error}
        meetingNumber={meetingNumber}
        retryCount={retryCount}
        maxRetries={MAX_RETRIES}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      <ZoomLoadingOverlay
        isLoading={isLoading}
        currentStep={currentStep}
        meetingNumber={meetingNumber}
        retryCount={retryCount}
        maxRetries={MAX_RETRIES}
      />

      <div 
        ref={containerRef}
        id="zoomComponentContainer"
        className="w-full h-full"
        style={{ 
          minHeight: '500px',
          minWidth: '800px',
          position: 'relative'
        }}
      />

      {isJoined && (
        <ZoomMeetingControls
          isJoined={isJoined}
          isMuted={true}
          isVideoOff={true}
          onToggleMute={() => {}}
          onToggleVideo={() => {}}
          onLeaveMeeting={() => {
            cleanup();
            onMeetingLeft?.();
          }}
        />
      )}
    </div>
  );
}

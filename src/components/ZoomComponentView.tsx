
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useZoomSDK } from '@/hooks/useZoomSDK';
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
  
  const { user } = useAuth();
  const MAX_RETRIES = 3;

  const {
    sdkReady,
    error: sdkError,
    currentStep,
    logStep,
    handleError,
    loadZoomSDK
  } = useZoomSDK(onMeetingError);

  const {
    containerRef,
    isReady,
    isInitializing,
    initializeZoom,
    joinMeeting,
    cleanup
  } = useSimpleZoom({
    onInitialized: () => {
      logStep('✅ Zoom client ready');
    },
    onError: (error) => {
      handleError(`Client error: ${error}`);
      setError(error);
    }
  });

  const getTokens = useCallback(async (meetingNumber: string, role: number) => {
    try {
      logStep('🔄 Fetching tokens...');

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
        logStep('🔄 Getting ZAK token...');
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
  }, [logStep]);

  const handleJoinMeeting = useCallback(async () => {
    if (!isReady || hasStartedJoin) return;

    setHasStartedJoin(true);
    
    try {
      logStep('🔄 Starting join process...');
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

      await joinMeeting(joinConfig);
      
      setIsJoined(true);
      setIsLoading(false);
      onMeetingJoined?.();
      logStep('✅ Successfully joined meeting');
    } catch (error: any) {
      console.error('❌ Join failed:', error);
      setError(error.message);
      setHasStartedJoin(false);
    }
  }, [isReady, hasStartedJoin, meetingNumber, role, providedUserName, user, meetingPassword, getTokens, joinMeeting, onMeetingJoined, logStep]);

  const handleRetry = useCallback(() => {
    if (retryCount >= MAX_RETRIES) return;

    setRetryCount(prev => prev + 1);
    setError(null);
    setHasStartedJoin(false);
    setIsLoading(true);
    
    setTimeout(() => {
      if (isReady) {
        handleJoinMeeting();
      } else {
        initializeZoom();
      }
    }, 1000);
  }, [retryCount, isReady, handleJoinMeeting, initializeZoom]);

  // Load SDK
  useEffect(() => {
    logStep('🔄 Loading SDK...');
    loadZoomSDK().catch(err => {
      console.error('SDK load failed:', err);
      setError('Failed to load Zoom SDK');
    });
  }, [loadZoomSDK, logStep]);

  // Initialize when SDK ready
  useEffect(() => {
    if (sdkReady && !isInitializing && !isReady) {
      logStep('🔄 SDK ready, initializing...');
      setTimeout(initializeZoom, 100);
    }
  }, [sdkReady, isInitializing, isReady, initializeZoom, logStep]);

  // Join when ready
  useEffect(() => {
    if (isReady && !hasStartedJoin) {
      setTimeout(handleJoinMeeting, 200);
    }
  }, [isReady, hasStartedJoin, handleJoinMeeting]);

  if (sdkError || error) {
    return (
      <ZoomErrorDisplay
        error={sdkError || error || 'Unknown error'}
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
        id="meetingSDKElement"
        className="w-full h-full"
        style={{ 
          minHeight: '400px',
          minWidth: '400px'
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

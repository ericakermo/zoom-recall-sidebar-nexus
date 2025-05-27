
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useZoomSDK } from '@/hooks/useZoomSDK';
import { useZoomClient } from '@/hooks/useZoomClient';
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
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [hasStartedJoin, setHasStartedJoin] = useState(false);
  
  const { user } = useAuth();
  const MAX_RETRIES = 3;

  const {
    sdkReady,
    error,
    currentStep,
    logStep,
    handleError,
    loadZoomSDK
  } = useZoomSDK(onMeetingError);

  const {
    containerRef,
    clientRef,
    isInitialized,
    isInitializing,
    initializeClient,
    joinMeeting,
    leaveMeeting
  } = useZoomClient({
    onInitialized: () => {
      logStep('✅ Zoom client ready, preparing to join...');
    },
    onError: (error) => {
      handleError(`Client initialization failed: ${error}`);
    }
  });

  const getTokens = useCallback(async (meetingNumber: string, role: number) => {
    try {
      logStep('Fetching Zoom tokens...', { meetingNumber, role });

      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
        body: {
          meetingNumber,
          role: role || 0,
          expirationSeconds: 7200
        }
      });

      if (tokenError) {
        throw new Error(`Token error: ${tokenError.message}`);
      }

      // Get ZAK token if host
      let zakToken = null;
      if (role === 1) {
        logStep('Fetching ZAK token for host...');
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
    if (!isInitialized || hasStartedJoin) {
      return;
    }

    setHasStartedJoin(true);
    
    try {
      logStep('Getting tokens and joining meeting...');
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
      console.error('❌ Join error:', error);
      handleError(error.message || 'Failed to join meeting');
      setHasStartedJoin(false);
    }
  }, [
    isInitialized,
    hasStartedJoin,
    meetingNumber,
    role,
    providedUserName,
    user,
    meetingPassword,
    getTokens,
    joinMeeting,
    onMeetingJoined,
    logStep,
    handleError
  ]);

  const handleLeaveMeeting = useCallback(async () => {
    try {
      await leaveMeeting();
      setIsJoined(false);
      onMeetingLeft?.();
    } catch (error) {
      console.error('Error leaving meeting:', error);
    }
  }, [leaveMeeting, onMeetingLeft]);

  const toggleMute = useCallback(() => {
    if (clientRef.current && isJoined) {
      try {
        if (isMuted) {
          clientRef.current.unmuteAudio();
        } else {
          clientRef.current.muteAudio();
        }
        setIsMuted(!isMuted);
      } catch (error) {
        console.error('Error toggling mute:', error);
      }
    }
  }, [isMuted, isJoined]);

  const toggleVideo = useCallback(() => {
    if (clientRef.current && isJoined) {
      try {
        if (isVideoOff) {
          clientRef.current.startVideo();
        } else {
          clientRef.current.stopVideo();
        }
        setIsVideoOff(!isVideoOff);
      } catch (error) {
        console.error('Error toggling video:', error);
      }
    }
  }, [isVideoOff, isJoined]);

  const handleRetry = useCallback(() => {
    if (retryCount >= MAX_RETRIES) {
      handleError('Maximum retry attempts reached');
      return;
    }

    setRetryCount(prev => prev + 1);
    setHasStartedJoin(false);
    setIsLoading(true);
    
    setTimeout(() => {
      if (isInitialized) {
        handleJoinMeeting();
      } else {
        initializeClient();
      }
    }, 1000);
  }, [retryCount, isInitialized, handleJoinMeeting, initializeClient, handleError]);

  // Load SDK on mount
  useEffect(() => {
    logStep('Loading Zoom SDK...');
    loadZoomSDK().catch(err => {
      console.error('Failed to load SDK:', err);
      handleError('Failed to load Zoom SDK');
    });
  }, [loadZoomSDK, handleError, logStep]);

  // Initialize client when SDK is ready
  useEffect(() => {
    if (sdkReady && !isInitializing && !isInitialized) {
      logStep('SDK ready, initializing client...');
      setTimeout(() => {
        initializeClient();
      }, 300);
    }
  }, [sdkReady, isInitializing, isInitialized, initializeClient, logStep]);

  // Join meeting when client is ready
  useEffect(() => {
    if (isInitialized && !hasStartedJoin) {
      setTimeout(() => {
        handleJoinMeeting();
      }, 500);
    }
  }, [isInitialized, hasStartedJoin, handleJoinMeeting]);

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
          minHeight: '400px',
          minWidth: '400px',
          position: 'relative',
          overflow: 'hidden'
        }}
      />

      <ZoomMeetingControls
        isJoined={isJoined}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onLeaveMeeting={handleLeaveMeeting}
      />
    </div>
  );
}

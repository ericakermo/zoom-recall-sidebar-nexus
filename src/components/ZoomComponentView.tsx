
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useZoomSDKEnhanced } from '@/hooks/useZoomSDKEnhanced';
import { useZoomSession } from '@/context/ZoomSessionContext';
import { useContainerReadiness } from '@/hooks/useContainerReadiness';
import { useZoomLoadingLogger } from '@/hooks/useZoomLoadingLogger';
import { useZoomRetryLogic } from '@/hooks/useZoomRetryLogic';
import { preloadZoomAssets } from '@/lib/zoom-config';
import { supabase } from '@/integrations/supabase/client';
import { ZoomRecoveryOptions } from './zoom/ZoomRecoveryOptions';
import { ZoomLoadingOverlay } from './zoom/ZoomLoadingOverlay';

interface ZoomComponentViewProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingJoined?: (client: any) => void;
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
  const { user } = useAuth();
  const hasAttemptedJoinRef = useRef(false);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const { forceLeaveSession, isSessionActive } = useZoomSession();

  // Enhanced logging and retry logic
  const { logStep, getLoadingReport, reset: resetLogger } = useZoomLoadingLogger();
  const { 
    executeWithRetry, 
    retryCount, 
    isRetrying, 
    lastError: retryError, 
    canRetry,
    maxRetries,
    reset: resetRetry 
  } = useZoomRetryLogic({
    maxRetries: 2,
    baseDelay: 2000
  });

  logStep('Component initialized', { meetingNumber, role, userName: providedUserName });

  // Container readiness check
  const { isReady: isContainerReady, error: containerError } = useContainerReadiness({
    containerId: 'meetingSDKElement',
    onReady: () => {
      logStep('Container ready', null, true);
    },
    onTimeout: () => {
      logStep('Container readiness timeout', null, false, 'Container failed to initialize');
      onMeetingError?.('Meeting container failed to initialize properly');
    }
  });

  // Enhanced SDK with logging
  const {
    isReady,
    isJoining,
    isJoined,
    joinMeeting,
    client
  } = useZoomSDKEnhanced({
    onReady: () => {
      logStep('SDK ready', null, true);
    },
    onError: (error) => {
      logStep('SDK error', { error }, false, error);
      setShowRecovery(true);
      onMeetingError?.(error);
    }
  });

  // Asset preloading with logging
  useEffect(() => {
    const loadAssets = async () => {
      try {
        logStep('Starting asset preload');
        await executeWithRetry(
          () => preloadZoomAssets(),
          'Asset preloading',
          (attempt, delay) => {
            logStep(`Asset preload retry ${attempt}`, { delay });
          }
        );
        logStep('Assets preloaded', null, true);
        setAssetsLoaded(true);
      } catch (error: any) {
        logStep('Asset preload failed', { error: error.message }, false, error.message);
        onMeetingError?.(`Failed to load meeting assets: ${error.message}`);
        setShowRecovery(true);
      }
    };

    loadAssets();
  }, [executeWithRetry, logStep, onMeetingError]);

  const getTokens = useCallback(async (meetingNumber: string, role: number, forceRefresh: boolean = false) => {
    try {
      logStep('Getting authentication tokens', { meetingNumber, role, forceRefresh });
      
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

      let zakToken = null;
      if (role === 1) {
        logStep('Getting ZAK token for host', { retryCount });
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        
        if (zakError || !zakData?.zak) {
          throw new Error('Host role requires fresh ZAK token - please try again');
        }
        
        zakToken = zakData.zak;
        logStep('ZAK token obtained', null, true);
      }

      logStep('Authentication tokens obtained', null, true);
      return { ...tokenData, zak: zakToken };
    } catch (error: any) {
      logStep('Token fetch failed', { error: error.message }, false, error.message);
      throw error;
    }
  }, [logStep, retryCount]);

  const handleJoinMeeting = useCallback(async () => {
    // Check prerequisites with logging
    if (!assetsLoaded) {
      logStep('Waiting for assets');
      return;
    }

    if (!isContainerReady) {
      logStep('Waiting for container');
      return;
    }

    if (containerError) {
      logStep('Container error detected', { containerError }, false, containerError);
      onMeetingError?.(containerError);
      setShowRecovery(true);
      return;
    }

    // Check for existing sessions
    if (isSessionActive()) {
      logStep('Active session detected, cleaning up');
      await forceLeaveSession();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Prevent multiple join attempts
    if (!isReady || isJoining || isJoined || hasAttemptedJoinRef.current) {
      logStep('Join attempt prevented', {
        isReady,
        isJoining,
        isJoined,
        hasAttempted: hasAttemptedJoinRef.current
      });
      return;
    }

    hasAttemptedJoinRef.current = true;

    try {
      logStep('Starting join process', { attempt: retryCount + 1 });

      await executeWithRetry(async () => {
        const tokens = await getTokens(meetingNumber, role || 0, retryCount > 0);

        const joinConfig = {
          sdkKey: tokens.sdkKey,
          signature: tokens.signature,
          meetingNumber,
          userName: providedUserName || user?.email || 'Guest',
          userEmail: user?.email || '',
          password: meetingPassword || '',
          role: role || 0,
          zak: tokens.zak || ''
        };

        logStep('Calling joinMeeting', { config: { ...joinConfig, signature: 'hidden' } });
        await joinMeeting(joinConfig);
        logStep('Join completed successfully', null, true);
        
        onMeetingJoined?.(client);
      }, 'Meeting join', (attempt, delay) => {
        logStep(`Join retry ${attempt}`, { delay });
        hasAttemptedJoinRef.current = false;
      });

    } catch (error: any) {
      logStep('Join failed completely', { error: error.message }, false, error.message);
      hasAttemptedJoinRef.current = false;
      setShowRecovery(true);
      onMeetingError?.(error.message);
    }
  }, [
    assetsLoaded, isContainerReady, containerError, isReady, isJoining, isJoined,
    meetingNumber, role, providedUserName, user, meetingPassword, getTokens,
    joinMeeting, onMeetingJoined, client, retryCount, onMeetingError,
    isSessionActive, forceLeaveSession, executeWithRetry, logStep
  ]);

  // Auto-join when ready
  useEffect(() => {
    if (assetsLoaded && isContainerReady && isReady && !hasAttemptedJoinRef.current && !containerError) {
      logStep('All prerequisites met - starting auto-join');
      handleJoinMeeting();
    }
  }, [assetsLoaded, isContainerReady, isReady, handleJoinMeeting, containerError, logStep]);

  // Reset on meeting change
  useEffect(() => {
    hasAttemptedJoinRef.current = false;
    resetRetry();
    resetLogger();
    setShowRecovery(false);
  }, [meetingNumber, resetRetry, resetLogger]);

  // Recovery options
  const handleRetry = useCallback(() => {
    logStep('Manual retry initiated');
    resetRetry();
    setShowRecovery(false);
    hasAttemptedJoinRef.current = false;
    handleJoinMeeting();
  }, [logStep, resetRetry, handleJoinMeeting]);

  const handleRefreshPage = useCallback(() => {
    logStep('Page refresh initiated');
    window.location.reload();
  }, [logStep]);

  const handleGoHome = useCallback(() => {
    logStep('Navigating to calendar');
    window.location.href = '/calendar';
  }, [logStep]);

  // Show recovery options if needed
  if (showRecovery && (retryError || containerError)) {
    const error = retryError || containerError || 'Unknown error occurred';
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <ZoomRecoveryOptions
          error={error}
          retryCount={retryCount}
          maxRetries={maxRetries}
          onRetry={handleRetry}
          onGoHome={handleGoHome}
          onRefreshPage={handleRefreshPage}
          isRetrying={isRetrying}
          loadingReport={getLoadingReport()}
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {/* Loading overlay with enhanced information */}
      <ZoomLoadingOverlay
        isLoading={!isJoined && !showRecovery}
        currentStep={
          !assetsLoaded ? 'Loading Zoom components...' :
          !isContainerReady ? 'Preparing meeting interface...' :
          !isReady ? 'Initializing Zoom SDK...' :
          isJoining ? 'Connecting to meeting...' :
          'Finalizing connection...'
        }
        meetingNumber={meetingNumber}
        retryCount={retryCount}
        maxRetries={maxRetries}
      />
      
      <div 
        id="meetingSDKElement"
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
}

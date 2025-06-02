
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useZoomSDK } from '@/hooks/useZoomSDK';
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
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState('Preparing container...');
  const [retryCount, setRetryCount] = useState(0);
  const [hasAttemptedJoin, setHasAttemptedJoin] = useState(false);
  const [containerReady, setContainerReady] = useState(false);
  const maxRetries = 2;
  
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  // Debug logging helper
  const debugLog = useCallback((message: string, data?: any) => {
    console.log(`🔍 [COMPONENT-DEBUG] ${message}`, data || '');
  }, []);

  // Ensure container is ready before initializing SDK
  useEffect(() => {
    const checkContainer = () => {
      if (containerRef.current) {
        debugLog('Container is ready, setting containerReady to true');
        setContainerReady(true);
        setCurrentStep('Container ready, initializing Zoom SDK...');
      } else {
        debugLog('Container not ready yet, retrying...');
        setTimeout(checkContainer, 100);
      }
    };

    checkContainer();
  }, [debugLog]);

  const {
    isSDKLoaded,
    isReady,
    isJoined,
    joinMeeting,
    leaveMeeting,
    cleanup
  } = useZoomSDK({
    containerRef,
    shouldInitialize: containerReady,
    onReady: () => {
      debugLog('Zoom SDK ready - preparing to join meeting');
      setCurrentStep('Preparing to join meeting...');
    },
    onError: (error) => {
      debugLog('Zoom SDK error:', error);
      setError(error);
      setIsLoading(false);
      onMeetingError?.(error);
    }
  });

  const getTokens = useCallback(async (meetingNumber: string, role: number) => {
    try {
      debugLog('Requesting fresh tokens for meeting:', { meetingNumber, role });
      
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
        body: {
          meetingNumber,
          role: role || 0,
          expirationSeconds: 7200
        }
      });

      if (tokenError) {
        debugLog('Token request failed:', tokenError);
        throw new Error(`Token error: ${tokenError.message}`);
      }

      debugLog('Fresh tokens received');

      // Get fresh ZAK token for host role
      let zakToken = null;
      if (role === 1) {
        debugLog('Requesting fresh ZAK token for host role...');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        
        if (zakError || !zakData?.zak) {
          debugLog('ZAK token request failed:', zakError);
          throw new Error('Host role requires fresh ZAK token - please try again or check your Zoom connection');
        }
        
        zakToken = zakData.zak;
        debugLog('Fresh ZAK token received for host authentication');
      }

      return { ...tokenData, zak: zakToken };
    } catch (error) {
      debugLog('Token fetch failed:', error);
      throw error;
    }
  }, [debugLog]);

  const handleJoinMeeting = useCallback(async () => {
    debugLog('handleJoinMeeting called - Current state:', {
      isReady,
      containerReady,
      hasAttemptedJoin,
      isJoined,
      error: !!error
    });

    if (!isReady || !containerReady || hasAttemptedJoin || isJoined || error) {
      debugLog('Skipping join - conditions not met');
      return;
    }

    setHasAttemptedJoin(true);

    try {
      setCurrentStep('Getting fresh authentication tokens...');
      const tokens = await getTokens(meetingNumber, role || 0);

      const joinConfig = {
        sdkKey: tokens.sdkKey,
        signature: tokens.signature,
        meetingNumber,
        userName: providedUserName || user?.email || 'Guest',
        userEmail: user?.email || '',
        passWord: meetingPassword || '',
        role: role || 0,
        zak: tokens.zak || ''
      };

      debugLog('Attempting to join meeting with config:', {
        ...joinConfig,
        signature: '[REDACTED]',
        zak: joinConfig.zak ? '[PRESENT]' : '[EMPTY]'
      });
      
      setCurrentStep('Joining meeting...');
      
      await joinMeeting(joinConfig);
      
      setIsLoading(false);
      setCurrentStep('Connected to meeting');
      setRetryCount(0);
      onMeetingJoined?.();

    } catch (error: any) {
      debugLog('Join failed:', error);
      setError(error.message);
      setIsLoading(false);
      setHasAttemptedJoin(false); // Allow retry
      onMeetingError?.(error.message);
    }
  }, [isReady, containerReady, hasAttemptedJoin, isJoined, error, meetingNumber, role, providedUserName, user, meetingPassword, getTokens, joinMeeting, onMeetingJoined, onMeetingError, debugLog]);

  // Update current step based on SDK status
  useEffect(() => {
    if (isJoined) {
      setCurrentStep('Connected to meeting');
      setIsLoading(false);
    } else if (isReady && containerReady && !hasAttemptedJoin) {
      setCurrentStep('Ready to join meeting');
    } else if (isSDKLoaded && containerReady) {
      setCurrentStep('Initializing Zoom SDK...');
    } else if (containerReady) {
      setCurrentStep('Loading Zoom SDK...');
    } else {
      setCurrentStep('Preparing container...');
    }
  }, [isSDKLoaded, isReady, isJoined, hasAttemptedJoin, containerReady]);

  // Join when ready - single effect with proper guards
  useEffect(() => {
    if (isReady && containerReady && !error && !isJoined && !hasAttemptedJoin) {
      debugLog('All conditions met - starting join process...');
      handleJoinMeeting();
    }
  }, [isReady, containerReady, error, isJoined, hasAttemptedJoin, handleJoinMeeting, debugLog]);

  const handleLeaveMeeting = useCallback(() => {
    leaveMeeting();
    onMeetingLeft?.();
  }, [leaveMeeting, onMeetingLeft]);

  const handleRetry = useCallback(() => {
    if (retryCount < maxRetries) {
      debugLog(`Retrying join attempt ${retryCount + 1}/${maxRetries}`);
      setRetryCount(prev => prev + 1);
      setError(null);
      setIsLoading(true);
      setHasAttemptedJoin(false);
      setContainerReady(false);
      setCurrentStep('Retrying...');
      
      // Clean up and retry
      cleanup();
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }, [retryCount, maxRetries, cleanup, debugLog]);

  if (error) {
    return (
      <ZoomErrorDisplay
        error={error}
        meetingNumber={meetingNumber}
        retryCount={retryCount}
        maxRetries={maxRetries}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <div className="relative w-full h-full">
      <ZoomLoadingOverlay
        isLoading={isLoading}
        currentStep={currentStep}
        meetingNumber={meetingNumber}
        retryCount={retryCount}
        maxRetries={maxRetries}
      />

      {/* Zoom meeting container - ensure it's always mounted */}
      <div className="zoom-meeting-wrapper">
        <div 
          ref={containerRef}
          className="zoom-container"
          style={{
            width: '900px',
            height: '506px',
            backgroundColor: '#000',
            border: '1px solid #ccc'
          }}
        />
      </div>
    </div>
  );
}

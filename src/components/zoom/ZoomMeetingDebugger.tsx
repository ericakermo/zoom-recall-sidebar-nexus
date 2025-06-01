
import { useState, useEffect, useRef, useCallback } from 'react';
import { useZoomSDK } from '@/hooks/useZoomSDK';
import { getZoomAccessToken } from '@/lib/zoom-config';
import { ZoomLoadingOverlay } from './ZoomLoadingOverlay';
import { ZoomErrorDisplay } from './ZoomErrorDisplay';

interface ZoomMeetingDebuggerProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingJoined?: () => void;
  onMeetingError?: (error: string) => void;
  onMeetingLeft?: () => void;
}

interface AsyncState {
  isInitializing: boolean;
  isInitialized: boolean;
  isJoining: boolean;
  isJoined: boolean;
  hasError: boolean;
  currentStep: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

export function ZoomMeetingDebugger({
  meetingNumber,
  meetingPassword = '',
  userName = 'Guest',
  role = 0,
  onMeetingJoined,
  onMeetingError,
  onMeetingLeft
}: ZoomMeetingDebuggerProps) {
  const [asyncState, setAsyncState] = useState<AsyncState>({
    isInitializing: false,
    isInitialized: false,
    isJoining: false,
    isJoined: false,
    hasError: false,
    currentStep: 'Preparing to initialize Zoom SDK...'
  });

  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const joinAttemptRef = useRef<Promise<void> | null>(null);
  const hasAttemptedJoinRef = useRef(false);
  const componentMountedRef = useRef(true);

  const debugLog = useCallback((message: string, data?: any) => {
    console.log(`🔍 [ZOOM-DEBUGGER] ${message}`, data || '');
  }, []);

  const logFullConfig = useCallback((config: any, type: 'init' | 'join') => {
    const sanitizedConfig = {
      ...config,
      signature: config.signature ? `${config.signature.substring(0, 20)}...` : undefined,
      zak: config.zak ? `${config.zak.substring(0, 20)}...` : undefined,
      success: '[FUNCTION]',
      error: '[FUNCTION]'
    };
    debugLog(`Full ${type} config:`, sanitizedConfig);
  }, [debugLog]);

  const updateAsyncState = useCallback((updates: Partial<AsyncState>) => {
    if (!componentMountedRef.current) return;
    setAsyncState(prev => ({ ...prev, ...updates }));
  }, []);

  const { containerRef, isReady, isJoined, joinMeeting, cleanup } = useZoomSDK({
    onReady: () => {
      debugLog('SDK initialization completed successfully');
      updateAsyncState({ 
        isInitializing: false, 
        isInitialized: true,
        currentStep: 'SDK ready, preparing to join meeting...'
      });
    },
    onError: (errorMessage) => {
      debugLog('SDK initialization failed:', errorMessage);
      updateAsyncState({ 
        isInitializing: false, 
        hasError: true,
        currentStep: 'SDK initialization failed'
      });
      setError(errorMessage);
      onMeetingError?.(errorMessage);
    }
  });

  const handleJoinError = useCallback((error: any) => {
    debugLog('Join attempt failed with detailed error:', {
      type: error?.type || 'unknown',
      reason: error?.reason || error?.message || 'unknown',
      code: error?.code,
      errorCode: error?.errorCode,
      errorMessage: error?.errorMessage,
      fullError: error
    });

    let errorMessage = 'Unknown join error';
    
    if (error?.type === 'INVALID_OPERATION' && error?.reason === 'Duplicated join operation') {
      errorMessage = 'Join already in progress - please wait';
    } else if (error?.errorCode === 3712) {
      errorMessage = 'Invalid signature - authentication failed';
    } else if (error?.errorCode === 1) {
      errorMessage = 'Meeting not found - verify meeting ID';
    } else if (error?.errorCode === 3000) {
      errorMessage = 'Meeting password required or incorrect';
    } else if (error?.reason) {
      errorMessage = error.reason;
    } else if (error?.message) {
      errorMessage = error.message;
    } else if (error?.errorMessage) {
      errorMessage = error.errorMessage;
    }

    if (retryCount < MAX_RETRIES && componentMountedRef.current) {
      const nextRetry = retryCount + 1;
      debugLog(`Scheduling retry ${nextRetry}/${MAX_RETRIES} in ${RETRY_DELAY}ms`);
      
      updateAsyncState({
        isJoining: false,
        currentStep: `Join failed, retrying in ${RETRY_DELAY / 1000}s... (${nextRetry}/${MAX_RETRIES})`
      });

      retryTimeoutRef.current = setTimeout(() => {
        if (componentMountedRef.current) {
          setRetryCount(nextRetry);
          hasAttemptedJoinRef.current = false;
          attemptJoin();
        }
      }, RETRY_DELAY);
    } else {
      debugLog('Max retries reached or component unmounted, stopping attempts');
      updateAsyncState({ 
        isJoining: false, 
        hasError: true,
        currentStep: 'Failed to join after maximum retries'
      });
      setError(errorMessage);
      onMeetingError?.(errorMessage);
    }
  }, [retryCount, updateAsyncState, onMeetingError, debugLog]);

  const attemptJoin = useCallback(async () => {
    if (!isReady || !componentMountedRef.current || hasAttemptedJoinRef.current || joinAttemptRef.current) {
      debugLog('Skipping join attempt:', {
        isReady,
        componentMounted: componentMountedRef.current,
        hasAttempted: hasAttemptedJoinRef.current,
        joinInProgress: !!joinAttemptRef.current
      });
      return;
    }

    hasAttemptedJoinRef.current = true;
    
    debugLog('Starting join attempt', { retryCount, meetingNumber, role });
    
    updateAsyncState({ 
      isJoining: true,
      currentStep: 'Getting fresh authentication tokens...'
    });

    try {
      // Get fresh tokens for this attempt
      debugLog('Requesting fresh tokens');
      const tokenData = await getZoomAccessToken(meetingNumber, role);
      
      debugLog('Fresh tokens received, preparing join config');
      updateAsyncState({ currentStep: 'Joining meeting with fresh tokens...' });

      const joinConfig = {
        sdkKey: tokenData.sdkKey,
        signature: tokenData.signature,
        meetingNumber: meetingNumber,
        userName: userName,
        userEmail: userName.includes('@') ? userName : undefined,
        passWord: meetingPassword,
        role: role,
        ...(role === 1 && tokenData.zak ? { zak: tokenData.zak } : {})
      };

      logFullConfig(joinConfig, 'join');

      // Validate required fields
      if (!joinConfig.sdkKey || !joinConfig.signature) {
        throw new Error('Missing required authentication tokens');
      }

      // Start join attempt
      joinAttemptRef.current = joinMeeting(joinConfig);
      await joinAttemptRef.current;

      debugLog('Join completed successfully');
      updateAsyncState({ 
        isJoining: false, 
        isJoined: true,
        currentStep: 'Successfully joined meeting'
      });
      onMeetingJoined?.();

    } catch (error) {
      handleJoinError(error);
    } finally {
      joinAttemptRef.current = null;
    }
  }, [isReady, meetingNumber, meetingPassword, userName, role, retryCount, joinMeeting, onMeetingJoined, handleJoinError, logFullConfig, updateAsyncState, debugLog]);

  // Initialize SDK when component mounts
  useEffect(() => {
    if (!asyncState.isInitializing && !asyncState.isInitialized && !asyncState.hasError) {
      debugLog('Starting SDK initialization');
      updateAsyncState({ 
        isInitializing: true,
        currentStep: 'Initializing Zoom SDK...'
      });
    }
  }, [asyncState, updateAsyncState, debugLog]);

  // Start join process when SDK is ready
  useEffect(() => {
    if (isReady && !asyncState.isJoining && !asyncState.isJoined && !hasAttemptedJoinRef.current && !error) {
      debugLog('SDK ready, starting join process');
      attemptJoin();
    }
  }, [isReady, asyncState.isJoining, asyncState.isJoined, error, attemptJoin, debugLog]);

  // Update joined state from hook
  useEffect(() => {
    if (isJoined && !asyncState.isJoined) {
      updateAsyncState({ isJoined: true });
    }
  }, [isJoined, asyncState.isJoined, updateAsyncState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      componentMountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      debugLog('Component unmounting, cleaning up');
      cleanup();
    };
  }, [cleanup, debugLog]);

  // Handle retry button
  const handleRetry = useCallback(() => {
    if (retryCount >= MAX_RETRIES) return;
    
    debugLog('Manual retry triggered');
    setError(null);
    hasAttemptedJoinRef.current = false;
    joinAttemptRef.current = null;
    updateAsyncState({ 
      hasError: false, 
      isJoining: false,
      currentStep: 'Retrying...'
    });
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    
    const nextRetry = retryCount + 1;
    setRetryCount(nextRetry);
    attemptJoin();
  }, [retryCount, updateAsyncState, attemptJoin, debugLog]);

  const isLoading = asyncState.isInitializing || asyncState.isJoining;
  const showError = error && !isLoading;

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        style={{ width: '900px', height: '506px' }}
        className="zoom-container mx-auto"
      />
      
      <ZoomLoadingOverlay
        isLoading={isLoading}
        currentStep={asyncState.currentStep}
        meetingNumber={meetingNumber}
        retryCount={retryCount}
        maxRetries={MAX_RETRIES}
      />
      
      {showError && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <ZoomErrorDisplay
            error={error}
            meetingNumber={meetingNumber}
            retryCount={retryCount}
            maxRetries={MAX_RETRIES}
            onRetry={handleRetry}
          />
        </div>
      )}
    </div>
  );
}

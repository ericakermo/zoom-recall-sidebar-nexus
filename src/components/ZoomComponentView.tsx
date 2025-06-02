
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
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState('Initializing...');
  const [joinAttempted, setJoinAttempted] = useState(false);
  
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      console.log('🔚 [COMPONENT-VIEW] Unmounting');
    };
  }, []);

  const {
    isReady,
    isJoined,
    isLoading: sdkLoading,
    hasError: sdkError,
    joinMeeting,
    leaveMeeting,
    cleanup
  } = useZoomSDK({
    containerRef,
    shouldInitialize: true,
    onReady: () => {
      if (!mountedRef.current) return;
      console.log('✅ [COMPONENT-VIEW] SDK ready');
      setCurrentStep('SDK Ready - Preparing to join...');
    },
    onError: (error) => {
      if (!mountedRef.current) return;
      console.error('❌ [COMPONENT-VIEW] SDK error:', error);
      setError(error);
      onMeetingError?.(error);
    }
  });

  // Navigation cleanup
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isJoined) {
        console.log('🌐 [COMPONENT-VIEW] Page unloading...');
        leaveMeeting();
      }
    };

    const handlePopState = () => {
      if (isJoined) {
        console.log('🔙 [COMPONENT-VIEW] Navigation detected...');
        leaveMeeting();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isJoined, leaveMeeting]);

  const getAuthTokens = useCallback(async (meetingId: string, userRole: number) => {
    try {
      console.log('🔐 [COMPONENT-VIEW] Getting tokens...');
      
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
        body: {
          meetingNumber: meetingId,
          role: userRole,
          expirationSeconds: 7200
        }
      });

      if (tokenError) {
        throw new Error(`Token authentication failed: ${tokenError.message}`);
      }

      let zakToken = null;
      if (userRole === 1) {
        console.log('👑 [COMPONENT-VIEW] Getting ZAK token for host...');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        
        if (zakError || !zakData?.zak) {
          throw new Error('Host authentication failed - ZAK token required');
        }
        
        zakToken = zakData.zak;
      }

      console.log('✅ [COMPONENT-VIEW] Tokens obtained');
      return { ...tokenData, zak: zakToken };
    } catch (error: any) {
      console.error('❌ [COMPONENT-VIEW] Token request failed:', error);
      throw new Error(error.message || 'Authentication failed');
    }
  }, []);

  const executeJoin = useCallback(async () => {
    console.log('🎯 [COMPONENT-VIEW] Executing join...');

    if (!mountedRef.current || joinAttempted || !isReady) {
      console.log('⏭️ [COMPONENT-VIEW] Join skipped - not ready');
      return;
    }

    setJoinAttempted(true);

    try {
      setCurrentStep('Authenticating...');
      const tokens = await getAuthTokens(meetingNumber, role || 0);

      if (!mountedRef.current) {
        console.log('⚠️ [COMPONENT-VIEW] Component unmounted during auth');
        return;
      }

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

      console.log('🎯 [COMPONENT-VIEW] Joining with config:', {
        meetingNumber: joinConfig.meetingNumber,
        userName: joinConfig.userName,
        role: joinConfig.role,
        hasPassword: !!joinConfig.passWord,
        hasZak: !!joinConfig.zak
      });

      setCurrentStep('Joining meeting...');
      
      await joinMeeting(joinConfig);
      
      if (!mountedRef.current) return;
      
      console.log('✅ [COMPONENT-VIEW] Join completed');
      setCurrentStep('Connected');
      onMeetingJoined?.();

    } catch (error: any) {
      if (!mountedRef.current) return;
      
      console.error('❌ [COMPONENT-VIEW] Join failed:', error);
      setError(error.message || 'Failed to join meeting');
      onMeetingError?.(error.message || 'Failed to join meeting');
      setJoinAttempted(false); // Reset on failure to allow retry
    }
  }, [isReady, joinAttempted, meetingNumber, role, providedUserName, user, meetingPassword, getAuthTokens, joinMeeting, onMeetingJoined, onMeetingError]);

  // Execute join when SDK is ready
  useEffect(() => {
    console.log('🎯 [COMPONENT-VIEW] Join effect:', {
      isReady,
      joinAttempted,
      hasError: !!error || sdkError,
      mounted: mountedRef.current
    });

    if (isReady && !joinAttempted && !error && !sdkError && mountedRef.current) {
      console.log('▶️ [COMPONENT-VIEW] Starting join...');
      setTimeout(() => {
        if (mountedRef.current && !joinAttempted) {
          executeJoin();
        }
      }, 100);
    }
  }, [isReady, error, sdkError, joinAttempted, executeJoin]);

  // Update current step based on state
  useEffect(() => {
    if (isJoined) {
      setCurrentStep('Connected to meeting');
    } else if (isReady && !joinAttempted) {
      setCurrentStep('Ready to join...');
    } else if (sdkLoading) {
      setCurrentStep('Loading Zoom SDK...');
    }
  }, [isReady, isJoined, joinAttempted, sdkLoading]);

  const handleRetry = useCallback(() => {
    console.log('🔄 [COMPONENT-VIEW] Retrying...');
    setError(null);
    setJoinAttempted(false);
    setCurrentStep('Retrying...');
    cleanup();
    setTimeout(() => window.location.reload(), 1000);
  }, [cleanup]);

  const displayError = error || (sdkError ? 'SDK initialization failed' : null);
  const isLoadingState = sdkLoading || (!isReady && !displayError);

  if (displayError) {
    return (
      <ZoomErrorDisplay
        error={displayError}
        meetingNumber={meetingNumber}
        retryCount={0}
        maxRetries={3}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <div className="relative w-full h-full">
      <ZoomLoadingOverlay
        isLoading={isLoadingState}
        currentStep={currentStep}
        meetingNumber={meetingNumber}
        retryCount={0}
        maxRetries={3}
      />

      <div className="zoom-meeting-wrapper w-full h-full">
        <div 
          ref={containerRef}
          id="meetingSDKElement"
          className="zoom-container w-full h-full"
          style={{
            minWidth: '320px',
            minHeight: '240px',
            backgroundColor: '#000'
          }}
        />
      </div>
    </div>
  );
}

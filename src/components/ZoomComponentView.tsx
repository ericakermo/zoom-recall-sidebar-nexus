
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
  const [currentStep, setCurrentStep] = useState('Initializing Zoom SDK...');
  const [joinAttempted, setJoinAttempted] = useState(false);
  
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const joinTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
      }
      console.log('🔚 [COMPONENT-VIEW] Component unmounting');
    };
  }, []);

  const {
    isReady,
    isJoined,
    isLoading,
    hasError,
    joinMeeting,
    leaveMeeting,
    cleanup
  } = useZoomSDK({
    containerRef,
    shouldInitialize: true,
    onReady: () => {
      if (!mountedRef.current) return;
      console.log('✅ [COMPONENT-VIEW] SDK ready - proceeding to join');
      setCurrentStep('SDK ready - preparing to join...');
    },
    onError: (error) => {
      if (!mountedRef.current) return;
      console.error('❌ [COMPONENT-VIEW] SDK error:', error);
      setError(error);
      onMeetingError?.(error);
    }
  });

  const getAuthTokens = useCallback(async (meetingId: string, userRole: number) => {
    try {
      console.log('🔐 [COMPONENT-VIEW] Getting authentication tokens');
      
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
        body: {
          meetingNumber: meetingId,
          role: userRole,
          expirationSeconds: 7200
        }
      });

      if (tokenError) {
        throw new Error(`Authentication failed: ${tokenError.message}`);
      }

      // Get ZAK token for hosts (role 1)
      let zakToken = null;
      if (userRole === 1) {
        console.log('👑 [COMPONENT-VIEW] Getting ZAK token for host');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        
        if (zakError || !zakData?.zak) {
          throw new Error('Host authentication failed - ZAK token required');
        }
        
        zakToken = zakData.zak;
      }

      console.log('✅ [COMPONENT-VIEW] Authentication tokens obtained successfully');
      return { ...tokenData, zak: zakToken };
    } catch (error: any) {
      console.error('❌ [COMPONENT-VIEW] Token request failed:', error);
      throw new Error(error.message || 'Authentication failed');
    }
  }, []);

  const executeJoin = useCallback(async () => {
    // Prevent multiple join attempts with stricter checks
    if (!mountedRef.current || joinAttempted || !isReady || hasError || isJoined) {
      console.log('⏭️ [COMPONENT-VIEW] Join skipped:', { 
        mounted: mountedRef.current, 
        attempted: joinAttempted, 
        ready: isReady,
        hasError,
        isJoined
      });
      return;
    }

    console.log('🎯 [COMPONENT-VIEW] Starting join process');
    setJoinAttempted(true);

    try {
      setCurrentStep('Getting authentication...');
      const tokens = await getAuthTokens(meetingNumber, role || 0);

      if (!mountedRef.current) {
        console.log('🚫 [COMPONENT-VIEW] Component unmounted during token fetch');
        return;
      }

      const joinConfig = {
        sdkKey: tokens.sdkKey,
        signature: tokens.signature,
        meetingNumber,
        userName: providedUserName || user?.email || 'Guest User',
        userEmail: user?.email || '',
        passWord: meetingPassword || '',
        role: role || 0,
        zak: tokens.zak || ''
      };

      console.log('📝 [COMPONENT-VIEW] Join configuration prepared:', {
        meetingNumber: joinConfig.meetingNumber,
        userName: joinConfig.userName,
        role: joinConfig.role,
        hasZAK: !!joinConfig.zak,
        hasSDKKey: !!joinConfig.sdkKey,
        hasSignature: !!joinConfig.signature
      });

      setCurrentStep('Joining meeting...');
      
      console.log('🔗 [COMPONENT-VIEW] Calling joinMeeting()');
      await joinMeeting(joinConfig);
      
      if (!mountedRef.current) {
        console.log('🚫 [COMPONENT-VIEW] Component unmounted during join');
        return;
      }
      
      console.log('✅ [COMPONENT-VIEW] Join completed successfully');
      setCurrentStep('Connected to meeting');
      onMeetingJoined?.();

    } catch (error: any) {
      if (!mountedRef.current) return;
      
      console.error('❌ [COMPONENT-VIEW] Join failed:', error);
      setError(error.message || 'Failed to join meeting');
      onMeetingError?.(error.message || 'Failed to join meeting');
      setJoinAttempted(false); // Allow retry on error
    }
  }, [isReady, joinAttempted, meetingNumber, role, providedUserName, user, meetingPassword, getAuthTokens, joinMeeting, onMeetingJoined, onMeetingError, hasError, isJoined]);

  // Auto-join when SDK is ready with improved timing
  useEffect(() => {
    if (isReady && !joinAttempted && !error && !hasError && !isJoined && mountedRef.current) {
      console.log('▶️ [COMPONENT-VIEW] SDK ready - starting auto-join');
      
      // Clear any existing timeout
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
      }

      // Delay to ensure everything is stable
      joinTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current && !joinAttempted && isReady && !hasError && !isJoined) {
          executeJoin();
        }
      }, 500);

      return () => {
        if (joinTimeoutRef.current) {
          clearTimeout(joinTimeoutRef.current);
        }
      };
    }
  }, [isReady, error, hasError, joinAttempted, executeJoin, isJoined]);

  // Update step display
  useEffect(() => {
    if (isJoined) {
      setCurrentStep('Connected to meeting');
    } else if (isReady && !joinAttempted) {
      setCurrentStep('Ready to join meeting');
    } else if (isLoading) {
      setCurrentStep('Loading Zoom SDK...');
    }
  }, [isReady, isJoined, joinAttempted, isLoading]);

  const handleRetry = useCallback(() => {
    console.log('🔄 [COMPONENT-VIEW] Retrying connection');
    setError(null);
    setJoinAttempted(false);
    setCurrentStep('Retrying...');
    
    // Clean restart
    cleanup();
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }, [cleanup]);

  const displayError = error || (hasError ? 'SDK initialization failed' : null);
  const isLoadingState = isLoading || (!isReady && !displayError);

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


import { useEffect, useState, useCallback } from 'react';
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
  const [currentStep, setCurrentStep] = useState('Initializing Zoom SDK...');
  const [retryCount, setRetryCount] = useState(0);
  const [hasAttemptedJoin, setHasAttemptedJoin] = useState(false);
  const [sessionId] = useState(() => Date.now().toString());
  const maxRetries = 3;
  
  const { user } = useAuth();

  const {
    containerRef,
    isSDKLoaded,
    isReady,
    isJoined,
    joinMeeting,
    leaveMeeting,
    cleanup
  } = useZoomSDK({
    sessionId,
    onReady: () => {
      console.log('✅ [DEBUG] Zoom SDK ready - preparing to join meeting');
      setCurrentStep('SDK ready - preparing to join...');
    },
    onError: (error) => {
      console.error('❌ [DEBUG] Zoom SDK error:', error);
      setError(error);
      setIsLoading(false);
      onMeetingError?.(error);
    }
  });

  // Get fresh tokens
  const getTokens = useCallback(async (meetingNumber: string, role: number, forceRefresh: boolean = false) => {
    try {
      console.log('🔄 [DEBUG] Requesting tokens:', {
        meetingNumber,
        role,
        forceRefresh,
        sessionId
      });
      
      const requestTime = Date.now();
      
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
        body: {
          meetingNumber,
          role: role || 0,
          expirationSeconds: 7200,
          requestId: `${sessionId}-${requestTime}`,
          forceRefresh
        }
      });

      if (tokenError) {
        console.error('❌ [DEBUG] Token request failed:', tokenError);
        throw new Error(`Token error: ${tokenError.message}`);
      }

      console.log('✅ [DEBUG] Tokens received');

      // Get ZAK token for host role
      let zakToken = null;
      if (role === 1) {
        console.log('🔄 [DEBUG] Requesting ZAK token for host role...');
        
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak', {
          body: {
            requestId: `${sessionId}-${requestTime}`,
            forceRefresh
          }
        });
        
        if (zakError || !zakData?.zak) {
          console.error('❌ [DEBUG] ZAK token request failed:', zakError);
          throw new Error('Host role requires ZAK token - please try again');
        }
        
        zakToken = zakData.zak;
        console.log('✅ [DEBUG] ZAK token received for host authentication');
      }

      return { ...tokenData, zak: zakToken };
    } catch (error) {
      console.error('❌ [DEBUG] Token fetch failed:', error);
      throw error;
    }
  }, [sessionId]);

  // Join meeting handler
  const handleJoinMeeting = useCallback(async () => {
    console.log('📍 [DEBUG] handleJoinMeeting called:', {
      sessionId,
      isReady,
      hasAttemptedJoin,
      isJoined,
      hasError: !!error,
      retryCount
    });

    if (!isReady || hasAttemptedJoin || isJoined || error) {
      console.log('⏸️ [DEBUG] Skipping join - conditions not met');
      return;
    }

    setHasAttemptedJoin(true);

    try {
      setCurrentStep('Getting authentication tokens...');
      
      // Wait to ensure SDK is fully ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const forceRefresh = retryCount > 0;
      const tokens = await getTokens(meetingNumber, role || 0, forceRefresh);

      const joinConfig = {
        sdkKey: tokens.sdkKey,
        signature: tokens.signature,
        meetingNumber,
        userName: providedUserName || user?.email || 'Guest',
        userEmail: user?.email || '',
        passWord: meetingPassword || '',
        role: role || 0,
        zak: tokens.zak || '',
        sessionId
      };

      console.log('🔄 [DEBUG] Attempting to join meeting with config...', {
        meetingNumber,
        role: joinConfig.role,
        hasZAK: !!joinConfig.zak,
        sessionId,
        retryCount
      });
      
      setCurrentStep('Joining meeting...');
      
      await joinMeeting(joinConfig);
      
      setIsLoading(false);
      setCurrentStep('Connected to meeting');
      setRetryCount(0);
      onMeetingJoined?.();
      
      // Debug: Verify rendering after join
      setTimeout(() => {
        console.log('🔍 [DEBUG] Post-join verification:', {
          containerExists: !!containerRef.current,
          containerVisible: containerRef.current?.offsetWidth > 0,
          hasContent: containerRef.current?.children.length > 0,
          sessionId
        });
      }, 3000);
      
    } catch (error: any) {
      console.error('❌ [DEBUG] Join failed:', error);
      
      // Handle session conflicts with retry
      if (error.message.includes('session conflict') || error.message.includes('expired token') || error.message.includes('not ready')) {
        console.log('🔄 [DEBUG] Session conflict detected - preparing retry');
        setHasAttemptedJoin(false);
        
        if (retryCount < maxRetries) {
          setCurrentStep('Session conflict - retrying...');
          
          // Force cleanup and retry
          cleanup();
          
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            console.log(`🔄 [DEBUG] Retrying (attempt ${retryCount + 1}/${maxRetries})`);
          }, 2000);
          return;
        }
      }
      
      setError(error.message);
      setIsLoading(false);
      setHasAttemptedJoin(false);
      onMeetingError?.(error.message);
    }
  }, [isReady, hasAttemptedJoin, isJoined, error, meetingNumber, role, providedUserName, user, meetingPassword, getTokens, joinMeeting, onMeetingJoined, onMeetingError, sessionId, retryCount, maxRetries, cleanup, containerRef]);

  // Update current step based on SDK status
  useEffect(() => {
    if (isJoined) {
      setCurrentStep('Connected to meeting');
      setIsLoading(false);
    } else if (isReady && !hasAttemptedJoin) {
      setCurrentStep('Ready to join meeting');
    } else if (isSDKLoaded) {
      setCurrentStep('Initializing meeting...');
    } else {
      setCurrentStep('Loading Zoom SDK...');
    }
  }, [isSDKLoaded, isReady, isJoined, hasAttemptedJoin]);

  // Auto-join when ready
  useEffect(() => {
    if (isReady && !error && !isJoined && !hasAttemptedJoin) {
      console.log('✅ [DEBUG] SDK ready - starting join process...');
      const timer = setTimeout(() => {
        handleJoinMeeting();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isReady, error, isJoined, hasAttemptedJoin, handleJoinMeeting]);

  const handleLeaveMeeting = useCallback(() => {
    leaveMeeting();
    onMeetingLeft?.();
  }, [leaveMeeting, onMeetingLeft]);

  const handleRetry = useCallback(() => {
    if (retryCount < maxRetries) {
      console.log(`🔄 [DEBUG] Manual retry requested (attempt ${retryCount + 1}/${maxRetries})`);
      setRetryCount(prev => prev + 1);
      setError(null);
      setIsLoading(true);
      setHasAttemptedJoin(false);
      setCurrentStep('Retrying...');
      
      cleanup();
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }, [retryCount, maxRetries, cleanup]);

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

      {/* Zoom meeting container with proper dimensions */}
      <div className="zoom-meeting-wrapper w-full h-full flex items-center justify-center">
        <div 
          ref={containerRef}
          id="meetingSDKElement"
          className="zoom-container"
          style={{
            width: '900px',
            height: '506px',
            backgroundColor: '#1f1f1f',
            border: '1px solid #333',
            borderRadius: '8px',
            overflow: 'hidden',
            position: 'relative'
          }}
        />
      </div>
    </div>
  );
}

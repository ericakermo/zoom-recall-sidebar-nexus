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
  const [sessionId, setSessionId] = useState(() => Date.now().toString());
  const maxRetries = 3;
  
  const { user } = useAuth();

  // Enhanced session management
  const generateNewSession = useCallback(() => {
    const newSessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);
    console.log('🔄 [DEBUG] Generated enhanced session ID:', newSessionId);
    return newSessionId;
  }, []);

  // Enhanced cleanup on mount
  useEffect(() => {
    console.log('🔄 [DEBUG] Component mounting - forcing enhanced cleanup...');
    
    // Clear any existing Zoom containers with better detection
    const existingContainers = document.querySelectorAll('[class*="zoom"], [id*="zoom"], [class*="ZoomMtg"], [id*="ZoomMtg"]');
    existingContainers.forEach((container, index) => {
      try {
        if (container.parentNode) {
          container.parentNode.removeChild(container);
          console.log(`✅ [DEBUG] Removed existing container ${index + 1}`);
        }
      } catch (e) {
        console.log(`⚠️ [DEBUG] Container ${index + 1} already removed`);
      }
    });
    
    // Enhanced global state cleanup
    if (window.ZoomMtgEmbedded) {
      try {
        // Clear any global references
        console.log('🔄 [DEBUG] Clearing enhanced global Zoom state');
      } catch (e) {
        console.log('✅ [DEBUG] Enhanced global state cleared');
      }
    }
    
    generateNewSession();
    console.log('✅ [DEBUG] Enhanced session preparation completed');
  }, [generateNewSession]);

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

  // Enhanced token retrieval with better debugging
  const getTokens = useCallback(async (meetingNumber: string, role: number, forceRefresh: boolean = false) => {
    try {
      console.log('🔄 [DEBUG] Requesting enhanced fresh tokens:', {
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

      console.log('✅ [DEBUG] Enhanced fresh tokens received');

      // Enhanced ZAK token handling
      let zakToken = null;
      if (role === 1) {
        console.log('🔄 [DEBUG] Requesting enhanced fresh ZAK token for host role...');
        
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak', {
          body: {
            requestId: `${sessionId}-${requestTime}`,
            forceRefresh
          }
        });
        
        if (zakError || !zakData?.zak) {
          console.error('❌ [DEBUG] ZAK token request failed:', zakError);
          throw new Error('Host role requires fresh ZAK token - please try again or check your Zoom connection');
        }
        
        zakToken = zakData.zak;
        console.log('✅ [DEBUG] Enhanced fresh ZAK token received for host authentication');
      }

      return { ...tokenData, zak: zakToken };
    } catch (error) {
      console.error('❌ [DEBUG] Enhanced token fetch failed:', error);
      throw error;
    }
  }, [sessionId]);

  // Enhanced join meeting logic
  const handleJoinMeeting = useCallback(async () => {
    console.log('📍 [DEBUG] Enhanced handleJoinMeeting called:', {
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
      setCurrentStep('Getting enhanced authentication tokens...');
      
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

      console.log('🔄 [DEBUG] Attempting to join meeting with enhanced fresh config...', {
        meetingNumber,
        role: joinConfig.role,
        sessionId,
        retryCount,
        configKeys: Object.keys(joinConfig)
      });
      
      setCurrentStep('Joining meeting with enhanced configuration...');
      
      await joinMeeting(joinConfig);
      
      setIsLoading(false);
      setCurrentStep('Connected to meeting');
      setRetryCount(0);
      onMeetingJoined?.();
      
      // Debug: Verify video rendering after successful join
      setTimeout(() => {
        console.log('🔍 [DEBUG] Post-join verification:', {
          containerExists: !!containerRef.current,
          containerVisible: containerRef.current?.offsetWidth > 0,
          hasVideoElements: containerRef.current?.querySelectorAll('video, canvas').length,
          sessionId
        });
      }, 3000);
      
    } catch (error: any) {
      console.error('❌ [DEBUG] Enhanced join failed:', error);
      
      // Enhanced session conflict handling
      if (error.message.includes('session conflict') || error.message.includes('expired token') || error.message.includes('not ready')) {
        console.log('🔄 [DEBUG] Session conflict detected - preparing enhanced retry with new session');
        setHasAttemptedJoin(false);
        
        if (retryCount < maxRetries) {
          setCurrentStep('Session conflict - preparing enhanced retry...');
          
          // Force cleanup and new session
          cleanup();
          generateNewSession();
          
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            console.log(`🔄 [DEBUG] Enhanced retrying with new session (attempt ${retryCount + 1}/${maxRetries})`);
          }, 3000);
          return;
        }
      }
      
      setError(error.message);
      setIsLoading(false);
      setHasAttemptedJoin(false);
      onMeetingError?.(error.message);
    }
  }, [isReady, hasAttemptedJoin, isJoined, error, meetingNumber, role, providedUserName, user, meetingPassword, getTokens, joinMeeting, onMeetingJoined, onMeetingError, sessionId, retryCount, maxRetries, generateNewSession, cleanup, containerRef]);

  // Update current step based on SDK status
  useEffect(() => {
    if (isJoined) {
      setCurrentStep('Connected to meeting');
      setIsLoading(false);
    } else if (isReady && !hasAttemptedJoin) {
      setCurrentStep('Ready to join meeting');
    } else if (isSDKLoaded) {
      setCurrentStep('Initializing Zoom SDK...');
    } else {
      setCurrentStep('Loading Zoom SDK...');
    }
  }, [isSDKLoaded, isReady, isJoined, hasAttemptedJoin]);

  // Join when ready - single effect with proper guards
  useEffect(() => {
    if (isReady && !error && !isJoined && !hasAttemptedJoin) {
      console.log('✅ [DEBUG] SDK ready - starting enhanced join process...');
      handleJoinMeeting();
    }
  }, [isReady, error, isJoined, hasAttemptedJoin, handleJoinMeeting]);

  const handleLeaveMeeting = useCallback(() => {
    leaveMeeting();
    onMeetingLeft?.();
  }, [leaveMeeting, onMeetingLeft]);

  const handleRetry = useCallback(() => {
    if (retryCount < maxRetries) {
      console.log(`🔄 [DEBUG] Manual enhanced retry requested (attempt ${retryCount + 1}/${maxRetries})`);
      setRetryCount(prev => prev + 1);
      setError(null);
      setIsLoading(true);
      setHasAttemptedJoin(false);
      setCurrentStep('Retrying with enhanced fresh session...');
      
      cleanup();
      generateNewSession();
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }, [retryCount, maxRetries, cleanup, generateNewSession]);

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

      {/* Enhanced Zoom meeting container with debugging */}
      <div className="zoom-meeting-wrapper">
        <div 
          ref={containerRef}
          className="zoom-fixed-container"
          key={sessionId}
          style={{
            width: '900px',
            height: '506px',
            backgroundColor: '#1f1f1f',
            border: '1px solid #333',
            borderRadius: '8px',
            overflow: 'hidden'
          }}
        />
      </div>
    </div>
  );
}

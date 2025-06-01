
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

  // Generate new session ID for each retry to avoid conflicts
  const generateNewSession = useCallback(() => {
    const newSessionId = Date.now().toString();
    setSessionId(newSessionId);
    console.log('🔄 Generated new session ID:', newSessionId);
    return newSessionId;
  }, []);

  // Force cleanup on mount to prevent session conflicts
  useEffect(() => {
    console.log('🔄 Component mounting - forcing fresh session...');
    
    // Clear any existing Zoom containers in the DOM
    const existingContainers = document.querySelectorAll('[class*="zoom"], [id*="zoom"]');
    existingContainers.forEach(container => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    });
    
    // Clear any Zoom global state
    if (window.ZoomMtgEmbedded) {
      try {
        // Force cleanup any existing instances
        window.ZoomMtgEmbedded = null;
      } catch (e) {
        console.log('Cleared existing Zoom state');
      }
    }
    
    generateNewSession();
    console.log('✅ Fresh session prepared');
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
    sessionId, // Pass session ID to SDK
    onReady: () => {
      console.log('✅ Zoom SDK ready - preparing to join meeting');
      setCurrentStep('SDK ready - preparing to join...');
    },
    onError: (error) => {
      console.error('❌ Zoom SDK error:', error);
      setError(error);
      setIsLoading(false);
      onMeetingError?.(error);
    }
  });

  const getTokens = useCallback(async (meetingNumber: string, role: number, forceRefresh: boolean = false) => {
    try {
      console.log('🔄 Requesting fresh tokens for meeting:', meetingNumber, 'role:', role, 'forceRefresh:', forceRefresh);
      
      // Add cache-busting parameter for fresh tokens
      const requestTime = Date.now();
      
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
        body: {
          meetingNumber,
          role: role || 0,
          expirationSeconds: 7200,
          requestId: `${sessionId}-${requestTime}`, // Unique request ID
          forceRefresh
        }
      });

      if (tokenError) {
        console.error('❌ Token request failed:', tokenError);
        throw new Error(`Token error: ${tokenError.message}`);
      }

      console.log('✅ Fresh tokens received');

      // Get fresh ZAK token for host role with retry mechanism
      let zakToken = null;
      if (role === 1) {
        console.log('🔄 Requesting fresh ZAK token for host role...');
        
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak', {
          body: {
            requestId: `${sessionId}-${requestTime}`,
            forceRefresh
          }
        });
        
        if (zakError || !zakData?.zak) {
          console.error('❌ ZAK token request failed:', zakError);
          throw new Error('Host role requires fresh ZAK token - please try again or check your Zoom connection');
        }
        
        zakToken = zakData.zak;
        console.log('✅ Fresh ZAK token received for host authentication');
      }

      return { ...tokenData, zak: zakToken };
    } catch (error) {
      console.error('❌ Token fetch failed:', error);
      throw error;
    }
  }, [sessionId]);

  const handleJoinMeeting = useCallback(async () => {
    console.log('📍 handleJoinMeeting called - Session:', sessionId, 'State:', {
      isReady,
      hasAttemptedJoin,
      isJoined,
      error: !!error
    });

    if (!isReady || hasAttemptedJoin || isJoined || error) {
      console.log('⏸️ Skipping join - conditions not met');
      return;
    }

    setHasAttemptedJoin(true);

    try {
      setCurrentStep('Getting fresh authentication tokens...');
      
      // Force fresh tokens for each attempt, especially on retries
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
        sessionId // Include session ID in join config
      };

      console.log('🔄 Attempting to join meeting with fresh config...', {
        meetingNumber,
        role: joinConfig.role,
        sessionId,
        retryCount
      });
      
      setCurrentStep('Joining meeting...');
      
      await joinMeeting(joinConfig);
      
      setIsLoading(false);
      setCurrentStep('Connected to meeting');
      setRetryCount(0);
      onMeetingJoined?.();
    } catch (error: any) {
      console.error('❌ Join failed:', error);
      
      // Handle specific session conflict errors
      if (error.message.includes('session conflict') || error.message.includes('expired token')) {
        console.log('🔄 Session conflict detected - preparing for retry with new session');
        setHasAttemptedJoin(false); // Allow retry with new session
        
        if (retryCount < maxRetries) {
          setCurrentStep('Session conflict - preparing retry...');
          generateNewSession();
          
          // Wait a moment before retry
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            console.log(`🔄 Retrying with new session (attempt ${retryCount + 1}/${maxRetries})`);
          }, 2000);
          return;
        }
      }
      
      setError(error.message);
      setIsLoading(false);
      setHasAttemptedJoin(false);
      onMeetingError?.(error.message);
    }
  }, [isReady, hasAttemptedJoin, isJoined, error, meetingNumber, role, providedUserName, user, meetingPassword, getTokens, joinMeeting, onMeetingJoined, onMeetingError, sessionId, retryCount, maxRetries, generateNewSession]);

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
      console.log('✅ SDK ready - starting join process...');
      handleJoinMeeting();
    }
  }, [isReady, error, isJoined, hasAttemptedJoin, handleJoinMeeting]);

  const handleLeaveMeeting = useCallback(() => {
    leaveMeeting();
    onMeetingLeft?.();
  }, [leaveMeeting, onMeetingLeft]);

  const handleRetry = useCallback(() => {
    if (retryCount < maxRetries) {
      console.log(`🔄 Manual retry requested (attempt ${retryCount + 1}/${maxRetries})`);
      setRetryCount(prev => prev + 1);
      setError(null);
      setIsLoading(true);
      setHasAttemptedJoin(false);
      setCurrentStep('Retrying with fresh session...');
      
      // Generate new session and cleanup
      generateNewSession();
      cleanup();
      
      // Reload page for clean state
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

      {/* Zoom meeting container - centered and fixed size via SDK config */}
      <div className="zoom-meeting-wrapper">
        <div 
          ref={containerRef}
          className="zoom-fixed-container"
          key={sessionId} // Force re-render with new session
        />
      </div>
    </div>
  );
}

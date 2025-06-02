
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useZoomSDK } from '@/hooks/useZoomSDK';
import { ZoomLoadingOverlay } from '@/components/zoom/ZoomLoadingOverlay';
import { ZoomErrorDisplay } from '@/components/zoom/ZoomErrorDisplay';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';

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
  const [currentStep, setCurrentStep] = useState('Initializing...');
  const [retryCount, setRetryCount] = useState(0);
  const [hasAttemptedJoin, setHasAttemptedJoin] = useState(false);
  const maxRetries = 3;
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const currentLocationRef = useRef(location.pathname);

  // Track location changes for cleanup
  useEffect(() => {
    currentLocationRef.current = location.pathname;
  }, [location.pathname]);

  // Cleanup on unmount and navigation
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      console.log('🔚 [COMPONENT-VIEW-DEBUG] Component unmounting');
    };
  }, []);

  // Navigation cleanup effect
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isMeetingJoined && leaveMeeting) {
        console.log('🌐 [COMPONENT-VIEW-DEBUG] Page unloading, leaving meeting...');
        leaveMeeting();
      }
    };

    const handlePopState = () => {
      if (isMeetingJoined && leaveMeeting) {
        console.log('🔙 [COMPONENT-VIEW-DEBUG] Navigation detected, leaving meeting...');
        leaveMeeting();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const {
    isSDKReady,
    isMeetingJoined,
    joinMeeting,
    leaveMeeting,
    cleanup
  } = useZoomSDK({
    containerRef,
    shouldInitialize: true,
    onReady: () => {
      if (!mountedRef.current) return;
      console.log('🎉 [COMPONENT-VIEW-DEBUG] SDK ready callback fired');
      setCurrentStep('SDK Ready - Preparing to join...');
    },
    onError: (error) => {
      if (!mountedRef.current) return;
      console.error('💥 [COMPONENT-VIEW-DEBUG] SDK error callback fired:', error);
      setError(error);
      setIsLoading(false);
      onMeetingError?.(error);
    }
  });

  // Enhanced container monitoring
  useEffect(() => {
    console.log('📦 [COMPONENT-VIEW-DEBUG] Container effect triggered');
    
    if (containerRef.current) {
      console.log('✅ [COMPONENT-VIEW-DEBUG] Container ref is available');
      
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            console.log('👶 [COMPONENT-VIEW-DEBUG] Container children changed:', {
              addedNodes: mutation.addedNodes.length,
              removedNodes: mutation.removedNodes.length,
              childElementCount: containerRef.current?.childElementCount
            });
          }
        });
      });

      observer.observe(containerRef.current, { 
        childList: true, 
        subtree: true 
      });

      // Log container dimensions periodically
      const checkDimensions = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          console.log('📐 [COMPONENT-VIEW-DEBUG] Container dimensions:', {
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0
          });
        }
      };

      checkDimensions();
      const dimensionInterval = setInterval(checkDimensions, 2000);

      return () => {
        observer.disconnect();
        clearInterval(dimensionInterval);
      };
    } else {
      console.log('❌ [COMPONENT-VIEW-DEBUG] Container ref is null');
    }
  }, []);

  const getAuthTokens = useCallback(async (meetingId: string, userRole: number) => {
    try {
      console.log('🔐 [COMPONENT-VIEW-DEBUG] Requesting authentication tokens...', {
        meetingId,
        userRole
      });
      
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

      console.log('✅ [COMPONENT-VIEW-DEBUG] Base tokens received successfully');

      let zakToken = null;
      if (userRole === 1) {
        console.log('👑 [COMPONENT-VIEW-DEBUG] Requesting ZAK token for host...');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        
        if (zakError || !zakData?.zak) {
          throw new Error('Host authentication failed - ZAK token required');
        }
        
        zakToken = zakData.zak;
        console.log('✅ [COMPONENT-VIEW-DEBUG] ZAK token obtained successfully');
      }

      const result = { ...tokenData, zak: zakToken };
      console.log('🎫 [COMPONENT-VIEW-DEBUG] All tokens prepared:', {
        hasSdkKey: !!result.sdkKey,
        hasSignature: !!result.signature,
        hasZak: !!result.zak
      });

      return result;
    } catch (error: any) {
      console.error('💥 [COMPONENT-VIEW-DEBUG] Token request failed:', error);
      throw new Error(error.message || 'Authentication failed');
    }
  }, []);

  const attemptJoinMeeting = useCallback(async () => {
    console.log('🎯 [COMPONENT-VIEW-DEBUG] attemptJoinMeeting called with state:', {
      mounted: mountedRef.current,
      hasAttemptedJoin,
      isSDKReady,
      retryCount,
      maxRetries
    });

    if (!mountedRef.current || hasAttemptedJoin || !isSDKReady) {
      console.log('⏭️ [COMPONENT-VIEW-DEBUG] Skipping join - conditions not met');
      return;
    }

    if (retryCount >= maxRetries) {
      setError('Maximum join attempts exceeded. Please refresh and try again.');
      setIsLoading(false);
      return;
    }

    setHasAttemptedJoin(true);
    setRetryCount(prev => prev + 1);

    try {
      setCurrentStep('Authenticating...');
      console.log('🔐 [COMPONENT-VIEW-DEBUG] Starting authentication process...');
      
      const tokens = await getAuthTokens(meetingNumber, role || 0);

      if (!mountedRef.current) {
        console.log('⚠️ [COMPONENT-VIEW-DEBUG] Component unmounted during token fetch');
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

      console.log('🎯 [COMPONENT-VIEW-DEBUG] Attempting join with config:', {
        sdkKey: joinConfig.sdkKey?.substring(0, 8) + '...',
        meetingNumber: joinConfig.meetingNumber,
        userName: joinConfig.userName,
        userEmail: joinConfig.userEmail,
        role: joinConfig.role,
        hasPassword: !!joinConfig.passWord,
        hasZak: !!joinConfig.zak
      });

      setCurrentStep('Joining meeting...');
      
      await joinMeeting(joinConfig);
      
      if (!mountedRef.current) {
        console.log('⚠️ [COMPONENT-VIEW-DEBUG] Component unmounted during join');
        return;
      }
      
      console.log('🎉 [COMPONENT-VIEW-DEBUG] Join attempt completed successfully');
      setIsLoading(false);
      setCurrentStep('Connected');
      onMeetingJoined?.();

    } catch (error: any) {
      setHasAttemptedJoin(false); // Reset on failure
      
      if (!mountedRef.current) {
        console.log('⚠️ [COMPONENT-VIEW-DEBUG] Component unmounted during error handling');
        return;
      }
      
      console.error('💥 [COMPONENT-VIEW-DEBUG] Join attempt failed:', error);
      
      const errorMessage = error.message || 'Failed to join meeting';
      
      if (retryCount < maxRetries) {
        console.log(`🔄 [COMPONENT-VIEW-DEBUG] Retrying join (${retryCount + 1}/${maxRetries})`);
        setCurrentStep(`Retrying... (${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          if (mountedRef.current) {
            attemptJoinMeeting();
          }
        }, 2000);
      } else {
        setError(errorMessage);
        setIsLoading(false);
        onMeetingError?.(errorMessage);
      }
    }
  }, [isSDKReady, retryCount, maxRetries, hasAttemptedJoin, meetingNumber, role, providedUserName, user, meetingPassword, getAuthTokens, joinMeeting, onMeetingJoined, onMeetingError]);

  // Enhanced join effect with better condition tracking
  useEffect(() => {
    console.log('🎯 [COMPONENT-VIEW-DEBUG] Join effect triggered with state:', {
      isSDKReady,
      hasAttemptedJoin,
      error: !!error,
      mounted: mountedRef.current
    });

    if (isSDKReady && !hasAttemptedJoin && !error && mountedRef.current) {
      console.log('✅ [COMPONENT-VIEW-DEBUG] All join conditions met, initiating join...');
      // Small delay to ensure SDK is fully ready
      setTimeout(() => {
        if (mountedRef.current && !hasAttemptedJoin) {
          attemptJoinMeeting();
        }
      }, 100);
    } else {
      console.log('⏭️ [COMPONENT-VIEW-DEBUG] Join conditions not met, waiting...');
    }
  }, [isSDKReady, error, hasAttemptedJoin, attemptJoinMeeting]);

  // Update loading states
  useEffect(() => {
    if (isMeetingJoined) {
      setCurrentStep('Connected to meeting');
      setIsLoading(false);
    } else if (isSDKReady && !hasAttemptedJoin) {
      setCurrentStep('Ready to join...');
    } else if (!isSDKReady) {
      setCurrentStep('Loading Zoom SDK...');
    }
  }, [isSDKReady, isMeetingJoined, hasAttemptedJoin]);

  const handleRetry = useCallback(() => {
    console.log('🔄 [COMPONENT-VIEW-DEBUG] Manual retry requested');
    setError(null);
    setIsLoading(true);
    setRetryCount(0);
    setHasAttemptedJoin(false);
    setCurrentStep('Retrying...');
    cleanup();
    setTimeout(() => window.location.reload(), 1000);
  }, [cleanup]);

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

      <div className="zoom-meeting-wrapper w-full h-full">
        <div 
          ref={containerRef}
          id="meetingSDKElement"
          className="zoom-container w-full h-full"
          style={{
            minWidth: '900px',
            minHeight: '506px',
            backgroundColor: '#000'
          }}
        />
      </div>
    </div>
  );
}

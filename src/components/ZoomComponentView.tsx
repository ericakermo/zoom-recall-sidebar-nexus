
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useZoomSDK } from '@/hooks/useZoomSDK';
import { ZoomLoadingOverlay } from '@/components/zoom/ZoomLoadingOverlay';
import { ZoomErrorDisplay } from '@/components/zoom/ZoomErrorDisplay';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

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
  const maxRetries = 3;
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const hasJoinedRef = useRef(false);
  const mountedRef = useRef(true);

  // Cleanup on unmount and navigation
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Listen for navigation changes and cleanup meeting
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasJoinedRef.current && leaveMeeting) {
        console.log('🔍 [COMPONENT-VIEW] Page unloading, leaving meeting...');
        leaveMeeting();
      }
    };

    const handlePopState = () => {
      if (hasJoinedRef.current && leaveMeeting) {
        console.log('🔍 [COMPONENT-VIEW] Navigation detected, leaving meeting...');
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
      console.log('🔍 [COMPONENT-VIEW] SDK ready for meeting join');
      setCurrentStep('Ready to join meeting...');
    },
    onError: (error) => {
      if (!mountedRef.current) return;
      console.error('🔍 [COMPONENT-VIEW] SDK error:', error);
      setError(error);
      setIsLoading(false);
      onMeetingError?.(error);
    }
  });

  // Force container to be ready by ensuring it's mounted
  useEffect(() => {
    if (containerRef.current) {
      console.log('🔍 [COMPONENT-VIEW] Container ref available');
      // Small delay to ensure DOM is fully ready
      const timer = setTimeout(() => {
        if (containerRef.current && mountedRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          console.log('🔍 [COMPONENT-VIEW] Container dimensions:', rect);
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const getAuthTokens = useCallback(async (meetingId: string, userRole: number) => {
    try {
      console.log('🔍 [COMPONENT-VIEW] Requesting authentication tokens...');
      
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
        console.log('🔍 [COMPONENT-VIEW] Requesting ZAK token for host...');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        
        if (zakError || !zakData?.zak) {
          throw new Error('Host authentication failed - ZAK token required');
        }
        
        zakToken = zakData.zak;
        console.log('🔍 [COMPONENT-VIEW] ZAK token obtained successfully');
      }

      return { ...tokenData, zak: zakToken };
    } catch (error: any) {
      console.error('🔍 [COMPONENT-VIEW] Token request failed:', error);
      throw new Error(error.message || 'Authentication failed');
    }
  }, []);

  const attemptJoinMeeting = useCallback(async () => {
    if (!mountedRef.current || hasJoinedRef.current || !isSDKReady) {
      console.log('🔍 [COMPONENT-VIEW] Skipping join - conditions not met:', {
        mounted: mountedRef.current,
        hasJoined: hasJoinedRef.current,
        isSDKReady
      });
      return;
    }

    if (retryCount >= maxRetries) {
      setError('Maximum join attempts exceeded. Please refresh and try again.');
      setIsLoading(false);
      return;
    }

    hasJoinedRef.current = true; // Prevent multiple attempts
    setRetryCount(prev => prev + 1);

    try {
      setCurrentStep('Authenticating...');
      const tokens = await getAuthTokens(meetingNumber, role || 0);

      if (!mountedRef.current) return;

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

      console.log('🔍 [COMPONENT-VIEW] Attempting join with validated config');
      setCurrentStep('Joining meeting...');
      
      await joinMeeting(joinConfig);
      
      if (!mountedRef.current) return;
      
      console.log('🔍 [COMPONENT-VIEW] Join successful');
      setIsLoading(false);
      setCurrentStep('Connected');
      onMeetingJoined?.();

    } catch (error: any) {
      hasJoinedRef.current = false; // Reset on failure
      
      if (!mountedRef.current) return;
      
      console.error('🔍 [COMPONENT-VIEW] Join failed:', error);
      
      const errorMessage = error.message || 'Failed to join meeting';
      
      if (retryCount < maxRetries) {
        console.log(`🔍 [COMPONENT-VIEW] Retrying join (${retryCount + 1}/${maxRetries})`);
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
  }, [isSDKReady, retryCount, maxRetries, meetingNumber, role, providedUserName, user, meetingPassword, getAuthTokens, joinMeeting, onMeetingJoined, onMeetingError]);

  // Join effect - triggered when SDK is ready
  useEffect(() => {
    if (isSDKReady && !hasJoinedRef.current && !error) {
      console.log('🔍 [COMPONENT-VIEW] SDK ready, initiating join...');
      attemptJoinMeeting();
    }
  }, [isSDKReady, error, attemptJoinMeeting]);

  // Update loading states
  useEffect(() => {
    if (isMeetingJoined) {
      setCurrentStep('Connected to meeting');
      setIsLoading(false);
    } else if (isSDKReady && !hasJoinedRef.current) {
      setCurrentStep('Ready to join...');
    } else {
      setCurrentStep('Loading Zoom SDK...');
    }
  }, [isSDKReady, isMeetingJoined]);

  const handleRetry = useCallback(() => {
    console.log('🔍 [COMPONENT-VIEW] Manual retry requested');
    setError(null);
    setIsLoading(true);
    setRetryCount(0);
    hasJoinedRef.current = false;
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


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
  const [currentStep, setCurrentStep] = useState('Initializing...');
  const [joinAttempts, setJoinAttempts] = useState(0);
  const maxAttempts = 3;
  
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const joinAttemptedRef = useRef(false);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const {
    isSDKLoaded,
    isReady,
    isJoined,
    joinMeeting,
    leaveMeeting,
    cleanup
  } = useZoomSDK({
    containerRef,
    shouldInitialize: true,
    onReady: () => {
      if (!mountedRef.current) return;
      console.log('🔍 [ZOOM] SDK ready for meeting join');
      setCurrentStep('Ready to join meeting...');
    },
    onError: (error) => {
      if (!mountedRef.current) return;
      console.error('🔍 [ZOOM] SDK error:', error);
      setError(error);
      setIsLoading(false);
      onMeetingError?.(error);
    }
  });

  const getAuthTokens = useCallback(async (meetingId: string, userRole: number) => {
    try {
      console.log('🔍 [ZOOM] Requesting authentication tokens...');
      
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
        console.log('🔍 [ZOOM] Requesting ZAK token for host...');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        
        if (zakError || !zakData?.zak) {
          throw new Error('Host authentication failed - ZAK token required');
        }
        
        zakToken = zakData.zak;
        console.log('🔍 [ZOOM] ZAK token obtained successfully');
      }

      return { ...tokenData, zak: zakToken };
    } catch (error: any) {
      console.error('🔍 [ZOOM] Token request failed:', error);
      throw new Error(error.message || 'Authentication failed');
    }
  }, []);

  const attemptJoinMeeting = useCallback(async () => {
    if (!mountedRef.current || joinAttemptedRef.current || isJoined || !isReady) {
      return;
    }

    if (joinAttempts >= maxAttempts) {
      setError('Maximum join attempts exceeded. Please refresh and try again.');
      setIsLoading(false);
      return;
    }

    joinAttemptedRef.current = true;
    setJoinAttempts(prev => prev + 1);

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

      console.log('🔍 [ZOOM] Attempting join with validated config');
      setCurrentStep('Joining meeting...');
      
      await joinMeeting(joinConfig);
      
      if (!mountedRef.current) return;
      
      console.log('🔍 [ZOOM] Join successful');
      setIsLoading(false);
      setCurrentStep('Connected');
      onMeetingJoined?.();

    } catch (error: any) {
      if (!mountedRef.current) return;
      
      console.error('🔍 [ZOOM] Join failed:', error);
      
      // Reset for potential retry
      joinAttemptedRef.current = false;
      
      const errorMessage = error.message || 'Failed to join meeting';
      
      if (joinAttempts < maxAttempts) {
        console.log(`🔍 [ZOOM] Retrying join (${joinAttempts + 1}/${maxAttempts})`);
        setCurrentStep(`Retrying... (${joinAttempts + 1}/${maxAttempts})`);
        // Wait before retry
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
  }, [isReady, isJoined, joinAttempts, maxAttempts, meetingNumber, role, providedUserName, user, meetingPassword, getAuthTokens, joinMeeting, onMeetingJoined, onMeetingError]);

  // Single join effect
  useEffect(() => {
    if (isReady && !joinAttemptedRef.current && !error && !isJoined) {
      console.log('🔍 [ZOOM] Conditions met, initiating join...');
      attemptJoinMeeting();
    }
  }, [isReady, error, isJoined, attemptJoinMeeting]);

  // Update loading states
  useEffect(() => {
    if (isJoined) {
      setCurrentStep('Connected to meeting');
      setIsLoading(false);
    } else if (isReady && !joinAttemptedRef.current) {
      setCurrentStep('Ready to join...');
    } else if (isSDKLoaded) {
      setCurrentStep('Initializing meeting interface...');
    } else {
      setCurrentStep('Loading Zoom SDK...');
    }
  }, [isSDKLoaded, isReady, isJoined]);

  const handleLeaveMeeting = useCallback(() => {
    console.log('🔍 [ZOOM] Leaving meeting');
    leaveMeeting();
    onMeetingLeft?.();
  }, [leaveMeeting, onMeetingLeft]);

  const handleRetry = useCallback(() => {
    console.log('🔍 [ZOOM] Manual retry requested');
    setError(null);
    setIsLoading(true);
    setJoinAttempts(0);
    joinAttemptedRef.current = false;
    setCurrentStep('Retrying...');
    cleanup();
    // Force page reload for clean state
    setTimeout(() => window.location.reload(), 1000);
  }, [cleanup]);

  if (error) {
    return (
      <ZoomErrorDisplay
        error={error}
        meetingNumber={meetingNumber}
        retryCount={joinAttempts}
        maxRetries={maxAttempts}
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
        retryCount={joinAttempts}
        maxRetries={maxAttempts}
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

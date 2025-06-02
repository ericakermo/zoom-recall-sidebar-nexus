
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
  onMeetingJoined?: (client: any) => void;
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
  const [hasJoinedSuccessfully, setHasJoinedSuccessfully] = useState(false);
  const maxRetries = 2;
  
  const { user } = useAuth();

  const {
    containerRef,
    isSDKLoaded,
    isReady,
    isJoined,
    joinMeeting,
    leaveMeeting,
    cleanup,
    client
  } = useZoomSDK({
    onReady: () => {
      console.log('✅ [COMPONENT-VIEW] SDK ready - proceeding to join');
      setCurrentStep('Preparing to join meeting...');
    },
    onError: (error) => {
      console.error('❌ [COMPONENT-VIEW] SDK error:', error);
      setError(error);
      setIsLoading(false);
      onMeetingError?.(error);
    }
  });

  const getTokens = useCallback(async (meetingNumber: string, role: number) => {
    try {
      console.log('🔐 [COMPONENT-VIEW] Getting authentication tokens');
      
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
        body: {
          meetingNumber,
          role: role || 0,
          expirationSeconds: 7200
        }
      });

      if (tokenError) {
        console.error('❌ [COMPONENT-VIEW] Token request failed:', tokenError);
        throw new Error(`Token error: ${tokenError.message}`);
      }

      // Get fresh ZAK token for host role
      let zakToken = null;
      if (role === 1) {
        console.log('👑 [COMPONENT-VIEW] Getting ZAK token for host');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        
        if (zakError || !zakData?.zak) {
          console.error('❌ [COMPONENT-VIEW] ZAK token request failed:', zakError);
          throw new Error('Host role requires fresh ZAK token - please try again or check your Zoom connection');
        }
        
        zakToken = zakData.zak;
      }

      console.log('✅ [COMPONENT-VIEW] Authentication tokens obtained successfully');
      return { ...tokenData, zak: zakToken };
    } catch (error) {
      console.error('❌ [COMPONENT-VIEW] Token fetch failed:', error);
      throw error;
    }
  }, []);

  const handleJoinMeeting = useCallback(async () => {
    if (!isReady || hasJoinedSuccessfully || isJoined) {
      console.log('⏸️ [COMPONENT-VIEW] Skipping join - already joined or not ready');
      return;
    }

    try {
      console.log('🎯 [COMPONENT-VIEW] Starting join process');
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

      console.log('📝 [COMPONENT-VIEW] Join configuration prepared:', {
        meetingNumber: joinConfig.meetingNumber,
        userName: joinConfig.userName,
        role: joinConfig.role,
        hasZAK: !!joinConfig.zak,
        hasSDKKey: !!joinConfig.sdkKey,
        hasSignature: !!joinConfig.signature
      });

      console.log('🔗 [COMPONENT-VIEW] Calling joinMeeting()');
      setCurrentStep('Joining meeting...');
      await joinMeeting(joinConfig);
      
      setHasJoinedSuccessfully(true);
      setIsLoading(false);
      setCurrentStep('Connected to meeting');
      setRetryCount(0);
      
      console.log('✅ [COMPONENT-VIEW] Join completed successfully');
      // Pass the client reference to parent
      onMeetingJoined?.(client);
    } catch (error: any) {
      console.error('❌ [COMPONENT-VIEW] Join failed:', error);
      setError(error.message);
      setIsLoading(false);
      onMeetingError?.(error.message);
    }
  }, [isReady, hasJoinedSuccessfully, isJoined, meetingNumber, role, providedUserName, user, meetingPassword, getTokens, joinMeeting, onMeetingJoined, client]);

  // Update current step based on SDK status
  useEffect(() => {
    if (isJoined && hasJoinedSuccessfully) {
      setCurrentStep('Connected to meeting');
      setIsLoading(false);
    } else if (isReady && !hasJoinedSuccessfully) {
      setCurrentStep('Ready to join meeting');
    } else if (isSDKLoaded) {
      setCurrentStep('Initializing Zoom SDK...');
    } else {
      setCurrentStep('Loading Zoom SDK...');
    }
  }, [isSDKLoaded, isReady, isJoined, hasJoinedSuccessfully]);

  // Join when ready (only if not already joined)
  useEffect(() => {
    if (isReady && !hasJoinedSuccessfully && !error) {
      console.log('▶️ [COMPONENT-VIEW] SDK ready - starting auto-join');
      handleJoinMeeting();
    }
  }, [isReady, hasJoinedSuccessfully, error, handleJoinMeeting]);

  const handleLeaveMeeting = useCallback(() => {
    leaveMeeting();
    setHasJoinedSuccessfully(false);
    onMeetingLeft?.();
  }, [leaveMeeting, onMeetingLeft]);

  const handleRetry = useCallback(() => {
    if (retryCount < maxRetries) {
      console.log(`🔄 [COMPONENT-VIEW] Retrying join attempt ${retryCount + 1}/${maxRetries}`);
      setRetryCount(prev => prev + 1);
      setError(null);
      setIsLoading(true);
      setHasJoinedSuccessfully(false);
      setCurrentStep('Retrying with fresh session...');
      
      // Clean up and retry
      cleanup();
      setTimeout(() => {
        handleJoinMeeting();
      }, 1000); // Brief delay to ensure cleanup
    } else {
      console.warn('⚠️ [COMPONENT-VIEW] Max retry attempts reached');
      setError('Maximum retry attempts reached. Please refresh the page to try again.');
    }
  }, [retryCount, maxRetries, handleJoinMeeting, cleanup]);

  // Cleanup only when component unmounts, not when successfully joined
  useEffect(() => {
    return () => {
      if (!hasJoinedSuccessfully) {
        console.log('🔚 [COMPONENT-VIEW] Component unmounting - no successful join');
      } else {
        console.log('🔚 [COMPONENT-VIEW] Component unmounting - had successful join');
      }
    };
  }, [hasJoinedSuccessfully]);

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
    <div className="absolute inset-0">
      <ZoomLoadingOverlay
        isLoading={isLoading}
        currentStep={currentStep}
        meetingNumber={meetingNumber}
        retryCount={retryCount}
        maxRetries={maxRetries}
      />

      {/* Zoom meeting container - fixed positioned to fill parent */}
      <div 
        ref={containerRef}
        className="absolute inset-0"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1
        }}
      />
    </div>
  );
}

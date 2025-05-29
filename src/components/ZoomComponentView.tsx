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
  const [hasJoinedOnce, setHasJoinedOnce] = useState(false);
  const maxRetries = 3; // Increased retries for better reliability
  
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
    onReady: () => {
      console.log('✅ Zoom SDK ready');
      setCurrentStep('Preparing to join meeting...');
    },
    onError: (error) => {
      console.error('❌ Zoom SDK error:', error);
      setError(error);
      setIsLoading(false);
      onMeetingError?.(error);
    }
  });

  const getTokens = useCallback(async (meetingNumber: string, role: number) => {
    try {
      console.log('🔄 Requesting fresh tokens for meeting:', meetingNumber, 'role:', role);
      
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
        body: {
          meetingNumber,
          role: role || 0,
          expirationSeconds: 7200
        }
      });

      if (tokenError) {
        console.error('❌ Token request failed:', tokenError);
        throw new Error(`Token error: ${tokenError.message}`);
      }

      console.log('✅ Fresh tokens received');

      // Get fresh ZAK token for host role
      let zakToken = null;
      if (role === 1) {
        console.log('🔄 Requesting fresh ZAK token for host role...');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        
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
  }, []);

  const handleJoinMeeting = useCallback(async () => {
    if (!isReady || hasJoinedOnce) {
      console.log('⏸️ SDK not ready or already joined once');
      return;
    }

    try {
      setCurrentStep('Getting fresh authentication tokens...');
      
      // Force cleanup any existing sessions before joining
      if (retryCount > 0) {
        console.log('🧹 Cleaning up existing session before retry');
        cleanup();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for cleanup
      }
      
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

      console.log('🔄 Attempting to join meeting with fresh config...');

      setCurrentStep('Joining meeting...');
      await joinMeeting(joinConfig);
      
      setHasJoinedOnce(true);
      setIsLoading(false);
      setCurrentStep('Connected to meeting');
      setRetryCount(0);
      onMeetingJoined?.();
    } catch (error: any) {
      console.error('❌ Join failed:', error);
      
      // Handle specific error codes
      if (error.message.includes('Error Code: 200') || error.message.includes('session conflict')) {
        if (retryCount < maxRetries) {
          console.log(`🔄 Session conflict detected, retrying (${retryCount + 1}/${maxRetries})`);
          setRetryCount(prev => prev + 1);
          setCurrentStep(`Retrying due to session conflict... (${retryCount + 1}/${maxRetries})`);
          setHasJoinedOnce(false);
          
          // Wait before retry
          setTimeout(() => {
            handleJoinMeeting();
          }, 3000);
          return;
        }
      }
      
      setError(error.message);
      setIsLoading(false);
      onMeetingError?.(error.message);
    }
  }, [isReady, hasJoinedOnce, meetingNumber, role, providedUserName, user, meetingPassword, getTokens, joinMeeting, onMeetingJoined, onMeetingError, retryCount, maxRetries, cleanup]);

  // Update current step based on SDK status
  useEffect(() => {
    if (isJoined) {
      setCurrentStep('Connected to meeting');
      setIsLoading(false);
    } else if (isReady && !hasJoinedOnce) {
      setCurrentStep('Ready to join meeting');
    } else if (isSDKLoaded) {
      setCurrentStep('Initializing Zoom SDK...');
    } else {
      setCurrentStep('Loading Zoom SDK...');
    }
  }, [isSDKLoaded, isReady, isJoined, hasJoinedOnce]);

  // Join when ready (only once)
  useEffect(() => {
    if (isReady && !hasJoinedOnce && !error) {
      console.log('✅ SDK ready, starting join process...');
      handleJoinMeeting();
    }
  }, [isReady, hasJoinedOnce, error, handleJoinMeeting]);

  const handleLeaveMeeting = useCallback(() => {
    leaveMeeting();
    setHasJoinedOnce(false);
    onMeetingLeft?.();
  }, [leaveMeeting, onMeetingLeft]);

  const handleRetry = useCallback(() => {
    if (retryCount < maxRetries) {
      console.log(`🔄 Manual retry attempt ${retryCount + 1}/${maxRetries}`);
      setRetryCount(prev => prev + 1);
      setError(null);
      setIsLoading(true);
      setHasJoinedOnce(false);
      setCurrentStep('Retrying with fresh session...');
      
      // Clean up and retry
      cleanup();
      setTimeout(() => {
        handleJoinMeeting();
      }, 2000); // Wait for cleanup
    } else {
      console.warn('⚠️ Max retry attempts reached');
      setError('Maximum retry attempts reached. Please refresh the page to try again.');
    }
  }, [retryCount, maxRetries, handleJoinMeeting, cleanup]);

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
    <div className="flex flex-col w-full h-full bg-gray-900 rounded-lg overflow-hidden p-0 m-0" style={{ minHeight: 0, minWidth: 0 }}>
      <ZoomLoadingOverlay
        isLoading={isLoading}
        currentStep={currentStep}
        meetingNumber={meetingNumber}
        retryCount={retryCount}
        maxRetries={maxRetries}
      />

      {/* Zoom meeting container - now takes full available space */}
      <div 
        ref={containerRef}
        id="meetingSDKElement"
        className="flex-1 w-full h-full p-0 m-0"
        style={{ minHeight: 0, minWidth: 0 }}
      />
    </div>
  );
}

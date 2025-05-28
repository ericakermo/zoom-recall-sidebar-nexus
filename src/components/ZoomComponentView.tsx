
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useZoomSDK } from '@/hooks/useZoomSDK';
import { ZoomMeetingControls } from '@/components/zoom/ZoomMeetingControls';
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
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState('Initializing Zoom SDK...');
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  
  const { user } = useAuth();

  const {
    containerRef,
    isSDKLoaded,
    isReady,
    joinMeeting,
    leaveMeeting
  } = useZoomSDK({
    onReady: () => {
      console.log('✅ Zoom SDK ready');
      setCurrentStep('Getting meeting tokens...');
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
      console.log('🔄 Requesting tokens for meeting:', meetingNumber, 'role:', role);
      
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

      console.log('✅ Tokens received:', {
        sdkKey: tokenData.sdkKey ? 'present' : 'missing',
        signature: tokenData.signature ? 'present' : 'missing',
        meetingNumber: tokenData.meetingNumber,
        role: tokenData.role
      });

      // Get ZAK token if host
      let zakToken = null;
      if (role === 1) {
        console.log('🔄 Requesting ZAK token for host...');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        if (!zakError && zakData) {
          zakToken = zakData.zak;
          console.log('✅ ZAK token received');
        } else {
          console.warn('⚠️ ZAK token request failed (non-critical):', zakError);
        }
      }

      return { ...tokenData, zak: zakToken };
    } catch (error) {
      console.error('❌ Token fetch failed:', error);
      throw error;
    }
  }, []);

  const handleJoinMeeting = useCallback(async () => {
    if (!isReady) {
      console.log('⏸️ SDK not ready yet');
      return;
    }

    try {
      setCurrentStep('Getting authentication tokens...');
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

      console.log('🔄 Attempting to join meeting with config:', {
        meetingNumber: joinConfig.meetingNumber,
        userName: joinConfig.userName,
        role: joinConfig.role,
        hasPassword: !!joinConfig.passWord,
        hasZak: !!joinConfig.zak,
        sdkKey: joinConfig.sdkKey ? 'present' : 'missing'
      });

      setCurrentStep('Joining meeting...');
      await joinMeeting(joinConfig);
      
      setIsJoined(true);
      setIsLoading(false);
      setCurrentStep('Connected to meeting');
      setRetryCount(0); // Reset retry count on success
      onMeetingJoined?.();
    } catch (error: any) {
      console.error('❌ Join failed:', error);
      setError(error.message);
      setIsLoading(false);
      onMeetingError?.(error.message);
    }
  }, [isReady, meetingNumber, role, providedUserName, user, meetingPassword, getTokens, joinMeeting, onMeetingJoined, onMeetingError]);

  // Update current step based on SDK status
  useEffect(() => {
    if (isReady) {
      setCurrentStep('Ready to join meeting');
    } else if (isSDKLoaded) {
      setCurrentStep('Initializing Zoom SDK...');
    } else {
      setCurrentStep('Loading Zoom SDK...');
    }
  }, [isSDKLoaded, isReady]);

  // Join when ready
  useEffect(() => {
    if (isReady && !isJoined && !error) {
      console.log('✅ SDK ready, starting join process...');
      handleJoinMeeting();
    }
  }, [isReady, isJoined, error, handleJoinMeeting]);

  const handleLeaveMeeting = useCallback(() => {
    leaveMeeting();
    setIsJoined(false);
    onMeetingLeft?.();
  }, [leaveMeeting, onMeetingLeft]);

  const handleRetry = useCallback(() => {
    if (retryCount < maxRetries) {
      console.log(`🔄 Retrying join attempt ${retryCount + 1}/${maxRetries}`);
      setRetryCount(prev => prev + 1);
      setError(null);
      setIsLoading(true);
      setCurrentStep('Retrying...');
      handleJoinMeeting();
    } else {
      console.warn('⚠️ Max retry attempts reached');
    }
  }, [retryCount, maxRetries, handleJoinMeeting]);

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
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      <ZoomLoadingOverlay
        isLoading={isLoading}
        currentStep={currentStep}
        meetingNumber={meetingNumber}
        retryCount={retryCount}
        maxRetries={maxRetries}
      />

      {/* Zoom meeting container - this is where the meeting UI will render */}
      <div 
        ref={containerRef}
        id="meetingSDKElement"
        className="w-full h-full"
        style={{ 
          minHeight: '500px',
          minWidth: '800px',
          position: 'relative'
        }}
      />

      {isJoined && (
        <ZoomMeetingControls
          isJoined={isJoined}
          isMuted={true}
          isVideoOff={true}
          onToggleMute={() => {}}
          onToggleVideo={() => {}}
          onLeaveMeeting={handleLeaveMeeting}
        />
      )}
    </div>
  );
}

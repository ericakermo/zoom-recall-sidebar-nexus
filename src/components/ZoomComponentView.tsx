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
      setCurrentStep('Preparing to join meeting...');
    },
    onError: (error) => {
      console.error('❌ Zoom SDK error:', error);
      setError(error);
      setIsLoading(false);
      onMeetingError?.(error);
    }
  });

  const validateMeetingState = useCallback(async (meetingNumber: string) => {
    try {
      console.log('🔄 Validating meeting state before join...');
      const { data: meetingStatus, error: statusError } = await supabase.functions.invoke('validate-meeting-status', {
        body: { meetingNumber }
      });

      if (statusError) {
        console.warn('⚠️ Could not validate meeting status:', statusError);
        return { canJoin: true, warning: 'Unable to validate meeting status' };
      }

      console.log('📊 Meeting status:', meetingStatus);

      if (meetingStatus.meetingStatus === 'ended') {
        return { canJoin: false, error: 'Meeting has ended' };
      }

      if (meetingStatus.meetingStatus === 'waiting' && !meetingStatus.joinBeforeHost && role !== 1) {
        return { canJoin: false, error: 'Meeting is waiting for host to start' };
      }

      return { canJoin: true };
    } catch (error) {
      console.warn('⚠️ Meeting validation failed:', error);
      return { canJoin: true, warning: 'Could not validate meeting state' };
    }
  }, [role]);

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

      // Enhanced ZAK token handling for host role
      let zakToken = null;
      if (role === 1) {
        console.log('🔄 Requesting ZAK token for host role...');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        
        if (zakError || !zakData?.zak) {
          console.error('❌ ZAK token request failed:', zakError);
          throw new Error('Host role requires valid ZAK token - ZAK request failed');
        }
        
        zakToken = zakData.zak;
        console.log('✅ ZAK token received for host authentication');
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
      // Step 1: Validate meeting state
      setCurrentStep('Validating meeting state...');
      const validation = await validateMeetingState(meetingNumber);
      
      if (!validation.canJoin) {
        throw new Error(validation.error || 'Cannot join meeting at this time');
      }

      if (validation.warning) {
        console.warn('⚠️ Meeting validation warning:', validation.warning);
      }

      // Step 2: Get authentication tokens
      setCurrentStep('Getting authentication tokens...');
      const tokens = await getTokens(meetingNumber, role || 0);

      // Step 3: Prepare join configuration
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

      // Step 4: Join the meeting
      setCurrentStep('Joining meeting...');
      await joinMeeting(joinConfig);
      
      setIsJoined(true);
      setIsLoading(false);
      setCurrentStep('Connected to meeting');
      setRetryCount(0);
      onMeetingJoined?.();
    } catch (error: any) {
      console.error('❌ Join failed:', error);
      setError(error.message);
      setIsLoading(false);
      onMeetingError?.(error.message);
    }
  }, [isReady, meetingNumber, role, providedUserName, user, meetingPassword, validateMeetingState, getTokens, joinMeeting, onMeetingJoined, onMeetingError]);

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
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden flex flex-col">
      <ZoomLoadingOverlay
        isLoading={isLoading}
        currentStep={currentStep}
        meetingNumber={meetingNumber}
        retryCount={retryCount}
        maxRetries={maxRetries}
      />

      {/* Zoom meeting container - make this take up most of the space */}
      <div 
        ref={containerRef}
        id="meetingSDKElement"
        className="w-full flex-1"
        style={{ 
          minHeight: '600px',
          minWidth: '800px',
          position: 'relative'
        }}
      />

      {/* Controls container - minimize this space */}
      {isJoined && (
        <div className="relative h-16 flex-shrink-0">
          <ZoomMeetingControls
            isJoined={isJoined}
            isMuted={true}
            isVideoOff={true}
            onToggleMute={() => {}}
            onToggleVideo={() => {}}
            onLeaveMeeting={handleLeaveMeeting}
          />
        </div>
      )}
    </div>
  );
}

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

  useEffect(() => {
    return () => {
      if (!hasJoinedSuccessfully) {
        console.log('🔚 [COMPONENT-VIEW] Component unmounting - no successful join');
      } else {
        console.log('🔚 [COMPONENT-VIEW] Component unmounting - had successful join');
      }
    };
  }, [hasJoinedSuccessfully]);

  useEffect(() => {
    // Add responsive CSS overrides for proper 16:9 scaling
    const style = document.createElement('style');
    style.id = 'zoom-sdk-responsive-overrides';
    style.textContent = `
      /* Responsive 16:9 container styling */
      #meetingSDKElement {
        width: 100% !important;
        height: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        position: relative !important;
      }
      
      /* Force all Zoom SDK elements to scale responsively */
      #meetingSDKElement canvas,
      #meetingSDKElement video {
        width: 100% !important;
        height: 100% !important;
        object-fit: contain !important;
        max-width: 100% !important;
        max-height: 100% !important;
      }
      
      /* Make Zoom containers responsive */
      #meetingSDKElement [class*="css-"],
      #meetingSDKElement div[width],
      #meetingSDKElement ul[width] {
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
        max-height: 100% !important;
      }
      
      /* Disable dragging completely */
      #meetingSDKElement .react-draggable {
        pointer-events: none !important;
        cursor: default !important;
        transform: none !important;
      }
      
      /* Ensure flex behavior for internal containers */
      #meetingSDKElement > div {
        flex: 1 1 auto !important;
        display: flex !important;
        flex-direction: column !important;
      }
      
      /* Fix for participant list scaling */
      #meetingSDKElement ul.css-vv0cdr {
        position: relative !important;
        width: 100% !important;
        height: 100% !important;
      }
      
      /* Fix for individual participant items */
      #meetingSDKElement li[style*="width"] {
        position: relative !important;
        width: 100% !important;
        height: auto !important;
        top: auto !important;
        left: auto !important;
      }
    `;
    
    document.head.appendChild(style);
    
    return () => {
      // Cleanup the style when component unmounts
      const existingStyle = document.getElementById('zoom-sdk-responsive-overrides');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

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
    <div className="w-full h-full relative">
      <ZoomLoadingOverlay
        isLoading={isLoading}
        currentStep={currentStep}
        meetingNumber={meetingNumber}
        retryCount={retryCount}
        maxRetries={maxRetries}
      />

      {/* Responsive 16:9 container following ChatGPT's recommendations */}
      <div 
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: '16 / 9',
          maxWidth: '100%'
        }}
      >
        <div 
          id="meetingSDKElement"
          ref={containerRef}
          className="w-full h-full"
          style={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#000'
          }}
        />
      </div>
    </div>
  );
}

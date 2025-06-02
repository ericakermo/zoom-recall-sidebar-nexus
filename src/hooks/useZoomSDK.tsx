
import { useState, useRef, useCallback, useLayoutEffect } from 'react';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

interface UseZoomSDKProps {
  containerRef: React.RefObject<HTMLDivElement>;
  shouldInitialize?: boolean;
  onReady?: () => void;
  onError?: (error: string) => void;
}

export function useZoomSDK({ containerRef, shouldInitialize = true, onReady, onError }: UseZoomSDKProps) {
  const [isReady, setIsReady] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  const clientRef = useRef<any>(null);
  const initAttemptedRef = useRef(false);
  const mountedRef = useRef(true);

  const validateContainer = useCallback(() => {
    if (!containerRef.current) return false;
    
    const element = containerRef.current;
    const rect = element.getBoundingClientRect();
    const isInDOM = document.contains(element);
    const isValid = rect.width >= 320 && rect.height >= 240 && isInDOM;
    
    console.log('🔍 [ZOOM-SDK] Container validation:', {
      width: rect.width,
      height: rect.height,
      isInDOM,
      isValid
    });
    
    return isValid;
  }, [containerRef]);

  const cleanup = useCallback(() => {
    console.log('🧹 [ZOOM-SDK] Cleanup started');
    
    if (clientRef.current) {
      try {
        if (isJoined && typeof clientRef.current.leave === 'function') {
          clientRef.current.leave();
        }
        if (typeof clientRef.current.destroy === 'function') {
          clientRef.current.destroy();
        }
      } catch (error) {
        console.warn('🧹 [ZOOM-SDK] Cleanup warning:', error);
      }
      clientRef.current = null;
    }

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    
    setIsReady(false);
    setIsJoined(false);
    setIsLoading(true);
    setHasError(false);
    initAttemptedRef.current = false;
    
    console.log('✅ [ZOOM-SDK] Cleanup completed');
  }, [isJoined, containerRef]);

  const initializeSDK = useCallback(async () => {
    console.log('🚀 [ZOOM-SDK] Initializing SDK...');

    if (initAttemptedRef.current || !shouldInitialize || !mountedRef.current) {
      console.log('⏭️ [ZOOM-SDK] Init skipped');
      return;
    }

    if (!validateContainer()) {
      console.log('❌ [ZOOM-SDK] Container not ready');
      setHasError(true);
      onError?.('Container not ready for SDK initialization');
      return;
    }

    initAttemptedRef.current = true;
    setIsLoading(true);
    setHasError(false);

    try {
      console.log('🔧 [ZOOM-SDK] Creating client...');
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      if (!clientRef.current) {
        throw new Error('Failed to create Zoom client');
      }

      // Clear container before init
      containerRef.current!.innerHTML = '';

      const initConfig = {
        zoomAppRoot: containerRef.current!,
        language: 'en-US',
        patchJsMedia: true,
        leaveOnPageUnload: true,
        success: () => {
          if (mountedRef.current) {
            console.log('✅ [ZOOM-SDK] SDK ready');
            setIsReady(true);
            setIsLoading(false);
            onReady?.();
          }
        },
        error: (event: any) => {
          if (mountedRef.current) {
            console.error('❌ [ZOOM-SDK] Init failed:', event);
            const errorMsg = event?.errorMessage || 'SDK initialization failed';
            setHasError(true);
            setIsLoading(false);
            initAttemptedRef.current = false;
            onError?.(errorMsg);
          }
        }
      };

      console.log('🔧 [ZOOM-SDK] Calling init...');
      await clientRef.current.init(initConfig);

    } catch (error: any) {
      if (mountedRef.current) {
        console.error('❌ [ZOOM-SDK] Init error:', error);
        setHasError(true);
        setIsLoading(false);
        initAttemptedRef.current = false;
        onError?.(error.message || 'Failed to initialize Zoom SDK');
      }
    }
  }, [containerRef, shouldInitialize, validateContainer, onReady, onError]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    console.log('🎯 [ZOOM-SDK] Joining meeting...');

    if (!isReady || !clientRef.current || !mountedRef.current) {
      const errorMsg = `Cannot join - SDK not ready (isReady: ${isReady}, hasClient: ${!!clientRef.current})`;
      console.error('❌ [ZOOM-SDK]', errorMsg);
      throw new Error(errorMsg);
    }

    // Simple meeting number validation
    const meetingNumberStr = String(joinConfig.meetingNumber).replace(/\s+/g, '');
    if (!/^\d{10,11}$/.test(meetingNumberStr)) {
      throw new Error(`Invalid meeting number: ${joinConfig.meetingNumber}`);
    }

    try {
      const joinParams = {
        sdkKey: joinConfig.sdkKey,
        signature: joinConfig.signature,
        meetingNumber: meetingNumberStr,
        password: joinConfig.passWord || '',
        userName: joinConfig.userName,
        userEmail: joinConfig.userEmail || '',
        zak: joinConfig.zak || '',
        success: (success: any) => {
          if (mountedRef.current) {
            console.log('✅ [ZOOM-SDK] Join success:', success);
            setIsJoined(true);
          }
        },
        error: (error: any) => {
          if (mountedRef.current) {
            console.error('❌ [ZOOM-SDK] Join failed:', error);
            
            // Map common error codes to user-friendly messages
            let errorMessage = 'Failed to join meeting';
            if (error?.errorCode === 200) {
              errorMessage = 'Meeting join failed - please check meeting details';
            } else if (error?.errorCode === 3712) {
              errorMessage = 'Authentication failed - invalid signature';
            } else if (error?.reason) {
              errorMessage = error.reason;
            }
            
            throw new Error(errorMessage);
          }
        }
      };

      console.log('🔧 [ZOOM-SDK] Join params:', {
        meetingNumber: joinParams.meetingNumber,
        userName: joinParams.userName,
        hasPassword: !!joinParams.password,
        hasZak: !!joinParams.zak
      });

      await clientRef.current.join(joinParams);

    } catch (error: any) {
      if (mountedRef.current) {
        console.error('❌ [ZOOM-SDK] Join process failed:', error);
        throw error;
      }
    }
  }, [isReady]);

  const leaveMeeting = useCallback(() => {
    console.log('👋 [ZOOM-SDK] Leaving meeting...');

    if (clientRef.current && isJoined && mountedRef.current) {
      try {
        clientRef.current.leave();
        setIsJoined(false);
        console.log('✅ [ZOOM-SDK] Left meeting');
      } catch (error) {
        console.error('❌ [ZOOM-SDK] Leave error:', error);
      }
    }
  }, [isJoined]);

  // Initialize when container is ready
  useLayoutEffect(() => {
    const initWhenReady = () => {
      if (containerRef.current && shouldInitialize && !initAttemptedRef.current && mountedRef.current) {
        // Small delay to ensure container is fully rendered
        setTimeout(() => {
          if (mountedRef.current && validateContainer()) {
            initializeSDK();
          }
        }, 100);
      }
    };

    initWhenReady();

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [containerRef, shouldInitialize, initializeSDK, validateContainer, cleanup]);

  return {
    isReady,
    isJoined,
    isLoading,
    hasError,
    joinMeeting,
    leaveMeeting,
    cleanup
  };
}

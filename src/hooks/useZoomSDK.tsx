
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
    console.log('🔍 [ZOOM-SDK] Validating container...');
    
    if (!containerRef.current) {
      console.log('❌ [ZOOM-SDK] Container ref is null');
      return false;
    }

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
    console.log('🧹 [ZOOM-SDK] Starting cleanup...');
    
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
    
    console.log('🧹 [ZOOM-SDK] Cleanup completed');
  }, [isJoined, containerRef]);

  const initializeSDK = useCallback(async () => {
    console.log('🚀 [ZOOM-SDK] Starting SDK initialization...');

    if (initAttemptedRef.current || !shouldInitialize || !mountedRef.current) {
      console.log('⏭️ [ZOOM-SDK] Skipping init - conditions not met');
      return;
    }

    if (!validateContainer()) {
      console.log('❌ [ZOOM-SDK] Container validation failed');
      setHasError(true);
      onError?.('Container not ready for SDK initialization');
      return;
    }

    initAttemptedRef.current = true;
    setIsLoading(true);
    setHasError(false);

    try {
      // Create Zoom client
      console.log('🔧 [ZOOM-SDK] Creating ZoomMtgEmbedded client...');
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      if (!clientRef.current) {
        throw new Error('Failed to create Zoom client');
      }
      
      console.log('✅ [ZOOM-SDK] Zoom client created successfully');

      // Clear container
      containerRef.current!.innerHTML = '';

      // Initialize SDK
      const initConfig = {
        zoomAppRoot: containerRef.current!,
        language: 'en-US',
        patchJsMedia: true,
        leaveOnPageUnload: true,
        success: () => {
          if (mountedRef.current) {
            console.log('🎉 [ZOOM-SDK] SDK initialization SUCCESS');
            setIsReady(true);
            setIsLoading(false);
            onReady?.();
          }
        },
        error: (event: any) => {
          if (mountedRef.current) {
            console.error('💥 [ZOOM-SDK] SDK initialization ERROR:', event);
            const errorMsg = event?.errorMessage || 'SDK initialization failed';
            setHasError(true);
            setIsLoading(false);
            initAttemptedRef.current = false;
            onError?.(errorMsg);
          }
        }
      };

      console.log('🔧 [ZOOM-SDK] Calling client.init()...');
      await clientRef.current.init(initConfig);

    } catch (error: any) {
      if (mountedRef.current) {
        console.error('💥 [ZOOM-SDK] Init error:', error);
        setHasError(true);
        setIsLoading(false);
        initAttemptedRef.current = false;
        onError?.(error.message || 'Failed to initialize Zoom SDK');
      }
    }
  }, [containerRef, shouldInitialize, validateContainer, onReady, onError]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    console.log('🎯 [ZOOM-SDK] Starting join process...');

    if (!isReady || !clientRef.current || !mountedRef.current) {
      const errorMsg = `SDK not ready for join - isReady: ${isReady}, hasClient: ${!!clientRef.current}`;
      console.error('❌ [ZOOM-SDK]', errorMsg);
      throw new Error(errorMsg);
    }

    const meetingNumberStr = String(joinConfig.meetingNumber).replace(/\s+/g, '');
    if (!/^\d{10,11}$/.test(meetingNumberStr)) {
      const errorMsg = `Invalid meeting number: ${joinConfig.meetingNumber}`;
      console.error('❌ [ZOOM-SDK]', errorMsg);
      throw new Error(errorMsg);
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
            console.log('🎉 [ZOOM-SDK] Join SUCCESS:', success);
            setIsJoined(true);
          }
        },
        error: (error: any) => {
          if (mountedRef.current) {
            console.error('💥 [ZOOM-SDK] Join ERROR:', error);
            
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

      console.log('🔧 [ZOOM-SDK] Calling client.join()...', {
        meetingNumber: joinParams.meetingNumber,
        userName: joinParams.userName,
        hasPassword: !!joinParams.password,
        hasZak: !!joinParams.zak
      });

      await clientRef.current.join(joinParams);

    } catch (error: any) {
      if (mountedRef.current) {
        console.error('💥 [ZOOM-SDK] Join process failed:', error);
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
        console.log('✅ [ZOOM-SDK] Leave completed');
      } catch (error) {
        console.error('💥 [ZOOM-SDK] Leave error:', error);
      }
    }
  }, [isJoined]);

  // Use layoutEffect for DOM-dependent operations
  useLayoutEffect(() => {
    const checkContainerAndInit = () => {
      if (containerRef.current && shouldInitialize && !initAttemptedRef.current && mountedRef.current) {
        // Small delay to ensure container is fully rendered
        setTimeout(() => {
          if (mountedRef.current && validateContainer()) {
            initializeSDK();
          }
        }, 100);
      }
    };

    checkContainerAndInit();

    // Cleanup on unmount
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


import { useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  const mountedRef = useRef(true);
  const location = useLocation();

  // Navigation cleanup
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isJoined && clientRef.current) {
        console.log('🌐 [ZOOM-SDK] Page unloading - leaving meeting');
        try {
          clientRef.current.leave();
        } catch (error) {
          console.warn('Warning during beforeunload cleanup:', error);
        }
      }
    };

    const handlePopState = () => {
      if (isJoined && clientRef.current) {
        console.log('🔙 [ZOOM-SDK] Navigation detected - leaving meeting');
        try {
          clientRef.current.leave();
        } catch (error) {
          console.warn('Warning during navigation cleanup:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isJoined]);

  // Route change cleanup
  useEffect(() => {
    return () => {
      if (isJoined && clientRef.current) {
        console.log('🔄 [ZOOM-SDK] Route change - leaving meeting');
        try {
          clientRef.current.leave();
        } catch (error) {
          console.warn('Warning during route change cleanup:', error);
        }
      }
    };
  }, [location, isJoined]);

  const validateContainer = useCallback(() => {
    if (!containerRef.current) {
      console.log('❌ [ZOOM-SDK] Container not found');
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
    console.log('🧹 [ZOOM-SDK] Starting cleanup');
    
    if (clientRef.current) {
      try {
        if (isJoined && typeof clientRef.current.leave === 'function') {
          clientRef.current.leave();
        }
        if (typeof clientRef.current.destroy === 'function') {
          clientRef.current.destroy();
        }
      } catch (error) {
        console.warn('Warning during cleanup:', error);
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
    
    console.log('✅ [ZOOM-SDK] Cleanup completed');
  }, [isJoined, containerRef]);

  const initializeSDK = useCallback(async () => {
    if (!shouldInitialize || !mountedRef.current) {
      console.log('⏭️ [ZOOM-SDK] Init skipped');
      return;
    }

    if (!validateContainer()) {
      console.log('❌ [ZOOM-SDK] Container not ready');
      setHasError(true);
      setIsLoading(false);
      onError?.('Container not ready for SDK initialization');
      return;
    }

    console.log('🚀 [ZOOM-SDK] Initializing SDK');
    setIsLoading(true);
    setHasError(false);

    try {
      // Clear container before init
      containerRef.current!.innerHTML = '';
      
      // Create client
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      if (!clientRef.current) {
        throw new Error('Failed to create Zoom client');
      }

      // Simplified, reliable configuration
      const initConfig = {
        zoomAppRoot: containerRef.current!,
        language: 'en-US',
        patchJsMedia: true,
        leaveOnPageUnload: true,
        success: () => {
          if (mountedRef.current) {
            console.log('✅ [ZOOM-SDK] SDK initialized successfully');
            setIsReady(true);
            setIsLoading(false);
            onReady?.();
          }
        },
        error: (error: any) => {
          if (mountedRef.current) {
            console.error('❌ [ZOOM-SDK] Init failed:', error);
            setHasError(true);
            setIsLoading(false);
            const errorMsg = error?.errorMessage || error?.reason || 'SDK initialization failed';
            onError?.(errorMsg);
          }
        }
      };

      await clientRef.current.init(initConfig);

    } catch (error: any) {
      if (mountedRef.current) {
        console.error('❌ [ZOOM-SDK] Init error:', error);
        setHasError(true);
        setIsLoading(false);
        onError?.(error.message || 'Failed to initialize Zoom SDK');
      }
    }
  }, [containerRef, shouldInitialize, validateContainer, onReady, onError]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    console.log('🎯 [ZOOM-SDK] Joining meeting');

    if (!isReady || !clientRef.current || !mountedRef.current) {
      const errorMsg = `Cannot join meeting - SDK not ready`;
      console.error('❌ [ZOOM-SDK]', errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const joinParams = {
        sdkKey: joinConfig.sdkKey,
        signature: joinConfig.signature,
        meetingNumber: String(joinConfig.meetingNumber).replace(/\s+/g, ''),
        password: joinConfig.passWord || '',
        userName: joinConfig.userName,
        userEmail: joinConfig.userEmail || '',
        zak: joinConfig.zak || '',
        success: (result: any) => {
          if (mountedRef.current) {
            console.log('✅ [ZOOM-SDK] Successfully joined meeting');
            setIsJoined(true);
          }
        },
        error: (error: any) => {
          if (mountedRef.current) {
            console.error('❌ [ZOOM-SDK] Join failed:', error);
            
            // Map common Zoom error codes to user-friendly messages
            let errorMessage = 'Failed to join meeting';
            if (error?.errorCode === 200) {
              errorMessage = 'Invalid meeting credentials';
            } else if (error?.errorCode === 3712) {
              errorMessage = 'Authentication failed - invalid signature';
            } else if (error?.errorCode === 3000) {
              errorMessage = 'Meeting not found or has ended';
            } else if (error?.reason) {
              errorMessage = error.reason;
            }
            
            throw new Error(errorMessage);
          }
        }
      };

      await clientRef.current.join(joinParams);

    } catch (error: any) {
      if (mountedRef.current) {
        console.error('❌ [ZOOM-SDK] Join process failed:', error);
        throw error;
      }
    }
  }, [isReady]);

  const leaveMeeting = useCallback(() => {
    console.log('👋 [ZOOM-SDK] Leaving meeting');

    if (clientRef.current && isJoined && mountedRef.current) {
      try {
        clientRef.current.leave();
        setIsJoined(false);
        console.log('✅ [ZOOM-SDK] Left meeting successfully');
      } catch (error) {
        console.error('❌ [ZOOM-SDK] Leave error:', error);
      }
    }
  }, [isJoined]);

  // Initialize when container is ready
  useLayoutEffect(() => {
    if (containerRef.current && shouldInitialize && mountedRef.current) {
      // Wait for container to be fully rendered
      const timer = setTimeout(() => {
        if (mountedRef.current && validateContainer()) {
          initializeSDK();
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [containerRef, shouldInitialize, initializeSDK, validateContainer]);

  // Cleanup on unmount
  useLayoutEffect(() => {
    return () => {
      console.log('🔚 [ZOOM-SDK] Component unmounting');
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

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

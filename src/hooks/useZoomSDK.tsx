
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
  const initializingRef = useRef(false);
  const retryCountRef = useRef(0);
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
    const isVisible = element.offsetParent !== null;
    const hasCorrectId = element.id === 'meetingSDKElement';
    const isValid = rect.width >= 320 && rect.height >= 240 && isInDOM && isVisible && hasCorrectId;
    
    console.log('🔍 [ZOOM-SDK] Container validation:', {
      width: rect.width,
      height: rect.height,
      isInDOM,
      isVisible,
      hasCorrectId,
      id: element.id,
      isValid
    });
    
    // Ensure the container has the correct ID
    if (!hasCorrectId) {
      element.id = 'meetingSDKElement';
      console.log('🔧 [ZOOM-SDK] Fixed container ID to meetingSDKElement');
    }
    
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
    initializingRef.current = false;
    retryCountRef.current = 0;
    
    console.log('✅ [ZOOM-SDK] Cleanup completed');
  }, [isJoined, containerRef]);

  const retryWithBackoff = useCallback(async (attempt: number): Promise<void> => {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    
    if (attempt >= maxRetries) {
      throw new Error(`Failed to initialize after ${maxRetries} attempts`);
    }
    
    const delay = baseDelay * Math.pow(2, attempt);
    console.log(`⏳ [ZOOM-SDK] Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }, []);

  const initializeSDK = useCallback(async () => {
    if (!shouldInitialize || !mountedRef.current || initializingRef.current) {
      console.log('⏭️ [ZOOM-SDK] Init skipped', { shouldInitialize, mounted: mountedRef.current, initializing: initializingRef.current });
      return;
    }

    if (!validateContainer()) {
      console.log('❌ [ZOOM-SDK] Container not ready');
      setHasError(true);
      setIsLoading(false);
      onError?.('Zoom container not ready - please ensure the page has fully loaded');
      return;
    }

    console.log('🚀 [ZOOM-SDK] Initializing Zoom Meeting SDK');
    
    // Log SDK version information
    try {
      console.log('📋 [ZOOM-SDK] SDK Info:', {
        version: ZoomMtgEmbedded.version || 'unknown',
        hasCreateClient: typeof ZoomMtgEmbedded.createClient === 'function'
      });
    } catch (error) {
      console.warn('Warning getting SDK info:', error);
    }

    initializingRef.current = true;
    setIsLoading(true);
    setHasError(false);

    let attempts = 0;
    const maxRetries = 3;

    while (attempts < maxRetries && mountedRef.current) {
      try {
        console.log(`🔄 [ZOOM-SDK] Initialization attempt ${attempts + 1}/${maxRetries}`);
        
        // Clear container
        containerRef.current!.innerHTML = '';
        
        // Create client using latest SDK standards
        clientRef.current = ZoomMtgEmbedded.createClient();
        
        if (!clientRef.current) {
          throw new Error('Failed to create Zoom Meeting SDK client');
        }

        console.log('🔧 [ZOOM-SDK] Client created successfully');

        // Correct initialization configuration following Zoom SDK docs
        const initConfig = {
          zoomAppRoot: containerRef.current!,
          language: 'en-US',
        };

        console.log('🔧 [ZOOM-SDK] Calling client.init() - attempt', attempts + 1);
        
        // Use promise-based initialization with proper error handling
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Initialization timeout after 30 seconds'));
          }, 30000);

          clientRef.current.init(initConfig)
            .then((result: any) => {
              clearTimeout(timeoutId);
              console.log('✅ [ZOOM-SDK] Init completed successfully:', result);
              resolve(result);
            })
            .catch((error: any) => {
              clearTimeout(timeoutId);
              console.error('❌ [ZOOM-SDK] Init failed:', error);
              reject(error);
            });
        });

        if (mountedRef.current) {
          console.log('✅ [ZOOM-SDK] SDK initialized successfully - ready for join');
          initializingRef.current = false;
          setIsReady(true);
          setIsLoading(false);
          retryCountRef.current = 0;
          onReady?.();
          return;
        }

      } catch (error: any) {
        attempts++;
        console.error(`❌ [ZOOM-SDK] Init attempt ${attempts} failed:`, error);
        
        if (attempts < maxRetries && mountedRef.current) {
          try {
            await retryWithBackoff(attempts - 1);
          } catch (retryError) {
            break;
          }
        }
      }
    }

    // All attempts failed
    if (mountedRef.current) {
      initializingRef.current = false;
      setHasError(true);
      setIsLoading(false);
      
      let userMessage = 'Failed to initialize Zoom SDK after multiple attempts';
      if (!navigator.onLine) {
        userMessage = 'Network connection issue - please check your internet';
      } else if (!ZoomMtgEmbedded) {
        userMessage = 'Zoom SDK not loaded - please refresh the page';
      }
      
      onError?.(userMessage);
    }
  }, [containerRef, shouldInitialize, validateContainer, onReady, onError, retryWithBackoff]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    console.log('🎯 [ZOOM-SDK] Starting meeting join process');

    if (!isReady || !clientRef.current || !mountedRef.current) {
      const errorMsg = `Cannot join meeting - SDK not ready (ready: ${isReady}, client: ${!!clientRef.current})`;
      console.error('❌ [ZOOM-SDK]', errorMsg);
      throw new Error('Zoom SDK not ready - please wait for initialization');
    }

    console.log('📋 [ZOOM-SDK] Join config validation:', {
      meetingNumber: joinConfig.meetingNumber,
      userName: joinConfig.userName,
      role: joinConfig.role,
      hasSDKKey: !!joinConfig.sdkKey,
      hasSignature: !!joinConfig.signature
    });

    try {
      // Standard Zoom SDK join parameters following documentation
      const joinParams = {
        sdkKey: joinConfig.sdkKey,
        signature: joinConfig.signature,
        meetingNumber: String(joinConfig.meetingNumber).replace(/\s+/g, ''),
        password: joinConfig.passWord || '',
        userName: joinConfig.userName,
        userEmail: joinConfig.userEmail || '',
        zak: joinConfig.zak || ''
      };

      console.log('🔗 [ZOOM-SDK] Calling client.join() with params');
      
      // Use promise-based join following the SDK pattern
      const result = await clientRef.current.join(joinParams);
      
      if (mountedRef.current) {
        console.log('✅ [ZOOM-SDK] Successfully joined meeting:', result);
        setIsJoined(true);
        return result;
      }

    } catch (error: any) {
      if (mountedRef.current) {
        console.error('❌ [ZOOM-SDK] Join failed:', error);
        
        let errorMessage = 'Failed to join meeting';
        switch (error?.errorCode) {
          case 200:
            errorMessage = 'Invalid meeting credentials - check meeting ID and password';
            break;
          case 3712:
            errorMessage = 'Authentication failed - invalid meeting signature';
            break;
          case 3000:
            errorMessage = 'Meeting not found or has ended';
            break;
          case 1001:
            errorMessage = 'User rejected to give permission of camera or microphone';
            break;
          case 3001:
            errorMessage = 'Meeting locked by host';
            break;
          case 3002:
            errorMessage = 'Meeting restricted';
            break;
          case 3003:
            errorMessage = 'Meeting has reached maximum capacity';
            break;
          case 3004:
            errorMessage = 'Meeting does not exist';
            break;
          case 3005:
            errorMessage = 'Feature disabled by host';
            break;
          default:
            if (error?.reason) {
              errorMessage = error.reason;
            } else if (error?.errorMessage) {
              errorMessage = error.errorMessage;
            }
        }
        
        console.log('🔍 [ZOOM-SDK] Mapped error:', { code: error?.errorCode, message: errorMessage });
        throw new Error(errorMessage);
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
    if (containerRef.current && shouldInitialize && mountedRef.current && !initializingRef.current) {
      // Allow DOM to settle before validation
      const timer = setTimeout(() => {
        if (mountedRef.current && validateContainer() && !initializingRef.current) {
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

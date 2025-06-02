
import { useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

interface UseZoomSDKProps {
  containerRef: React.RefObject<HTMLDivElement>;
  shouldInitialize?: boolean;
  onReady?: () => void;
  onError?: (error: string) => void;
}

// Global SDK state to prevent multiple instances
let globalClient: any = null;
let globalInitialized = false;
let globalInitializing = false;
let initPromise: Promise<any> | null = null;

export function useZoomSDK({ containerRef, shouldInitialize = true, onReady, onError }: UseZoomSDKProps) {
  const [isReady, setIsReady] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  const mountedRef = useRef(true);
  const initializingRef = useRef(false);
  const joinAttemptedRef = useRef(false);
  const location = useLocation();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      console.log('🔚 [ZOOM-SDK] Component unmounting');
      if (isJoined && globalClient) {
        try {
          globalClient.leave();
        } catch (error) {
          console.warn('Warning during unmount cleanup:', error);
        }
      }
    };
  }, [isJoined]);

  // Navigation cleanup
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isJoined && globalClient) {
        try {
          globalClient.leave();
        } catch (error) {
          console.warn('Warning during beforeunload cleanup:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isJoined]);

  // Route change cleanup
  useEffect(() => {
    return () => {
      if (isJoined && globalClient) {
        try {
          globalClient.leave();
        } catch (error) {
          console.warn('Warning during route change cleanup:', error);
        }
      }
    };
  }, [location, isJoined]);

  const validateContainer = useCallback(() => {
    if (!containerRef.current) {
      return false;
    }
    
    const element = containerRef.current;
    const rect = element.getBoundingClientRect();
    const isInDOM = document.contains(element);
    const isVisible = element.offsetParent !== null;
    const hasCorrectId = element.id === 'meetingSDKElement';
    const isValid = rect.width >= 320 && rect.height >= 240 && isInDOM && isVisible;
    
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
    }
    
    return isValid;
  }, [containerRef]);

  const initializeSDK = useCallback(async () => {
    if (!shouldInitialize || !mountedRef.current || initializingRef.current) {
      return;
    }

    // Check if already initialized globally
    if (globalInitialized && globalClient) {
      console.log('✅ [ZOOM-SDK] Using existing global client');
      setIsReady(true);
      setIsLoading(false);
      onReady?.();
      return;
    }

    // If already initializing globally, wait for it
    if (globalInitializing && initPromise) {
      console.log('⏳ [ZOOM-SDK] Waiting for global initialization');
      try {
        await initPromise;
        if (mountedRef.current) {
          setIsReady(true);
          setIsLoading(false);
          onReady?.();
        }
      } catch (error: any) {
        if (mountedRef.current) {
          setHasError(true);
          setIsLoading(false);
          onError?.(error.message);
        }
      }
      return;
    }

    if (!validateContainer()) {
      setHasError(true);
      setIsLoading(false);
      onError?.('Zoom container not ready');
      return;
    }

    initializingRef.current = true;
    globalInitializing = true;
    setIsLoading(true);
    setHasError(false);

    // Create the initialization promise
    initPromise = (async () => {
      try {
        console.log('🚀 [ZOOM-SDK] Initializing Zoom Meeting SDK');
        
        // Clear container
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        // Create client
        globalClient = ZoomMtgEmbedded.createClient();
        
        if (!globalClient) {
          throw new Error('Failed to create Zoom Meeting SDK client');
        }

        console.log('🔧 [ZOOM-SDK] Client created successfully');

        // Initialize with proper configuration
        const initConfig = {
          zoomAppRoot: containerRef.current,
          language: 'en-US',
        };

        console.log('🔧 [ZOOM-SDK] Calling client.init()');
        
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Initialization timeout after 15 seconds'));
          }, 15000);

          globalClient.init(initConfig)
            .then((result: any) => {
              clearTimeout(timeoutId);
              console.log('✅ [ZOOM-SDK] Init completed successfully:', result);
              globalInitialized = true;
              resolve(result);
            })
            .catch((error: any) => {
              clearTimeout(timeoutId);
              console.error('❌ [ZOOM-SDK] Init failed:', error);
              globalClient = null;
              globalInitialized = false;
              reject(error);
            });
        });

        return globalClient;
      } catch (error) {
        globalClient = null;
        globalInitialized = false;
        throw error;
      } finally {
        globalInitializing = false;
        initPromise = null;
      }
    })();

    try {
      await initPromise;
      
      if (mountedRef.current) {
        console.log('✅ [ZOOM-SDK] SDK initialized successfully - ready for join');
        setIsReady(true);
        setIsLoading(false);
        onReady?.();
      }
    } catch (error: any) {
      if (mountedRef.current) {
        console.error('❌ [ZOOM-SDK] Initialization failed:', error);
        setHasError(true);
        setIsLoading(false);
        
        let userMessage = 'Failed to initialize Zoom SDK';
        if (!navigator.onLine) {
          userMessage = 'Network connection issue - please check your internet';
        }
        
        onError?.(userMessage);
      }
    } finally {
      initializingRef.current = false;
    }
  }, [containerRef, shouldInitialize, validateContainer, onReady, onError]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    console.log('🎯 [ZOOM-SDK] Starting meeting join process');

    if (!globalClient || !globalInitialized || !mountedRef.current) {
      const errorMsg = `Cannot join meeting - SDK not ready (initialized: ${globalInitialized}, client: ${!!globalClient})`;
      console.error('❌ [ZOOM-SDK]', errorMsg);
      throw new Error('Zoom SDK not ready - please wait for initialization');
    }

    if (joinAttemptedRef.current) {
      console.log('⏭️ [ZOOM-SDK] Join already attempted, skipping');
      return;
    }

    joinAttemptedRef.current = true;

    console.log('📋 [ZOOM-SDK] Join config validation:', {
      meetingNumber: joinConfig.meetingNumber,
      userName: joinConfig.userName,
      role: joinConfig.role,
      hasSDKKey: !!joinConfig.sdkKey,
      hasSignature: !!joinConfig.signature,
      hasZAK: !!joinConfig.zak
    });

    try {
      // Clean and validate meeting number
      const cleanMeetingNumber = String(joinConfig.meetingNumber).replace(/\s+/g, '');
      if (!/^\d{10,11}$/.test(cleanMeetingNumber)) {
        throw new Error(`Invalid meeting number format: ${cleanMeetingNumber}`);
      }

      // Prepare join parameters exactly as Zoom SDK expects
      const joinParams = {
        sdkKey: joinConfig.sdkKey,
        signature: joinConfig.signature,
        meetingNumber: cleanMeetingNumber,
        password: joinConfig.passWord || '',
        userName: joinConfig.userName || 'Guest',
        userEmail: joinConfig.userEmail || '',
        ...(joinConfig.zak && { zak: joinConfig.zak })
      };

      console.log('🔗 [ZOOM-SDK] Calling client.join() with cleaned params:', {
        meetingNumber: joinParams.meetingNumber,
        userName: joinParams.userName,
        hasPassword: !!joinParams.password,
        hasZAK: !!joinParams.zak,
        hasSDKKey: !!joinParams.sdkKey,
        hasSignature: !!joinParams.signature
      });
      
      const result = await globalClient.join(joinParams);
      
      if (mountedRef.current) {
        console.log('✅ [ZOOM-SDK] Successfully joined meeting:', result);
        setIsJoined(true);
        return result;
      }

    } catch (error: any) {
      joinAttemptedRef.current = false; // Allow retry on error
      
      if (mountedRef.current) {
        console.error('❌ [ZOOM-SDK] Join failed:', error);
        
        let errorMessage = 'Failed to join meeting';
        
        // Handle specific Zoom error codes
        const errorCode = error?.errorCode || error?.code;
        switch (errorCode) {
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
            errorMessage = 'User rejected camera or microphone permission';
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
            } else if (error?.message) {
              errorMessage = error.message;
            }
        }
        
        console.log('🔍 [ZOOM-SDK] Mapped error:', { code: errorCode, message: errorMessage });
        throw new Error(errorMessage);
      }
    }
  }, []);

  const leaveMeeting = useCallback(() => {
    console.log('👋 [ZOOM-SDK] Leaving meeting');

    if (globalClient && isJoined && mountedRef.current) {
      try {
        globalClient.leave();
        setIsJoined(false);
        joinAttemptedRef.current = false;
        console.log('✅ [ZOOM-SDK] Left meeting successfully');
      } catch (error) {
        console.error('❌ [ZOOM-SDK] Leave error:', error);
      }
    }
  }, [isJoined]);

  const cleanup = useCallback(() => {
    console.log('🧹 [ZOOM-SDK] Starting cleanup');
    
    if (isJoined && globalClient) {
      try {
        globalClient.leave();
      } catch (error) {
        console.warn('Warning during cleanup leave:', error);
      }
    }

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    
    setIsReady(false);
    setIsJoined(false);
    setIsLoading(true);
    setHasError(false);
    initializingRef.current = false;
    joinAttemptedRef.current = false;
    
    console.log('✅ [ZOOM-SDK] Cleanup completed');
  }, [isJoined, containerRef]);

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

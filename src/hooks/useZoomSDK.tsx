
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
    initializingRef.current = false;
    
    console.log('✅ [ZOOM-SDK] Cleanup completed');
  }, [isJoined, containerRef]);

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

    console.log('🚀 [ZOOM-SDK] Initializing Zoom Meeting SDK v3.13.2');
    initializingRef.current = true;
    setIsLoading(true);
    setHasError(false);

    try {
      // Clear container
      containerRef.current!.innerHTML = '';
      
      // Create client using latest SDK standards
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      if (!clientRef.current) {
        throw new Error('Failed to create Zoom Meeting SDK client');
      }

      console.log('🔧 [ZOOM-SDK] Client created, starting initialization...');

      // CRITICAL FIX: Use callback-based initialization (NOT await)
      const initConfig = {
        zoomAppRoot: containerRef.current!,
        language: 'en-US',
        patchJsMedia: true,
        leaveOnPageUnload: true,
        success: () => {
          if (mountedRef.current) {
            console.log('✅ [ZOOM-SDK] SDK initialized successfully - ready for join');
            initializingRef.current = false;
            setIsReady(true);
            setIsLoading(false);
            onReady?.();
          }
        },
        error: (error: any) => {
          if (mountedRef.current) {
            console.error('❌ [ZOOM-SDK] Init failed:', error);
            initializingRef.current = false;
            setHasError(true);
            setIsLoading(false);
            
            let userMessage = 'Failed to initialize Zoom SDK';
            if (error?.errorMessage?.includes('network')) {
              userMessage = 'Network connection issue - please check your internet';
            } else if (error?.errorMessage?.includes('browser')) {
              userMessage = 'Browser compatibility issue - try using Chrome or Firefox';
            } else if (error?.reason) {
              userMessage = `Zoom SDK Error: ${error.reason}`;
            }
            
            onError?.(userMessage);
          }
        }
      };

      console.log('🔧 [ZOOM-SDK] Calling client.init() with callback-based approach');
      
      // FIXED: Don't await - let callbacks handle the flow
      clientRef.current.init(initConfig);

    } catch (error: any) {
      if (mountedRef.current) {
        console.error('❌ [ZOOM-SDK] Critical init error:', error);
        initializingRef.current = false;
        setHasError(true);
        setIsLoading(false);
        onError?.(`Zoom SDK initialization failed: ${error.message}`);
      }
    }
  }, [containerRef, shouldInitialize, validateContainer, onReady, onError]);

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
      // Standard Zoom SDK join parameters following v3.13.2 documentation
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
            console.log('✅ [ZOOM-SDK] Successfully joined meeting:', result);
            setIsJoined(true);
          }
        },
        error: (error: any) => {
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
      };

      console.log('🔗 [ZOOM-SDK] Calling client.join() with params');
      
      // CRITICAL: Use callback-based join (matching the SDK pattern)
      return new Promise((resolve, reject) => {
        const enhancedParams = {
          ...joinParams,
          success: (result: any) => {
            if (mountedRef.current) {
              console.log('✅ [ZOOM-SDK] Successfully joined meeting:', result);
              setIsJoined(true);
              resolve(result);
            }
          },
          error: (error: any) => {
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
              
              reject(new Error(errorMessage));
            }
          }
        };

        clientRef.current.join(enhancedParams);
      });

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

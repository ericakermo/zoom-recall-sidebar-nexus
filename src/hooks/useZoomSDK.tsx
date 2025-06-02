
import { useState, useRef, useCallback, useEffect } from 'react';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

interface UseZoomSDKProps {
  containerRef: React.RefObject<HTMLDivElement>;
  shouldInitialize?: boolean;
  onReady?: () => void;
  onError?: (error: string) => void;
}

export function useZoomSDK({ containerRef, shouldInitialize = true, onReady, onError }: UseZoomSDKProps) {
  const [isSDKReady, setIsSDKReady] = useState(false);
  const [isMeetingJoined, setIsMeetingJoined] = useState(false);
  
  const clientRef = useRef<any>(null);
  const initAttemptedRef = useRef(false);
  const isJoiningRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const cleanup = useCallback(() => {
    console.log('🧹 [ZOOM-SDK-DEBUG] Starting cleanup...');
    
    if (clientRef.current) {
      try {
        if (isMeetingJoined && typeof clientRef.current.leave === 'function') {
          console.log('🧹 [ZOOM-SDK-DEBUG] Leaving meeting...');
          clientRef.current.leave();
        }
        
        if (typeof clientRef.current.destroy === 'function') {
          console.log('🧹 [ZOOM-SDK-DEBUG] Destroying client...');
          clientRef.current.destroy();
        }
      } catch (error) {
        console.warn('🧹 [ZOOM-SDK-DEBUG] Cleanup warning:', error);
      }
      
      clientRef.current = null;
    }

    if (containerRef.current) {
      console.log('🧹 [ZOOM-SDK-DEBUG] Clearing container HTML...');
      containerRef.current.innerHTML = '';
    }
    
    setIsSDKReady(false);
    setIsMeetingJoined(false);
    initAttemptedRef.current = false;
    isJoiningRef.current = false;
    
    console.log('🧹 [ZOOM-SDK-DEBUG] Cleanup completed');
  }, [isMeetingJoined, containerRef]);

  const validateContainer = useCallback(() => {
    console.log('🔍 [ZOOM-SDK-DEBUG] Starting container validation...');
    
    if (!containerRef.current) {
      console.log('❌ [ZOOM-SDK-DEBUG] Container ref is null');
      return false;
    }

    const element = containerRef.current;
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    const isInDOM = document.contains(element);
    
    console.log('🔍 [ZOOM-SDK-DEBUG] Container validation details:', {
      element: element,
      id: element.id,
      className: element.className,
      rect: {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left
      },
      computedStyle: {
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        position: computedStyle.position
      },
      isInDOM,
      parentElement: element.parentElement?.tagName,
      childElementCount: element.childElementCount
    });
    
    const isValid = rect.width > 0 && rect.height > 0 && isInDOM;
    console.log(`🔍 [ZOOM-SDK-DEBUG] Container validation result: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
    
    return isValid;
  }, [containerRef]);

  const initializeSDK = useCallback(async () => {
    console.log('🚀 [ZOOM-SDK-DEBUG] initializeSDK called with conditions:', {
      initAttempted: initAttemptedRef.current,
      hasContainer: !!containerRef.current,
      shouldInitialize,
      mounted: mountedRef.current
    });

    if (initAttemptedRef.current || !containerRef.current || !shouldInitialize || !mountedRef.current) {
      console.log('⏭️ [ZOOM-SDK-DEBUG] Skipping init - conditions not met');
      return false;
    }

    if (!validateContainer()) {
      console.warn('❌ [ZOOM-SDK-DEBUG] Container validation failed');
      return false;
    }

    initAttemptedRef.current = true;
    console.log('🚀 [ZOOM-SDK-DEBUG] Starting SDK initialization...');

    try {
      // Create Zoom client
      console.log('🔧 [ZOOM-SDK-DEBUG] Creating ZoomMtgEmbedded client...');
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      if (!clientRef.current) {
        throw new Error('Failed to create Zoom client - ZoomMtgEmbedded.createClient() returned null');
      }
      
      console.log('✅ [ZOOM-SDK-DEBUG] Zoom client created successfully:', clientRef.current);

      // Clear container
      console.log('🧹 [ZOOM-SDK-DEBUG] Clearing container before init...');
      containerRef.current.innerHTML = '';

      // Prepare init config
      const initConfig = {
        zoomAppRoot: containerRef.current,
        language: 'en-US',
        patchJsMedia: true,
        leaveOnPageUnload: true,
        disablePreview: false,
        success: () => {
          if (mountedRef.current) {
            console.log('🎉 [ZOOM-SDK-DEBUG] SDK initialization SUCCESS callback fired');
            setIsSDKReady(true);
            onReady?.();
          } else {
            console.log('⚠️ [ZOOM-SDK-DEBUG] Component unmounted before success callback');
          }
        },
        error: (event: any) => {
          if (mountedRef.current) {
            console.error('💥 [ZOOM-SDK-DEBUG] SDK initialization ERROR callback fired:', event);
            const errorMsg = event?.errorMessage || 'SDK initialization failed';
            initAttemptedRef.current = false;
            onError?.(errorMsg);
          } else {
            console.log('⚠️ [ZOOM-SDK-DEBUG] Component unmounted before error callback');
          }
        }
      };

      console.log('🔧 [ZOOM-SDK-DEBUG] Calling client.init() with config:', {
        zoomAppRoot: initConfig.zoomAppRoot?.tagName,
        language: initConfig.language,
        patchJsMedia: initConfig.patchJsMedia,
        leaveOnPageUnload: initConfig.leaveOnPageUnload,
        disablePreview: initConfig.disablePreview
      });

      await clientRef.current.init(initConfig);
      
      console.log('✅ [ZOOM-SDK-DEBUG] client.init() completed successfully');
      return true;

    } catch (error: any) {
      if (mountedRef.current) {
        console.error('💥 [ZOOM-SDK-DEBUG] Init error caught:', error);
        initAttemptedRef.current = false;
        onError?.(error.message || 'Failed to initialize Zoom SDK');
      }
      return false;
    }
  }, [containerRef, shouldInitialize, validateContainer, onReady, onError]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    console.log('🎯 [ZOOM-SDK-DEBUG] joinMeeting called with state:', {
      isSDKReady,
      hasClient: !!clientRef.current,
      isJoining: isJoiningRef.current,
      mounted: mountedRef.current
    });

    if (!isSDKReady || !clientRef.current || isJoiningRef.current || !mountedRef.current) {
      const errorMsg = `SDK not ready for join operation - isSDKReady: ${isSDKReady}, hasClient: ${!!clientRef.current}, isJoining: ${isJoiningRef.current}, mounted: ${mountedRef.current}`;
      console.error('❌ [ZOOM-SDK-DEBUG]', errorMsg);
      throw new Error(errorMsg);
    }

    isJoiningRef.current = true;
    console.log('🎯 [ZOOM-SDK-DEBUG] Starting join process...');

    const meetingNumberStr = String(joinConfig.meetingNumber).replace(/\s+/g, '');
    if (!/^\d{10,11}$/.test(meetingNumberStr)) {
      isJoiningRef.current = false;
      const errorMsg = `Invalid meeting number format: ${joinConfig.meetingNumber}`;
      console.error('❌ [ZOOM-SDK-DEBUG]', errorMsg);
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
            console.log('🎉 [ZOOM-SDK-DEBUG] Join SUCCESS callback fired:', success);
            setIsMeetingJoined(true);
            isJoiningRef.current = false;
          }
        },
        error: (error: any) => {
          if (mountedRef.current) {
            console.error('💥 [ZOOM-SDK-DEBUG] Join ERROR callback fired:', error);
            isJoiningRef.current = false;
            
            let errorMessage = 'Failed to join meeting';
            
            if (error?.errorCode === 200) {
              errorMessage = 'Meeting join failed - please check meeting details and try again';
            } else if (error?.errorCode === 3712) {
              errorMessage = 'Authentication failed - invalid signature';
            } else if (error?.errorCode === 1) {
              errorMessage = 'Meeting not found - please check meeting ID';
            } else if (error?.errorCode === 3000) {
              errorMessage = 'Meeting password required or incorrect';
            } else if (error?.reason) {
              errorMessage = error.reason;
            }
            
            throw new Error(errorMessage);
          }
        }
      };

      console.log('🔧 [ZOOM-SDK-DEBUG] Calling client.join() with params:', {
        sdkKey: joinParams.sdkKey?.substring(0, 8) + '...',
        signature: joinParams.signature ? '[SIGNATURE_PROVIDED]' : '[NO_SIGNATURE]',
        meetingNumber: joinParams.meetingNumber,
        userName: joinParams.userName,
        userEmail: joinParams.userEmail,
        hasZak: !!joinParams.zak,
        password: joinParams.password ? '[PASSWORD_PROVIDED]' : '[NO_PASSWORD]'
      });

      await clientRef.current.join(joinParams);
      
      console.log('✅ [ZOOM-SDK-DEBUG] client.join() completed successfully');
      return true;

    } catch (error: any) {
      if (mountedRef.current) {
        isJoiningRef.current = false;
        console.error('💥 [ZOOM-SDK-DEBUG] Join process failed:', error);
        throw error;
      }
    }
  }, [isSDKReady]);

  const leaveMeeting = useCallback(() => {
    console.log('👋 [ZOOM-SDK-DEBUG] leaveMeeting called with state:', {
      hasClient: !!clientRef.current,
      isMeetingJoined,
      mounted: mountedRef.current
    });

    if (clientRef.current && isMeetingJoined && mountedRef.current) {
      console.log('👋 [ZOOM-SDK-DEBUG] Executing leave...');
      try {
        clientRef.current.leave();
        setIsMeetingJoined(false);
        console.log('✅ [ZOOM-SDK-DEBUG] Leave completed successfully');
      } catch (error) {
        console.error('💥 [ZOOM-SDK-DEBUG] Leave error:', error);
      }
    } else {
      console.log('⏭️ [ZOOM-SDK-DEBUG] Leave skipped - conditions not met');
    }
  }, [isMeetingJoined]);

  // Initialize when conditions are right with improved timing
  useEffect(() => {
    console.log('⚡ [ZOOM-SDK-DEBUG] Init effect triggered with state:', {
      hasContainer: !!containerRef.current,
      shouldInitialize,
      initAttempted: initAttemptedRef.current,
      mounted: mountedRef.current
    });

    const initWhenReady = () => {
      if (containerRef.current && shouldInitialize && !initAttemptedRef.current && mountedRef.current) {
        console.log('⚡ [ZOOM-SDK-DEBUG] Conditions met, starting init sequence...');
        
        // Multiple validation checks with delays to ensure DOM is stable
        const checkAndInit = (attempt: number = 1) => {
          console.log(`🔍 [ZOOM-SDK-DEBUG] Container check attempt ${attempt}/3`);
          
          if (validateContainer()) {
            console.log('✅ [ZOOM-SDK-DEBUG] Container validation passed, initializing SDK...');
            initializeSDK();
          } else if (attempt < 3) {
            console.log(`⏳ [ZOOM-SDK-DEBUG] Container not ready, retrying in ${attempt * 100}ms...`);
            setTimeout(() => checkAndInit(attempt + 1), attempt * 100);
          } else {
            console.error('❌ [ZOOM-SDK-DEBUG] Container validation failed after 3 attempts');
            onError?.('Container not ready for Zoom SDK initialization');
          }
        };
        
        // Small delay to ensure DOM is fully rendered
        setTimeout(() => checkAndInit(), 50);
      } else {
        console.log('⏭️ [ZOOM-SDK-DEBUG] Init conditions not met, skipping');
      }
    };

    // Initial check
    initWhenReady();

    // Backup check on resize
    const handleResize = () => {
      if (!isSDKReady && containerRef.current && !initAttemptedRef.current) {
        console.log('📐 [ZOOM-SDK-DEBUG] Resize triggered, checking init...');
        initWhenReady();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [containerRef, shouldInitialize, initializeSDK, validateContainer, isSDKReady, onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🔚 [ZOOM-SDK-DEBUG] Component unmounting, running cleanup...');
      cleanup();
    };
  }, [cleanup]);

  return {
    isSDKReady,
    isMeetingJoined,
    joinMeeting,
    leaveMeeting,
    cleanup
  };
}

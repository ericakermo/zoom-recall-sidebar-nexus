
import { useState, useRef, useCallback, useEffect } from 'react';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

interface UseZoomSDKProps {
  containerRef: React.RefObject<HTMLDivElement>;
  shouldInitialize?: boolean;
  onReady?: () => void;
  onError?: (error: string) => void;
}

export function useZoomSDK({ containerRef, shouldInitialize = true, onReady, onError }: UseZoomSDKProps) {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  
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
    console.log('🔍 [ZOOM-SDK] Starting cleanup...');
    
    if (clientRef.current) {
      try {
        if (isJoined && typeof clientRef.current.leave === 'function') {
          clientRef.current.leave();
        }
        
        if (typeof clientRef.current.destroy === 'function') {
          clientRef.current.destroy();
        }
      } catch (error) {
        console.warn('🔍 [ZOOM-SDK] Cleanup warning:', error);
      }
      
      clientRef.current = null;
    }

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    
    setIsSDKLoaded(false);
    setIsReady(false);
    setIsJoined(false);
    initAttemptedRef.current = false;
    isJoiningRef.current = false;
    
    console.log('🔍 [ZOOM-SDK] Cleanup completed');
  }, [isJoined, containerRef]);

  const validateContainer = useCallback(() => {
    if (!containerRef.current) {
      return false;
    }

    const rect = containerRef.current.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }, [containerRef]);

  const initializeSDK = useCallback(async () => {
    if (initAttemptedRef.current || !containerRef.current || !shouldInitialize || !mountedRef.current) {
      return false;
    }

    if (!validateContainer()) {
      console.warn('🔍 [ZOOM-SDK] Container validation failed');
      return false;
    }

    initAttemptedRef.current = true;
    console.log('🔍 [ZOOM-SDK] Starting initialization...');

    try {
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      if (!clientRef.current) {
        throw new Error('Failed to create Zoom client');
      }

      containerRef.current.innerHTML = '';

      const initConfig = {
        zoomAppRoot: containerRef.current,
        language: 'en-US',
        patchJsMedia: true,
        leaveOnPageUnload: true,
        disablePreview: false,
        success: () => {
          if (mountedRef.current) {
            console.log('🔍 [ZOOM-SDK] Initialization successful');
            setIsSDKLoaded(true);
            setIsReady(true);
            onReady?.();
          }
        },
        error: (event: any) => {
          if (mountedRef.current) {
            console.error('🔍 [ZOOM-SDK] Initialization failed:', event);
            const errorMsg = event?.errorMessage || 'SDK initialization failed';
            onError?.(errorMsg);
          }
        }
      };

      await clientRef.current.init(initConfig);
      return true;

    } catch (error: any) {
      if (mountedRef.current) {
        console.error('🔍 [ZOOM-SDK] Init error:', error);
        initAttemptedRef.current = false;
        onError?.(error.message || 'Failed to initialize Zoom SDK');
      }
      return false;
    }
  }, [containerRef, shouldInitialize, validateContainer, onReady, onError]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    if (!isReady || !clientRef.current || isJoiningRef.current || !mountedRef.current) {
      throw new Error('SDK not ready for join operation');
    }

    isJoiningRef.current = true;
    console.log('🔍 [ZOOM-SDK] Starting join process...');

    const meetingNumberStr = String(joinConfig.meetingNumber).replace(/\s+/g, '');
    if (!/^\d{10,11}$/.test(meetingNumberStr)) {
      isJoiningRef.current = false;
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
            console.log('🔍 [ZOOM-SDK] Join successful:', success);
            setIsJoined(true);
            isJoiningRef.current = false;
          }
        },
        error: (error: any) => {
          if (mountedRef.current) {
            console.error('🔍 [ZOOM-SDK] Join failed:', error);
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

      await clientRef.current.join(joinParams);
      return true;

    } catch (error: any) {
      if (mountedRef.current) {
        isJoiningRef.current = false;
        throw error;
      }
    }
  }, [isReady]);

  const leaveMeeting = useCallback(() => {
    if (clientRef.current && isJoined && mountedRef.current) {
      console.log('🔍 [ZOOM-SDK] Leaving meeting...');
      try {
        clientRef.current.leave();
        setIsJoined(false);
      } catch (error) {
        console.error('🔍 [ZOOM-SDK] Leave error:', error);
      }
    }
  }, [isJoined]);

  // Initialize when container is ready
  useEffect(() => {
    if (containerRef.current && shouldInitialize && !initAttemptedRef.current && mountedRef.current) {
      const timer = setTimeout(() => {
        initializeSDK();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [containerRef, shouldInitialize, initializeSDK]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isSDKLoaded,
    isReady,
    isJoined,
    joinMeeting,
    leaveMeeting,
    cleanup
  };
}

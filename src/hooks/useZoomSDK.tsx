
import { useEffect, useRef, useState, useCallback } from 'react';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

interface UseZoomSDKProps {
  containerRef: React.RefObject<HTMLDivElement>;
  shouldInitialize?: boolean;
  onReady?: () => void;
  onError?: (error: string) => void;
}

interface JoinConfig {
  sdkKey: string;
  signature: string;
  meetingNumber: string;
  userName: string;
  userEmail: string;
  passWord: string;
  role: number;
  zak?: string;
}

export function useZoomSDK({
  containerRef,
  shouldInitialize = true,
  onReady,
  onError
}: UseZoomSDKProps) {
  const [isReady, setIsReady] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  const clientRef = useRef<any>(null);
  const initializationAttemptedRef = useRef(false);
  const mountedRef = useRef(true);

  const validateContainer = useCallback(() => {
    if (!containerRef.current) {
      console.error('❌ [ZOOM-SDK] Container ref not available');
      return false;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const isValid = rect.width > 0 && rect.height > 0;
    
    console.log('🔍 [ZOOM-SDK] Container validation:', {
      width: rect.width,
      height: rect.height,
      isInDOM: document.contains(containerRef.current),
      isValid
    });

    return isValid;
  }, [containerRef]);

  const handleError = useCallback((error: string) => {
    if (!mountedRef.current) return;
    
    console.error('❌ [ZOOM-SDK] Error occurred:', error);
    setHasError(true);
    setIsLoading(false);
    setIsReady(false);
    onError?.(error);
  }, [onError]);

  const initializeSDK = useCallback(async () => {
    if (initializationAttemptedRef.current || !mountedRef.current) {
      console.log('⏭️ [ZOOM-SDK] Initialization skipped - already attempted or unmounted');
      return;
    }

    if (!validateContainer()) {
      setTimeout(() => {
        if (mountedRef.current) initializeSDK();
      }, 100);
      return;
    }

    initializationAttemptedRef.current = true;
    setIsLoading(true);
    setHasError(false);

    try {
      console.log('🚀 [ZOOM-SDK] Initializing Zoom Meeting SDK v3.13.2');
      
      // Create the client
      const client = ZoomMtgEmbedded.createClient();
      clientRef.current = client;
      
      console.log('🔧 [ZOOM-SDK] Client created, configuring capabilities...');
      
      // Configure client capabilities
      const configResult = client.config({
        debug: true,
        zoomAppRoot: containerRef.current,
        language: 'en-US',
        customize: {
          video: {
            isResizable: true,
            viewSizes: {
              default: {
                width: '100%',
                height: '100%'
              }
            }
          }
        }
      });

      console.log('🔧 [ZOOM-SDK] Config result:', configResult);

      // Initialize with proper callbacks
      console.log('🔧 [ZOOM-SDK] Calling client.init() with callbacks...');
      
      client.init({
        success: () => {
          if (!mountedRef.current) return;
          
          console.log('✅ [ZOOM-SDK] Client initialized successfully');
          setIsReady(true);
          setIsLoading(false);
          setHasError(false);
          onReady?.();
        },
        error: (error: any) => {
          if (!mountedRef.current) return;
          
          console.error('❌ [ZOOM-SDK] Initialization failed:', error);
          const errorMessage = error?.errorMessage || error?.message || 'SDK initialization failed';
          handleError(errorMessage);
        }
      });

    } catch (error: any) {
      console.error('❌ [ZOOM-SDK] Exception during initialization:', error);
      handleError(error.message || 'Failed to initialize SDK');
    }
  }, [validateContainer, handleError, onReady, containerRef]);

  const joinMeeting = useCallback(async (config: JoinConfig) => {
    if (!clientRef.current || !isReady) {
      throw new Error('SDK not ready for joining');
    }

    console.log('🔗 [ZOOM-SDK] Attempting to join meeting with config:', {
      meetingNumber: config.meetingNumber,
      userName: config.userName,
      role: config.role,
      hasZAK: !!config.zak,
      hasSDKKey: !!config.sdkKey,
      hasSignature: !!config.signature
    });

    return new Promise((resolve, reject) => {
      clientRef.current.join({
        sdkKey: config.sdkKey,
        signature: config.signature,
        meetingNumber: config.meetingNumber,
        userName: config.userName,
        userEmail: config.userEmail,
        passWord: config.passWord,
        tk: config.zak || '',
        role: config.role,
        success: (res: any) => {
          console.log('✅ [ZOOM-SDK] Successfully joined meeting:', res);
          setIsJoined(true);
          resolve(res);
        },
        error: (error: any) => {
          console.error('❌ [ZOOM-SDK] Failed to join meeting:', error);
          const errorMessage = error?.errorMessage || error?.message || 'Failed to join meeting';
          reject(new Error(errorMessage));
        }
      });
    });
  }, [isReady]);

  const leaveMeeting = useCallback(async () => {
    if (!clientRef.current || !isJoined) {
      console.log('ℹ️ [ZOOM-SDK] No active meeting to leave');
      return;
    }

    try {
      console.log('🚪 [ZOOM-SDK] Leaving meeting...');
      await clientRef.current.leave();
      setIsJoined(false);
      console.log('✅ [ZOOM-SDK] Left meeting successfully');
    } catch (error: any) {
      console.error('❌ [ZOOM-SDK] Error leaving meeting:', error);
    }
  }, [isJoined]);

  const cleanup = useCallback(() => {
    console.log('🧹 [ZOOM-SDK] Starting cleanup');
    
    if (clientRef.current) {
      try {
        if (isJoined) {
          clientRef.current.leave();
        }
      } catch (error) {
        console.warn('⚠️ [ZOOM-SDK] Error during cleanup leave:', error);
      }
      
      clientRef.current = null;
    }
    
    setIsReady(false);
    setIsJoined(false);
    setIsLoading(false);
    setHasError(false);
    initializationAttemptedRef.current = false;
    
    console.log('✅ [ZOOM-SDK] Cleanup completed');
  }, [isJoined]);

  useEffect(() => {
    mountedRef.current = true;
    
    if (shouldInitialize) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          initializeSDK();
        }
      }, 100);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [shouldInitialize, initializeSDK]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      console.log('🔚 [ZOOM-SDK] Component unmounting');
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

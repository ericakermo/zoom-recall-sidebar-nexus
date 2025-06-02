
import { useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

interface UseZoomSDKProps {
  containerRef: React.RefObject<HTMLDivElement>;
  shouldInitialize?: boolean;
  onReady?: () => void;
  onError?: (error: string) => void;
}

// Singleton pattern to prevent multiple SDK instances
class ZoomSDKSingleton {
  private static instance: ZoomSDKSingleton;
  private client: any = null;
  private isInitialized = false;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): ZoomSDKSingleton {
    if (!ZoomSDKSingleton.instance) {
      ZoomSDKSingleton.instance = new ZoomSDKSingleton();
    }
    return ZoomSDKSingleton.instance;
  }

  async initialize(container: HTMLDivElement): Promise<any> {
    if (this.isInitialized && this.client) {
      console.log('✅ [ZOOM-SINGLETON] SDK already initialized, reusing client');
      return this.client;
    }

    if (this.isInitializing && this.initPromise) {
      console.log('⏳ [ZOOM-SINGLETON] SDK initialization in progress, waiting...');
      await this.initPromise;
      return this.client;
    }

    this.isInitializing = true;
    this.initPromise = this._doInitialize(container);
    
    try {
      await this.initPromise;
      return this.client;
    } finally {
      this.isInitializing = false;
      this.initPromise = null;
    }
  }

  private async _doInitialize(container: HTMLDivElement): Promise<void> {
    console.log('🚀 [ZOOM-SINGLETON] Initializing Zoom Meeting SDK');
    
    // Log SDK version information
    try {
      console.log('📋 [ZOOM-SINGLETON] SDK Info:', {
        version: ZoomMtgEmbedded.VERSION || 'unknown',
        hasCreateClient: typeof ZoomMtgEmbedded.createClient === 'function'
      });
    } catch (error) {
      console.warn('Warning getting SDK info:', error);
    }

    // Clear container and create client
    container.innerHTML = '';
    this.client = ZoomMtgEmbedded.createClient();
    
    if (!this.client) {
      throw new Error('Failed to create Zoom Meeting SDK client');
    }

    console.log('🔧 [ZOOM-SINGLETON] Client created successfully');

    // Initialize with proper configuration
    const initConfig = {
      zoomAppRoot: container,
      language: 'en-US',
    };

    console.log('🔧 [ZOOM-SINGLETON] Calling client.init()');
    
    await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Initialization timeout after 15 seconds'));
      }, 15000);

      this.client.init(initConfig)
        .then((result: any) => {
          clearTimeout(timeoutId);
          console.log('✅ [ZOOM-SINGLETON] Init completed successfully:', result);
          this.isInitialized = true;
          resolve(result);
        })
        .catch((error: any) => {
          clearTimeout(timeoutId);
          console.error('❌ [ZOOM-SINGLETON] Init failed:', error);
          this.reset();
          reject(error);
        });
    });
  }

  getClient(): any {
    return this.client;
  }

  isReady(): boolean {
    return this.isInitialized && this.client;
  }

  reset(): void {
    console.log('🔄 [ZOOM-SINGLETON] Resetting SDK singleton');
    this.isInitialized = false;
    this.isInitializing = false;
    this.initPromise = null;
    if (this.client) {
      try {
        this.client.destroy?.();
      } catch (error) {
        console.warn('Warning during client destroy:', error);
      }
      this.client = null;
    }
  }
}

export function useZoomSDK({ containerRef, shouldInitialize = true, onReady, onError }: UseZoomSDKProps) {
  const [isReady, setIsReady] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  const mountedRef = useRef(true);
  const initializingRef = useRef(false);
  const sdkSingleton = ZoomSDKSingleton.getInstance();
  const location = useLocation();

  // Navigation cleanup
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isJoined) {
        console.log('🌐 [ZOOM-SDK] Page unloading - leaving meeting');
        try {
          const client = sdkSingleton.getClient();
          if (client) {
            client.leave();
          }
        } catch (error) {
          console.warn('Warning during beforeunload cleanup:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isJoined, sdkSingleton]);

  // Route change cleanup
  useEffect(() => {
    return () => {
      if (isJoined) {
        console.log('🔄 [ZOOM-SDK] Route change - leaving meeting');
        try {
          const client = sdkSingleton.getClient();
          if (client) {
            client.leave();
          }
        } catch (error) {
          console.warn('Warning during route change cleanup:', error);
        }
      }
    };
  }, [location, isJoined, sdkSingleton]);

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

    initializingRef.current = true;
    setIsLoading(true);
    setHasError(false);

    try {
      console.log('🔄 [ZOOM-SDK] Starting SDK initialization via singleton');
      await sdkSingleton.initialize(containerRef.current!);
      
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
  }, [containerRef, shouldInitialize, validateContainer, onReady, onError, sdkSingleton]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    console.log('🎯 [ZOOM-SDK] Starting meeting join process');

    const client = sdkSingleton.getClient();
    if (!sdkSingleton.isReady() || !client || !mountedRef.current) {
      const errorMsg = `Cannot join meeting - SDK not ready (ready: ${sdkSingleton.isReady()}, client: ${!!client})`;
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
      const result = await client.join(joinParams);
      
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
  }, [sdkSingleton]);

  const leaveMeeting = useCallback(() => {
    console.log('👋 [ZOOM-SDK] Leaving meeting');

    const client = sdkSingleton.getClient();
    if (client && isJoined && mountedRef.current) {
      try {
        client.leave();
        setIsJoined(false);
        console.log('✅ [ZOOM-SDK] Left meeting successfully');
      } catch (error) {
        console.error('❌ [ZOOM-SDK] Leave error:', error);
      }
    }
  }, [isJoined, sdkSingleton]);

  const cleanup = useCallback(() => {
    console.log('🧹 [ZOOM-SDK] Starting cleanup');
    
    if (isJoined) {
      try {
        const client = sdkSingleton.getClient();
        if (client && typeof client.leave === 'function') {
          client.leave();
        }
      } catch (error) {
        console.warn('Warning during cleanup:', error);
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
    
    console.log('✅ [ZOOM-SDK] Cleanup completed');
  }, [isJoined, containerRef, sdkSingleton]);

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

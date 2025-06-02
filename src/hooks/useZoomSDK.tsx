
import { useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

interface UseZoomSDKProps {
  containerRef: React.RefObject<HTMLDivElement>;
  shouldInitialize?: boolean;
  onReady?: () => void;
  onError?: (error: string) => void;
}

// TRUE SINGLETON - only one client globally
class ZoomSDKSingleton {
  private static instance: ZoomSDKSingleton;
  private client: any = null;
  private isInitialized = false;
  private isInitializing = false;
  private isJoined = false;
  private isJoining = false;
  private currentContainer: HTMLDivElement | null = null;
  private listeners: Set<Function> = new Set();

  static getInstance(): ZoomSDKSingleton {
    if (!ZoomSDKSingleton.instance) {
      ZoomSDKSingleton.instance = new ZoomSDKSingleton();
    }
    return ZoomSDKSingleton.instance;
  }

  addListener(callback: Function) {
    this.listeners.add(callback);
  }

  removeListener(callback: Function) {
    this.listeners.delete(callback);
  }

  private notifyListeners(event: string, data?: any) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.warn('Listener error:', error);
      }
    });
  }

  async initialize(container: HTMLDivElement): Promise<void> {
    console.log('🔧 [ZOOM-SINGLETON] Initialize called', {
      isInitialized: this.isInitialized,
      isInitializing: this.isInitializing,
      hasClient: !!this.client,
      containerChanged: this.currentContainer !== container
    });

    // If already initialized with same container, return immediately
    if (this.isInitialized && this.client && this.currentContainer === container) {
      console.log('✅ [ZOOM-SINGLETON] Already initialized with same container');
      this.notifyListeners('ready');
      return;
    }

    // If initializing, wait for completion
    if (this.isInitializing) {
      console.log('⏳ [ZOOM-SINGLETON] Already initializing, waiting...');
      return new Promise((resolve) => {
        const checkReady = () => {
          if (this.isInitialized && !this.isInitializing) {
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });
    }

    // If we have a client but different container, clean up first
    if (this.client && this.currentContainer !== container) {
      console.log('🧹 [ZOOM-SINGLETON] Different container, cleaning up first');
      await this.cleanup();
    }

    this.isInitializing = true;
    this.currentContainer = container;

    try {
      console.log('🚀 [ZOOM-SINGLETON] Creating new client');
      
      // Clear container
      container.innerHTML = '';

      // Create client
      this.client = ZoomMtgEmbedded.createClient();
      
      if (!this.client) {
        throw new Error('Failed to create Zoom client');
      }

      console.log('🔧 [ZOOM-SINGLETON] Calling client.init()');
      
      // Initialize with timeout
      await Promise.race([
        new Promise((resolve, reject) => {
          this.client.init({
            zoomAppRoot: container,
            language: 'en-US',
          }).then(resolve).catch(reject);
        }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('SDK initialization timeout')), 15000);
        })
      ]);

      this.isInitialized = true;
      console.log('✅ [ZOOM-SINGLETON] SDK initialized successfully');
      this.notifyListeners('ready');

    } catch (error) {
      console.error('❌ [ZOOM-SINGLETON] Initialization failed:', error);
      this.client = null;
      this.isInitialized = false;
      this.currentContainer = null;
      this.notifyListeners('error', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  async join(config: any): Promise<void> {
    console.log('🎯 [ZOOM-SINGLETON] Join called', {
      isInitialized: this.isInitialized,
      isJoined: this.isJoined,
      isJoining: this.isJoining,
      hasClient: !!this.client
    });

    if (!this.isInitialized || !this.client) {
      throw new Error('SDK not initialized');
    }

    if (this.isJoined) {
      throw new Error('Already joined a meeting');
    }

    if (this.isJoining) {
      throw new Error('Join already in progress');
    }

    this.isJoining = true;

    try {
      console.log('🔗 [ZOOM-SINGLETON] Calling client.join()');
      
      const result = await this.client.join({
        sdkKey: config.sdkKey,
        signature: config.signature,
        meetingNumber: String(config.meetingNumber).replace(/\s+/g, ''),
        password: config.passWord || '',
        userName: config.userName || 'Guest',
        userEmail: config.userEmail || '',
        ...(config.zak && { zak: config.zak })
      });

      this.isJoined = true;
      console.log('✅ [ZOOM-SINGLETON] Successfully joined meeting');
      this.notifyListeners('joined', result);
      return result;

    } catch (error) {
      console.error('❌ [ZOOM-SINGLETON] Join failed:', error);
      this.notifyListeners('joinError', error);
      throw error;
    } finally {
      this.isJoining = false;
    }
  }

  async leave(): Promise<void> {
    console.log('👋 [ZOOM-SINGLETON] Leave called');
    
    if (this.client && this.isJoined) {
      try {
        await this.client.leave();
        this.isJoined = false;
        console.log('✅ [ZOOM-SINGLETON] Left meeting successfully');
        this.notifyListeners('left');
      } catch (error) {
        console.error('❌ [ZOOM-SINGLETON] Leave error:', error);
      }
    }
  }

  async cleanup(): Promise<void> {
    console.log('🧹 [ZOOM-SINGLETON] Cleanup called');
    
    if (this.isJoined) {
      await this.leave();
    }

    if (this.currentContainer) {
      this.currentContainer.innerHTML = '';
      this.currentContainer = null;
    }

    this.client = null;
    this.isInitialized = false;
    this.isInitializing = false;
    this.isJoining = false;
    this.listeners.clear();
    
    console.log('✅ [ZOOM-SINGLETON] Cleanup completed');
  }

  getState() {
    return {
      isInitialized: this.isInitialized,
      isJoined: this.isJoined,
      isInitializing: this.isInitializing,
      isJoining: this.isJoining,
      hasClient: !!this.client
    };
  }
}

const zoomSingleton = ZoomSDKSingleton.getInstance();

export function useZoomSDK({ containerRef, shouldInitialize = true, onReady, onError }: UseZoomSDKProps) {
  const [isReady, setIsReady] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  const mountedRef = useRef(true);
  const listenerRef = useRef<Function | null>(null);

  // Create listener function
  useEffect(() => {
    listenerRef.current = (event: string, data?: any) => {
      if (!mountedRef.current) return;

      console.log('📡 [ZOOM-SDK] Event received:', event, data);

      switch (event) {
        case 'ready':
          setIsReady(true);
          setIsLoading(false);
          setHasError(false);
          onReady?.();
          break;
        case 'error':
          setHasError(true);
          setIsLoading(false);
          onError?.(data?.message || 'SDK error');
          break;
        case 'joined':
          setIsJoined(true);
          break;
        case 'left':
          setIsJoined(false);
          break;
        case 'joinError':
          // Don't set hasError for join errors, let component handle it
          break;
      }
    };

    zoomSingleton.addListener(listenerRef.current);

    return () => {
      if (listenerRef.current) {
        zoomSingleton.removeListener(listenerRef.current);
      }
    };
  }, [onReady, onError]);

  // Initialize when container is ready
  useLayoutEffect(() => {
    if (!containerRef.current || !shouldInitialize || !mountedRef.current) {
      return;
    }

    const initializeSDK = async () => {
      try {
        await zoomSingleton.initialize(containerRef.current!);
      } catch (error) {
        console.error('SDK initialization failed:', error);
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initializeSDK, 100);

    return () => clearTimeout(timer);
  }, [containerRef, shouldInitialize]);

  // Update state from singleton on mount
  useLayoutEffect(() => {
    const state = zoomSingleton.getState();
    if (state.isInitialized) {
      setIsReady(true);
      setIsLoading(false);
      onReady?.();
    }
    setIsJoined(state.isJoined);
  }, [onReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      console.log('🔚 [ZOOM-SDK] Component unmounting');
    };
  }, []);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    return await zoomSingleton.join(joinConfig);
  }, []);

  const leaveMeeting = useCallback(async () => {
    await zoomSingleton.leave();
  }, []);

  const cleanup = useCallback(async () => {
    await zoomSingleton.cleanup();
    setIsReady(false);
    setIsJoined(false);
    setIsLoading(true);
    setHasError(false);
  }, []);

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

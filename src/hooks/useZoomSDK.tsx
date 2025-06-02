
import { useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

interface UseZoomSDKProps {
  containerRef: React.RefObject<HTMLDivElement>;
  shouldInitialize?: boolean;
  onReady?: () => void;
  onError?: (error: string) => void;
}

// TRUE SINGLETON - only one client globally with proper state management
class ZoomSDKSingleton {
  private static instance: ZoomSDKSingleton;
  private client: any = null;
  private isInitialized = false;
  private isInitializing = false;
  private isJoined = false;
  private isJoining = false;
  private currentContainer: HTMLDivElement | null = null;
  private listeners: Set<Function> = new Set();
  private initPromise: Promise<void> | null = null;
  private sessionId: string | null = null;

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
        console.warn('🚨 [ZOOM-SDK] Listener error:', error);
      }
    });
  }

  private validateContainer(container: HTMLDivElement): boolean {
    const rect = container.getBoundingClientRect();
    const isValid = container.id === 'meetingSDKElement' && 
                   rect.width > 0 && 
                   rect.height > 0 && 
                   document.body.contains(container);
    
    console.log('🔍 [ZOOM-SDK] Container validation:', {
      hasCorrectId: container.id === 'meetingSDKElement',
      width: rect.width,
      height: rect.height,
      isInDOM: document.body.contains(container),
      isVisible: rect.width > 0 && rect.height > 0
    });
    
    return isValid;
  }

  async initialize(container: HTMLDivElement): Promise<void> {
    console.log('🔧 [ZOOM-SDK] Initialize called', {
      isInitialized: this.isInitialized,
      isInitializing: this.isInitializing,
      hasClient: !!this.client,
      containerChanged: this.currentContainer !== container,
      sessionId: this.sessionId
    });

    // If already initialized with same container and session, return
    if (this.isInitialized && this.client && this.currentContainer === container && this.sessionId) {
      console.log('✅ [ZOOM-SDK] Already initialized with same container');
      this.notifyListeners('ready');
      return;
    }

    // If initializing, wait for existing promise
    if (this.isInitializing && this.initPromise) {
      console.log('⏳ [ZOOM-SDK] Already initializing, waiting...');
      return this.initPromise;
    }

    // If we have active session, clean up first
    if (this.isJoined || this.client) {
      console.log('🧹 [ZOOM-SDK] Cleaning up existing session first');
      await this.cleanup();
    }

    // Validate container
    if (!this.validateContainer(container)) {
      throw new Error('Invalid container for Zoom SDK');
    }

    this.isInitializing = true;
    this.currentContainer = container;
    this.sessionId = `session_${Date.now()}`;

    this.initPromise = this.performInitialization(container);
    
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async performInitialization(container: HTMLDivElement): Promise<void> {
    try {
      console.log('🚀 [ZOOM-SDK] Creating new client');
      
      // Clear container
      container.innerHTML = '';

      // Create client
      this.client = ZoomMtgEmbedded.createClient();
      
      if (!this.client) {
        throw new Error('Failed to create Zoom client');
      }

      console.log('🔧 [ZOOM-SDK] Calling client.init()');
      
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
      console.log('✅ [ZOOM-SDK] SDK initialized successfully');
      this.notifyListeners('ready');

    } catch (error) {
      console.error('❌ [ZOOM-SDK] Initialization failed:', error);
      this.client = null;
      this.isInitialized = false;
      this.currentContainer = null;
      this.sessionId = null;
      this.notifyListeners('error', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  async join(config: any): Promise<void> {
    console.log('🎯 [ZOOM-SDK] Join called', {
      isInitialized: this.isInitialized,
      isJoined: this.isJoined,
      isJoining: this.isJoining,
      hasClient: !!this.client,
      sessionId: this.sessionId
    });

    if (!this.isInitialized || !this.client) {
      throw new Error('SDK not initialized');
    }

    if (this.isJoined) {
      console.log('⚠️ [ZOOM-SDK] Already in meeting, leaving first');
      await this.leave();
    }

    if (this.isJoining) {
      throw new Error('Join already in progress');
    }

    this.isJoining = true;

    try {
      console.log('🔗 [ZOOM-SDK] Calling client.join()');
      
      const joinParams = {
        sdkKey: config.sdkKey,
        signature: config.signature,
        meetingNumber: String(config.meetingNumber).replace(/\s+/g, ''),
        password: config.passWord || '',
        userName: config.userName || 'Guest',
        userEmail: config.userEmail || '',
        ...(config.zak && { zak: config.zak })
      };

      console.log('📋 [ZOOM-SDK] Join params:', {
        meetingNumber: joinParams.meetingNumber,
        userName: joinParams.userName,
        hasSDKKey: !!joinParams.sdkKey,
        hasSignature: !!joinParams.signature,
        hasZAK: !!joinParams.zak
      });

      const result = await this.client.join(joinParams);

      this.isJoined = true;
      console.log('✅ [ZOOM-SDK] Successfully joined meeting');
      this.notifyListeners('joined', result);
      return result;

    } catch (error: any) {
      console.error('❌ [ZOOM-SDK] Join failed:', error);
      
      // Map specific errors correctly
      let mappedError = error;
      if (error?.type === 'JOIN_MEETING_FAILED') {
        if (error.errorCode === 3000) {
          mappedError = new Error('Another meeting is already in progress. Please end the current meeting first.');
        } else if (error.reason?.includes('Invalid meeting credentials')) {
          mappedError = new Error('Invalid meeting credentials - check meeting ID and password');
        } else if (error.reason?.includes('Meeting not found')) {
          mappedError = new Error('Meeting not found or has ended');
        }
      }
      
      this.notifyListeners('joinError', mappedError);
      throw mappedError;
    } finally {
      this.isJoining = false;
    }
  }

  async leave(): Promise<void> {
    console.log('👋 [ZOOM-SDK] Leave called');
    
    if (this.client && this.isJoined) {
      try {
        await this.client.leave();
        this.isJoined = false;
        console.log('✅ [ZOOM-SDK] Left meeting successfully');
        this.notifyListeners('left');
      } catch (error) {
        console.error('❌ [ZOOM-SDK] Leave error:', error);
      }
    }
  }

  async cleanup(): Promise<void> {
    console.log('🧹 [ZOOM-SDK] Cleanup called');
    
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
    this.sessionId = null;
    this.listeners.clear();
    
    console.log('✅ [ZOOM-SDK] Cleanup completed');
  }

  getState() {
    return {
      isInitialized: this.isInitialized,
      isJoined: this.isJoined,
      isInitializing: this.isInitializing,
      isJoining: this.isJoining,
      hasClient: !!this.client,
      sessionId: this.sessionId
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
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        console.error('❌ [ZOOM-SDK] Initialization failed:', error);
      }
    };

    // Clear any existing timeout
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
    }

    // Small delay to ensure DOM is ready
    initTimeoutRef.current = setTimeout(initializeSDK, 100);

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
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
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
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

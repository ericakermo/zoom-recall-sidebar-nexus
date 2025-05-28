
import { useState, useRef, useCallback, useEffect } from 'react';

interface UseSimpleZoomProps {
  onInitialized?: () => void;
  onError?: (error: string) => void;
}

export function useSimpleZoom({ onInitialized, onError }: UseSimpleZoomProps = {}) {
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const mountedRef = useRef(true);

  // Load CSS files synchronously
  const loadCSS = useCallback(async () => {
    const cssFiles = [
      'https://source.zoom.us/3.13.2/css/bootstrap.css',
      'https://source.zoom.us/3.13.2/css/react-select.css'
    ];

    for (const url of cssFiles) {
      if (!document.querySelector(`link[href="${url}"]`)) {
        await new Promise<void>((resolve, reject) => {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = url;
          link.onload = () => resolve();
          link.onerror = () => reject(new Error(`Failed to load CSS: ${url}`));
          document.head.appendChild(link);
        });
      }
    }
  }, []);

  // Load Zoom SDK
  const loadZoomSDK = useCallback(async () => {
    if (window.ZoomMtgEmbedded) {
      console.log('✅ Zoom SDK already loaded');
      setSdkLoaded(true);
      return;
    }

    try {
      console.log('🔄 Loading Zoom SDK dependencies...');

      // Make React available globally
      if (!window.React) {
        window.React = (await import('react')).default;
      }
      if (!window.ReactDOM) {
        window.ReactDOM = (await import('react-dom')).default;
      }

      // Load CSS first
      await loadCSS();
      console.log('✅ CSS files loaded');

      // Load SDK script
      if (!document.querySelector('script[src*="zoom-meeting-embedded"]')) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://source.zoom.us/3.13.2/zoom-meeting-embedded-3.13.2.min.js';
          script.async = false;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Zoom SDK script'));
          document.head.appendChild(script);
        });
      }

      // Wait for SDK to be available
      let attempts = 0;
      const maxAttempts = 100;
      
      while (!window.ZoomMtgEmbedded && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
      }

      if (!window.ZoomMtgEmbedded) {
        throw new Error('Zoom SDK failed to load after timeout');
      }

      console.log('✅ Zoom SDK loaded successfully');
      setSdkLoaded(true);
    } catch (error) {
      console.error('❌ Failed to load Zoom SDK:', error);
      onError?.(error.message);
      throw error;
    }
  }, [loadCSS, onError]);

  // Initialize Zoom client
  const initializeZoom = useCallback(async () => {
    if (!sdkLoaded || !containerRef.current || isInitializing || isReady) {
      console.log('⏸️ Skipping initialization:', { sdkLoaded, hasContainer: !!containerRef.current, isInitializing, isReady });
      return;
    }

    setIsInitializing(true);

    try {
      const container = containerRef.current;
      
      // Validate container
      if (!container.offsetHeight || !container.offsetWidth) {
        console.log('📐 Setting container dimensions...');
        container.style.minHeight = '500px';
        container.style.minWidth = '800px';
        container.style.width = '100%';
        container.style.height = '100%';
      }

      console.log('🔄 Creating Zoom client...');
      const client = window.ZoomMtgEmbedded.createClient();
      clientRef.current = client;

      console.log('🔄 Initializing client with container:', container.id);

      // Initialize with proper error handling
      await new Promise<void>((resolve, reject) => {
        const initConfig = {
          zoomAppRoot: container,
          language: 'en-US',
          patchJsMedia: true,
          leaveOnPageUnload: true,
          isSupportAV: true,
          isSupportChat: true,
          isSupportQA: true,
          isSupportCC: true,
          screenShare: true,
          success: () => {
            console.log('✅ Zoom client initialized successfully');
            if (mountedRef.current) {
              setIsReady(true);
              onInitialized?.();
            }
            resolve();
          },
          error: (error: any) => {
            console.error('❌ Zoom init failed:', error);
            const errorMsg = error.message || error.reason || error.type || 'Initialization failed';
            if (mountedRef.current) {
              onError?.(errorMsg);
            }
            reject(new Error(errorMsg));
          }
        };

        console.log('🔄 Calling client.init with config:', initConfig);
        client.init(initConfig);
      });

    } catch (error: any) {
      console.error('❌ Init error:', error);
      if (mountedRef.current) {
        onError?.(error.message);
      }
    } finally {
      if (mountedRef.current) {
        setIsInitializing(false);
      }
    }
  }, [sdkLoaded, isInitializing, isReady, onInitialized, onError]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    if (!clientRef.current || !isReady) {
      throw new Error('Client not ready');
    }

    console.log('🔄 Joining meeting with config:', joinConfig);
    
    return new Promise((resolve, reject) => {
      clientRef.current.join({
        ...joinConfig,
        success: (result: any) => {
          console.log('✅ Joined meeting successfully:', result);
          resolve(result);
        },
        error: (error: any) => {
          console.error('❌ Join failed:', error);
          reject(new Error(error.message || error.reason || 'Join failed'));
        }
      });
    });
  }, [isReady]);

  const cleanup = useCallback(() => {
    if (clientRef.current) {
      try {
        console.log('🔄 Cleaning up Zoom client');
        clientRef.current.leave();
      } catch (error) {
        console.error('❌ Cleanup error:', error);
      }
    }
    clientRef.current = null;
    setIsReady(false);
    setIsInitializing(false);
  }, []);

  // Load SDK on mount
  useEffect(() => {
    mountedRef.current = true;
    loadZoomSDK().catch(console.error);
    
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [loadZoomSDK, cleanup]);

  // Initialize when SDK is ready
  useEffect(() => {
    if (sdkLoaded && !isInitializing && !isReady) {
      // Small delay to ensure container is rendered
      const timer = setTimeout(initializeZoom, 100);
      return () => clearTimeout(timer);
    }
  }, [sdkLoaded, isInitializing, isReady, initializeZoom]);

  return {
    containerRef,
    isReady,
    isInitializing,
    sdkLoaded,
    initializeZoom,
    joinMeeting,
    cleanup
  };
}

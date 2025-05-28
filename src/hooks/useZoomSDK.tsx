
import { useState, useRef, useCallback, useEffect } from 'react';

declare global {
  interface Window {
    ZoomMtgEmbedded: any;
  }
}

interface UseZoomSDKProps {
  onReady?: () => void;
  onError?: (error: string) => void;
}

export function useZoomSDK({ onReady, onError }: UseZoomSDKProps = {}) {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [isClientReady, setIsClientReady] = useState(false);
  const clientRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);

  const loadSDK = useCallback(async () => {
    if (window.ZoomMtgEmbedded) {
      console.log('✅ Zoom SDK already available');
      setIsSDKLoaded(true);
      return;
    }

    try {
      console.log('🔄 Loading Zoom Meeting SDK...');

      // Make React available globally (required by Zoom SDK)
      if (!window.React) {
        window.React = (await import('react')).default;
      }
      if (!window.ReactDOM) {
        window.ReactDOM = (await import('react-dom')).default;
      }

      // Load CSS files
      const cssFiles = [
        'https://source.zoom.us/3.13.2/css/bootstrap.css',
        'https://source.zoom.us/3.13.2/css/react-select.css'
      ];

      for (const cssUrl of cssFiles) {
        if (!document.querySelector(`link[href="${cssUrl}"]`)) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = cssUrl;
          document.head.appendChild(link);
        }
      }

      // Load SDK script
      if (!document.querySelector('script[src*="zoom-meeting-embedded"]')) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://source.zoom.us/3.13.2/zoom-meeting-embedded-3.13.2.min.js';
          script.async = true;
          script.onload = () => {
            console.log('✅ Zoom SDK script loaded');
            resolve();
          };
          script.onerror = () => reject(new Error('Failed to load Zoom SDK'));
          document.head.appendChild(script);
        });
      }

      // Wait for SDK to be available
      let attempts = 0;
      while (!window.ZoomMtgEmbedded && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!window.ZoomMtgEmbedded) {
        throw new Error('Zoom SDK not available after loading');
      }

      console.log('✅ Zoom Meeting SDK loaded successfully');
      setIsSDKLoaded(true);
    } catch (error) {
      console.error('❌ Failed to load Zoom SDK:', error);
      onError?.(error.message);
    }
  }, [onError]);

  const initializeClient = useCallback(async () => {
    if (!isSDKLoaded || !containerRef.current || isInitializedRef.current) {
      return;
    }

    try {
      console.log('🔄 Initializing Zoom client...');
      isInitializedRef.current = true;

      const client = window.ZoomMtgEmbedded.createClient();
      clientRef.current = client;

      await new Promise<void>((resolve, reject) => {
        client.init({
          zoomAppRoot: containerRef.current,
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
            setIsClientReady(true);
            onReady?.();
            resolve();
          },
          error: (error: any) => {
            console.error('❌ Zoom client initialization failed:', error);
            const errorMsg = error.message || error.reason || 'Client initialization failed';
            onError?.(errorMsg);
            reject(new Error(errorMsg));
          }
        });
      });
    } catch (error) {
      console.error('❌ Client initialization error:', error);
      isInitializedRef.current = false;
      onError?.(error.message);
    }
  }, [isSDKLoaded, onReady, onError]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    if (!clientRef.current || !isClientReady) {
      throw new Error('Zoom client not ready');
    }

    console.log('🔄 Joining meeting...');
    
    return new Promise((resolve, reject) => {
      clientRef.current.join({
        ...joinConfig,
        success: (result: any) => {
          console.log('✅ Successfully joined meeting');
          resolve(result);
        },
        error: (error: any) => {
          console.error('❌ Failed to join meeting:', error);
          reject(new Error(error.message || error.reason || 'Failed to join meeting'));
        }
      });
    });
  }, [isClientReady]);

  const leaveMeeting = useCallback(() => {
    if (clientRef.current && typeof clientRef.current.leave === 'function') {
      console.log('🔄 Leaving meeting...');
      clientRef.current.leave();
    }
  }, []);

  // Load SDK on mount
  useEffect(() => {
    loadSDK();
  }, [loadSDK]);

  // Initialize client when SDK is loaded
  useEffect(() => {
    if (isSDKLoaded && containerRef.current && !isInitializedRef.current) {
      const timer = setTimeout(() => {
        initializeClient();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isSDKLoaded, initializeClient]);

  return {
    containerRef,
    isSDKLoaded,
    isClientReady,
    joinMeeting,
    leaveMeeting
  };
}

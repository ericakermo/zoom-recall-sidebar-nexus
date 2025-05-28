
import { useState, useRef, useCallback, useEffect } from 'react';

declare global {
  interface Window {
    ZoomMtg: any;
  }
}

interface UseZoomSDKProps {
  onReady?: () => void;
  onError?: (error: string) => void;
}

export function useZoomSDK({ onReady, onError }: UseZoomSDKProps = {}) {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadSDK = useCallback(async () => {
    if (window.ZoomMtg) {
      console.log('✅ Zoom SDK already available');
      setIsSDKLoaded(true);
      return;
    }

    try {
      console.log('🔄 Loading Zoom Meeting SDK...');

      // Load CSS files first
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

      // Load React dependencies
      if (!window.React) {
        await new Promise<void>((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://source.zoom.us/3.13.2/lib/vendor/react.min.js';
          script.async = true;
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
      }

      if (!window.ReactDOM) {
        await new Promise<void>((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://source.zoom.us/3.13.2/lib/vendor/react-dom.min.js';
          script.async = true;
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
      }

      // Load Zoom SDK
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://source.zoom.us/3.13.2/zoom-meeting-3.13.2.min.js';
        script.async = true;
        script.onload = () => {
          console.log('✅ Zoom SDK script loaded');
          resolve();
        };
        script.onerror = () => reject(new Error('Failed to load Zoom SDK'));
        document.head.appendChild(script);
      });

      // Wait for SDK to be available
      let attempts = 0;
      while (!window.ZoomMtg && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!window.ZoomMtg) {
        throw new Error('Zoom SDK not available after loading');
      }

      console.log('✅ Zoom Meeting SDK loaded successfully');
      setIsSDKLoaded(true);
    } catch (error) {
      console.error('❌ Failed to load Zoom SDK:', error);
      onError?.(error.message);
    }
  }, [onError]);

  const initializeSDK = useCallback(() => {
    if (!isSDKLoaded || !window.ZoomMtg) {
      return;
    }

    try {
      console.log('🔄 Initializing Zoom SDK...');
      
      // Follow the exact pattern from the working sample
      window.ZoomMtg.setZoomJSLib('https://source.zoom.us/3.13.2/lib', '/av');
      window.ZoomMtg.preLoadWasm();
      window.ZoomMtg.prepareWebSDK();
      window.ZoomMtg.i18n.load('en-US');
      window.ZoomMtg.i18n.reload('en-US');

      console.log('✅ Zoom SDK initialized');
      setIsReady(true);
      onReady?.();
    } catch (error) {
      console.error('❌ Failed to initialize Zoom SDK:', error);
      onError?.(error.message);
    }
  }, [isSDKLoaded, onReady, onError]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    if (!isReady || !window.ZoomMtg) {
      throw new Error('Zoom SDK not ready');
    }

    console.log('🔄 Joining meeting...');
    
    return new Promise((resolve, reject) => {
      window.ZoomMtg.init({
        leaveUrl: '/calendar',
        disableCORP: !window.crossOriginIsolated,
        success: () => {
          console.log('✅ ZoomMtg.init success');
          
          window.ZoomMtg.join({
            meetingNumber: joinConfig.meetingNumber,
            userName: joinConfig.userName,
            signature: joinConfig.signature,
            sdkKey: joinConfig.sdkKey,
            userEmail: joinConfig.userEmail,
            passWord: joinConfig.passWord,
            success: (result: any) => {
              console.log('✅ Successfully joined meeting');
              resolve(result);
            },
            error: (error: any) => {
              console.error('❌ Failed to join meeting:', error);
              reject(new Error(error.message || error.reason || 'Failed to join meeting'));
            }
          });
        },
        error: (error: any) => {
          console.error('❌ ZoomMtg.init failed:', error);
          reject(new Error(error.message || error.reason || 'Failed to initialize meeting'));
        }
      });
    });
  }, [isReady]);

  const leaveMeeting = useCallback(() => {
    if (window.ZoomMtg && typeof window.ZoomMtg.endMeeting === 'function') {
      console.log('🔄 Leaving meeting...');
      window.ZoomMtg.endMeeting();
    }
  }, []);

  // Load SDK on mount
  useEffect(() => {
    loadSDK();
  }, [loadSDK]);

  // Initialize SDK when loaded
  useEffect(() => {
    if (isSDKLoaded) {
      initializeSDK();
    }
  }, [isSDKLoaded, initializeSDK]);

  return {
    containerRef,
    isSDKLoaded,
    isReady,
    joinMeeting,
    leaveMeeting
  };
}


import { useState, useRef, useCallback } from 'react';

interface UseZoomSDKReturn {
  sdkReady: boolean;
  error: string | null;
  currentStep: string;
  mountedRef: React.MutableRefObject<boolean>;
  logStep: (step: string, data?: any) => void;
  handleError: (errorMessage: string, details?: any) => void;
  loadZoomSDK: () => Promise<boolean>;
}

export function useZoomSDK(onMeetingError?: (error: string) => void): UseZoomSDKReturn {
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState('Initializing...');
  const mountedRef = useRef(true);

  const logStep = useCallback((step: string, data?: any) => {
    console.log(`🔄 [ZoomComponentView] ${step}`, data || '');
    if (mountedRef.current) {
      setCurrentStep(step);
    }
  }, []);

  const handleError = useCallback((errorMessage: string, details?: any) => {
    console.error('❌ [ZoomComponentView] Error:', errorMessage, details);
    if (mountedRef.current) {
      setError(errorMessage);
      onMeetingError?.(errorMessage);
    }
  }, [onMeetingError]);

  const loadZoomSDK = useCallback(async () => {
    if (window.ZoomMtgEmbedded || sdkReady) {
      logStep('SDK already loaded');
      setSdkReady(true);
      return true;
    }

    try {
      logStep('Loading Zoom Component SDK...');
      
      // Make React available globally (CRITICAL for SDK)
      if (!window.React) {
        logStep('Loading React globally...');
        window.React = (await import('react')).default;
      }
      if (!window.ReactDOM) {
        logStep('Loading ReactDOM globally...');
        window.ReactDOM = (await import('react-dom')).default;
      }

      // Load CSS files first
      logStep('Loading Zoom CSS files...');
      const cssFiles = [
        'https://source.zoom.us/3.13.2/css/bootstrap.css',
        'https://source.zoom.us/3.13.2/css/react-select.css'
      ];

      await Promise.all(cssFiles.map(url => {
        return new Promise<void>((resolve) => {
          if (document.querySelector(`link[href="${url}"]`)) {
            resolve();
            return;
          }
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = url;
          link.onload = () => resolve();
          link.onerror = () => resolve(); // Don't fail on CSS errors
          document.head.appendChild(link);
        });
      }));

      // Load SDK script
      logStep('Loading Zoom SDK script...');
      await new Promise<void>((resolve, reject) => {
        if (document.querySelector('script[src*="zoom-meeting-embedded"]')) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://source.zoom.us/3.13.2/zoom-meeting-embedded-3.13.2.min.js';
        script.async = false;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Zoom SDK script'));
        document.head.appendChild(script);
      });

      // Wait for SDK to be available with better polling
      logStep('Waiting for ZoomMtgEmbedded...');
      let attempts = 0;
      const maxAttempts = 100;
      
      while (!window.ZoomMtgEmbedded && attempts < maxAttempts && mountedRef.current) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
      }

      if (!window.ZoomMtgEmbedded) {
        throw new Error('Zoom SDK failed to initialize after timeout');
      }

      logStep('✅ Zoom Component SDK loaded successfully');
      
      if (mountedRef.current) {
        setSdkReady(true);
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to load Zoom SDK:', error);
      throw error;
    }
  }, [sdkReady, logStep]);

  return {
    sdkReady,
    error,
    currentStep,
    mountedRef,
    logStep,
    handleError,
    loadZoomSDK
  };
}

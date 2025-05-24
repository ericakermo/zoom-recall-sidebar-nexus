
import { useState, useEffect, useRef, useCallback } from 'react';

export function useZoomComponentSDK() {
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const clientRef = useRef<any>(null);

  useEffect(() => {
    const loadSDK = async () => {
      try {
        // Check if SDK is already loaded
        if (window.ZoomMtgEmbedded) {
          setSdkLoaded(true);
          return;
        }

        // Load CSS
        const cssFiles = [
          'https://source.zoom.us/3.13.2/css/bootstrap.css',
          'https://source.zoom.us/3.13.2/css/react-select.css'
        ];

        const loadCss = (url: string): Promise<void> => {
          return new Promise((resolve) => {
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
        };

        await Promise.all(cssFiles.map(loadCss));

        // Make React available globally
        if (!window.React) {
          window.React = (await import('react')).default;
        }
        if (!window.ReactDOM) {
          window.ReactDOM = (await import('react-dom')).default;
        }

        // Load SDK script
        await new Promise<void>((resolve, reject) => {
          if (document.querySelector('script[src*="zoom-meeting-embedded"]')) {
            resolve();
            return;
          }

          const script = document.createElement('script');
          script.src = 'https://source.zoom.us/3.13.2/zoom-meeting-embedded-3.13.2.min.js';
          script.async = false;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Zoom SDK'));
          document.head.appendChild(script);
        });

        // Wait for ZoomMtgEmbedded to be available
        let attempts = 0;
        const maxAttempts = 30;
        
        while (!window.ZoomMtgEmbedded && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (!window.ZoomMtgEmbedded) {
          throw new Error('Zoom SDK failed to initialize');
        }

        setSdkLoaded(true);
      } catch (err: any) {
        console.error('Failed to load Zoom SDK:', err);
        setError(err.message);
      }
    };

    loadSDK();
  }, []);

  const initializeClient = useCallback(async (container: HTMLElement) => {
    if (!sdkLoaded || !window.ZoomMtgEmbedded) {
      throw new Error('SDK not loaded');
    }

    if (clientRef.current) {
      console.log('Client already exists, reusing');
      return clientRef.current;
    }

    try {
      const client = window.ZoomMtgEmbedded.createClient();
      
      await client.init({
        zoomAppRoot: container,
        language: 'en-US',
        sdkKey: 'eFAZ8Vf7RbG5saQVqL1zGA',
        debug: true,
        isSupportAV: true,
        isSupportChat: true,
        screenShare: true,
        success: () => {
          console.log('Component SDK initialized successfully');
          setIsInitialized(true);
        },
        error: (error: any) => {
          console.error('Component SDK init error:', error);
          setError(`Initialization failed: ${error.message || error.reason || 'Unknown error'}`);
        }
      });

      clientRef.current = client;
      return client;
    } catch (err: any) {
      console.error('Error initializing client:', err);
      setError(err.message);
      throw err;
    }
  }, [sdkLoaded]);

  const joinMeeting = useCallback(async (params: {
    meetingNumber: string;
    userName: string;
    signature: string;
    password?: string;
    userEmail?: string;
  }) => {
    if (!clientRef.current) {
      throw new Error('Client not initialized');
    }

    try {
      await clientRef.current.join({
        topic: `Meeting ${params.meetingNumber}`,
        signature: params.signature, // OAuth token goes here in Component SDK
        meetingNumber: params.meetingNumber,
        userName: params.userName,
        userEmail: params.userEmail,
        passWord: params.password || '',
        success: (result: any) => {
          console.log('Successfully joined meeting:', result);
        },
        error: (error: any) => {
          console.error('Failed to join meeting:', error);
          setError(`Join failed: ${error.message || error.reason || 'Unknown error'}`);
        }
      });
    } catch (err: any) {
      console.error('Error joining meeting:', err);
      setError(err.message);
      throw err;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (clientRef.current) {
      try {
        // Component SDK handles cleanup automatically
        // No manual leave() call needed
        console.log('Cleaning up Zoom client');
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    }
    clientRef.current = null;
    setIsInitialized(false);
  }, []);

  return {
    sdkLoaded,
    error,
    isInitialized,
    initializeClient,
    joinMeeting,
    cleanup,
    client: clientRef.current
  };
}


import { useState, useEffect, useRef, useCallback } from 'react';
import { loadZoomComponentSDK } from '@/lib/zoom-component-config';

export function useZoomComponentSDK() {
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const clientRef = useRef<any>(null);
  const initPromiseRef = useRef<Promise<any> | null>(null);

  useEffect(() => {
    const loadSDK = async () => {
      try {
        await loadZoomComponentSDK();
        setSdkLoaded(true);
        setError(null);
      } catch (err: any) {
        console.error('Failed to load Zoom SDK:', err);
        setError(err.message);
        setSdkLoaded(false);
      }
    };

    loadSDK();
  }, []);

  const initializeClient = useCallback(async (container: HTMLElement) => {
    if (!sdkLoaded || !window.ZoomMtgEmbedded) {
      throw new Error('SDK not loaded');
    }

    if (!container) {
      throw new Error('Container element is required');
    }

    // Return existing promise if initialization is in progress
    if (initPromiseRef.current) {
      return initPromiseRef.current;
    }

    // Return existing client if already initialized
    if (clientRef.current && isInitialized) {
      return clientRef.current;
    }

    initPromiseRef.current = (async () => {
      try {
        console.log('🔄 Initializing Zoom client...');
        
        const client = window.ZoomMtgEmbedded.createClient();
        
        await client.init({
          zoomAppRoot: container,
          language: 'en-US',
          debug: true,
          isSupportAV: true,
          isSupportChat: true,
          screenShare: true,
          success: () => {
            console.log('✅ Component SDK initialized successfully');
            setIsInitialized(true);
          },
          error: (error: any) => {
            console.error('❌ Component SDK init error:', error);
            const errorMessage = error.message || error.reason || 'Unknown initialization error';
            setError(`Initialization failed: ${errorMessage}`);
            throw new Error(errorMessage);
          }
        });

        clientRef.current = client;
        setIsInitialized(true);
        initPromiseRef.current = null; // Clear promise after success
        
        return client;
      } catch (err: any) {
        console.error('❌ Error initializing client:', err);
        setError(err.message);
        initPromiseRef.current = null; // Clear promise on error
        throw err;
      }
    })();

    return initPromiseRef.current;
  }, [sdkLoaded, isInitialized]);

  const joinMeeting = useCallback(async (params: {
    meetingNumber: string;
    userName: string;
    signature: string;
    password?: string;
    userEmail?: string;
    sdkKey: string;
    role?: number;
    zak?: string;
  }) => {
    if (!clientRef.current) {
      throw new Error('Client not initialized');
    }

    try {
      console.log('🔄 Joining meeting with params:', {
        meetingNumber: params.meetingNumber,
        userName: params.userName,
        hasSignature: !!params.signature,
        role: params.role,
        hasZak: !!params.zak
      });

      await clientRef.current.join({
        sdkKey: params.sdkKey,
        signature: params.signature,
        meetingNumber: params.meetingNumber,
        userName: params.userName,
        userEmail: params.userEmail,
        passWord: params.password || '',
        role: params.role || 0,
        zak: params.zak,
        success: (result: any) => {
          console.log('✅ Successfully joined meeting:', result);
        },
        error: (error: any) => {
          console.error('❌ Failed to join meeting:', error);
          const errorMessage = error.message || error.reason || 'Unknown join error';
          setError(`Join failed: ${errorMessage}`);
          throw new Error(errorMessage);
        }
      });
    } catch (err: any) {
      console.error('❌ Error joining meeting:', err);
      setError(err.message);
      throw err;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (clientRef.current) {
      try {
        console.log('🔄 Cleaning up Zoom client');
        if (typeof clientRef.current.leave === 'function') {
          clientRef.current.leave();
        }
      } catch (error) {
        console.error('❌ Error during cleanup:', error);
      }
    }
    clientRef.current = null;
    setIsInitialized(false);
    initPromiseRef.current = null;
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

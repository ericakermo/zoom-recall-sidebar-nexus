
import { useState, useEffect, useRef } from 'react';
import { loadZoomSDK } from '@/lib/zoom-config';

export function useZoomSDK() {
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<any>(null);

  useEffect(() => {
    const initSDK = async () => {
      try {
        await loadZoomSDK();
        console.log('Zoom Component SDK loaded successfully');
        setSdkLoaded(true);
      } catch (err: any) {
        console.error('Failed to load Zoom SDK:', err);
        setError(err.message || 'Failed to load Zoom SDK');
      }
    };

    initSDK();
  }, []);

  const createClient = () => {
    if (!window.ZoomMtgEmbedded) {
      throw new Error('Zoom SDK not loaded');
    }
    
    const client = window.ZoomMtgEmbedded.createClient();
    clientRef.current = client;
    return client;
  };

  const cleanup = () => {
    if (clientRef.current) {
      try {
        clientRef.current.leave();
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
      clientRef.current = null;
    }
  };

  return {
    sdkLoaded,
    error,
    createClient,
    cleanup,
    client: clientRef.current
  };
}

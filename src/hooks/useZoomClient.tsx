
import { useState, useRef, useCallback, useEffect } from 'react';
import { initializeZoomClient, cleanupZoomClient, getZoomClient } from '@/lib/zoomClientSingleton';

interface UseZoomClientProps {
  onInitialized?: (client: any) => void;
  onError?: (error: string) => void;
}

export function useZoomClient({ onInitialized, onError }: UseZoomClientProps = {}) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const mountedRef = useRef(true);

  const initializeClient = useCallback(async () => {
    if (isInitializing || isInitialized || !containerRef.current || !mountedRef.current) {
      return;
    }

    setIsInitializing(true);

    try {
      console.log('Starting Zoom client initialization...');
      
      // Ensure container is properly sized and visible
      const container = containerRef.current;
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.minHeight = '400px';
        
        // Wait for the DOM to update
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 100)));
      }
      
      if (!mountedRef.current) return;

      const client = await initializeZoomClient(containerRef.current);
      
      if (mountedRef.current) {
        clientRef.current = client;
        setIsInitialized(true);
        onInitialized?.(client);
      }
    } catch (error: any) {
      console.error('Failed to initialize Zoom client:', error);
      if (mountedRef.current) {
        onError?.(error.message);
      }
    } finally {
      if (mountedRef.current) {
        setIsInitializing(false);
      }
    }
  }, [isInitializing, isInitialized, onInitialized, onError]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    if (!clientRef.current) {
      throw new Error('Client not initialized');
    }

    return new Promise((resolve, reject) => {
      const config = {
        ...joinConfig,
        success: (result: any) => {
          console.log('✅ Successfully joined meeting');
          resolve(result);
        },
        error: (error: any) => {
          console.error('❌ Failed to join meeting:', error);
          reject(new Error(error.message || error.reason || 'Join failed'));
        }
      };

      clientRef.current.join(config);
    });
  }, []);

  const leaveMeeting = useCallback(async () => {
    if (clientRef.current) {
      try {
        await clientRef.current.leave();
        console.log('✅ Successfully left meeting');
      } catch (error) {
        console.error('❌ Error leaving meeting:', error);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      if (clientRef.current) {
        leaveMeeting();
      }
    };
  }, [leaveMeeting]);

  return {
    containerRef,
    clientRef,
    isInitialized,
    isInitializing,
    initializeClient,
    joinMeeting,
    leaveMeeting
  };
}

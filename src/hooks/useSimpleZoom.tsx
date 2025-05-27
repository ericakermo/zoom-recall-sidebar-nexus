
import { useState, useRef, useCallback, useEffect } from 'react';
import { createZoomClient, resetZoomState } from '@/lib/zoomSingleton';

interface UseSimpleZoomProps {
  onInitialized?: () => void;
  onError?: (error: string) => void;
}

export function useSimpleZoom({ onInitialized, onError }: UseSimpleZoomProps = {}) {
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const mountedRef = useRef(true);

  const initializeZoom = useCallback(async () => {
    if (isInitializing || isReady || !containerRef.current || !mountedRef.current) {
      return;
    }

    setIsInitializing(true);

    try {
      console.log('🔄 Creating fresh Zoom client...');
      
      const client = createZoomClient();
      clientRef.current = client;

      const container = containerRef.current;
      console.log('🔄 Initializing with container:', container.id);

      // Simple init following Zoom docs exactly
      await new Promise<void>((resolve, reject) => {
        client.init({
          zoomAppRoot: container,
          language: 'en-US',
          success: () => {
            console.log('✅ Zoom initialized successfully');
            if (mountedRef.current) {
              setIsReady(true);
              onInitialized?.();
            }
            resolve();
          },
          error: (err: any) => {
            console.error('❌ Zoom init failed:', err);
            const errorMsg = err.message || err.reason || 'Initialization failed';
            if (mountedRef.current) {
              onError?.(errorMsg);
            }
            reject(new Error(errorMsg));
          }
        });
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
  }, [isInitializing, isReady, onInitialized, onError]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    if (!clientRef.current || !isReady) {
      throw new Error('Client not ready');
    }

    console.log('🔄 Joining meeting...');
    
    return new Promise((resolve, reject) => {
      clientRef.current.join({
        ...joinConfig,
        success: (result: any) => {
          console.log('✅ Joined meeting successfully');
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
    resetZoomState();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  return {
    containerRef,
    isReady,
    isInitializing,
    initializeZoom,
    joinMeeting,
    cleanup
  };
}

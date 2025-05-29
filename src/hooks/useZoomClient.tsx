
import { useState, useRef, useCallback, useEffect } from 'react';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

interface UseZoomClientProps {
  onReady?: () => void;
  onError?: (error: string) => void;
  onJoined?: () => void;
  onLeft?: () => void;
}

export function useZoomClient({ onReady, onError, onJoined, onLeft }: UseZoomClientProps = {}) {
  const [isReady, setIsReady] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);

  const initializeClient = useCallback(async () => {
    if (!containerRef.current || clientRef.current) return;

    try {
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      await clientRef.current.init({
        zoomAppRoot: containerRef.current,
        language: 'en-US',
        customize: {
          video: {
            isResizable: false,
            viewSizes: {
              default: {
                width: containerRef.current.offsetWidth,
                height: containerRef.current.offsetHeight
              }
            }
          }
        }
      });

      setIsReady(true);
      onReady?.();
    } catch (error: any) {
      console.error('Failed to initialize Zoom client:', error);
      onError?.(error.message);
    }
  }, [onReady, onError]);

  const joinMeeting = useCallback(async (config: any) => {
    if (!clientRef.current || !isReady) {
      throw new Error('Zoom client not ready');
    }

    try {
      await clientRef.current.join(config);
      setIsJoined(true);
      onJoined?.();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to join meeting');
    }
  }, [isReady, onJoined]);

  const leaveMeeting = useCallback(() => {
    if (clientRef.current && isJoined) {
      try {
        clientRef.current.leave();
        setIsJoined(false);
        onLeft?.();
      } catch (error) {
        console.error('Error leaving meeting:', error);
      }
    }
  }, [isJoined, onLeft]);

  const cleanup = useCallback(() => {
    if (clientRef.current) {
      try {
        if (isJoined) clientRef.current.leave();
        clientRef.current.destroy();
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
      clientRef.current = null;
    }
    setIsReady(false);
    setIsJoined(false);
  }, [isJoined]);

  useEffect(() => {
    if (containerRef.current) {
      initializeClient();
    }
    return cleanup;
  }, [initializeClient, cleanup]);

  return {
    containerRef,
    isReady,
    isJoined,
    joinMeeting,
    leaveMeeting,
    cleanup
  };
}

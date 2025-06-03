
import { useState, useEffect, useCallback, useRef } from 'react';
import { zoomSDK, ZoomJoinConfig } from '@/lib/zoom-sdk-manager';

export function useZoomMeeting() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);

  const initializeSDK = useCallback(async () => {
    if (!containerRef.current || isInitializing) {
      return;
    }

    // Return existing promise if already initializing
    if (initPromiseRef.current) {
      return initPromiseRef.current;
    }

    setIsInitializing(true);
    setError(null);

    initPromiseRef.current = (async () => {
      try {
        await zoomSDK.initialize({
          zoomAppRoot: containerRef.current!,
          debug: true,
          language: 'en-US'
        });
        console.log('✅ [USE-ZOOM] SDK initialized successfully');
      } catch (error: any) {
        console.error('❌ [USE-ZOOM] SDK initialization failed:', error);
        setError(error.message);
        throw error;
      } finally {
        setIsInitializing(false);
        initPromiseRef.current = null;
      }
    })();

    return initPromiseRef.current;
  }, [isInitializing]);

  const joinMeeting = useCallback(async (config: ZoomJoinConfig) => {
    if (isJoining || isJoined) {
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      // Ensure SDK is initialized first
      await initializeSDK();
      
      // Join the meeting
      await zoomSDK.joinMeeting(config);
      setIsJoined(true);
      console.log('✅ [USE-ZOOM] Meeting joined successfully');
    } catch (error: any) {
      console.error('❌ [USE-ZOOM] Join failed:', error);
      setError(error.message);
    } finally {
      setIsJoining(false);
    }
  }, [isJoining, isJoined, initializeSDK]);

  const leaveMeeting = useCallback(async () => {
    if (!isJoined) return;

    try {
      await zoomSDK.leaveMeeting();
      setIsJoined(false);
      console.log('✅ [USE-ZOOM] Left meeting successfully');
    } catch (error: any) {
      console.error('❌ [USE-ZOOM] Leave failed:', error);
      setError(error.message);
    }
  }, [isJoined]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      zoomSDK.cleanup();
    };
  }, []);

  return {
    containerRef,
    isInitializing,
    isJoining,
    isJoined,
    error,
    initializeSDK,
    joinMeeting,
    leaveMeeting,
    sdkStatus: zoomSDK.getStatus()
  };
}


import { useState, useRef, useCallback, useEffect } from 'react';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

interface UseZoomSDKProps {
  onReady?: () => void;
  onError?: (error: string) => void;
}

export function useZoomSDKEnhanced({ onReady, onError }: UseZoomSDKProps = {}) {
  const [isReady, setIsReady] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const clientRef = useRef<any>(null);

  const initializeSDK = useCallback(async () => {
    if (clientRef.current) {
      console.log('⏸️ SDK already initialized');
      return;
    }

    console.log('🔄 Starting SDK initialization...');
    
    const container = document.getElementById('meetingSDKElement');
    if (!container) {
      throw new Error('Meeting container not found');
    }

    try {
      clientRef.current = ZoomMtgEmbedded.createClient();

      await clientRef.current.init({
        debug: true,
        zoomAppRoot: container,
        assetPath: '/lib',
        language: 'en-US'
      });
      
      setIsReady(true);
      onReady?.();
      console.log('✅ SDK initialization complete');
    } catch (error: any) {
      console.error('❌ SDK initialization failed:', error);
      clientRef.current = null;
      onError?.(error.message || 'Failed to initialize Zoom SDK');
    }
  }, [onReady, onError]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    if (!isReady || !clientRef.current || isJoining || isJoined) {
      throw new Error('SDK not ready or already joining/joined');
    }

    setIsJoining(true);
    
    try {
      const meetingConfig = {
        sdkKey: joinConfig.sdkKey,
        signature: joinConfig.signature,
        meetingNumber: String(joinConfig.meetingNumber).replace(/\s+/g, ''),
        password: joinConfig.password || '',
        userName: joinConfig.userName,
        userEmail: joinConfig.userEmail || '',
        zak: joinConfig.zak || ''
      };

      await clientRef.current.join(meetingConfig);
      
      setIsJoined(true);
      setIsJoining(false);
      console.log('✅ Join successful');
    } catch (error: any) {
      console.error('❌ Join failed:', error);
      setIsJoining(false);
      throw new Error(error.message || 'Failed to join meeting');
    }
  }, [isReady, isJoining, isJoined]);

  const leaveMeeting = useCallback(async () => {
    if (clientRef.current && isJoined) {
      console.log('🔄 Leaving meeting...');
      try {
        await clientRef.current.leave();
        setIsJoined(false);
        setIsJoining(false);
      } catch (error) {
        console.error('❌ Leave failed:', error);
      }
    }
  }, [isJoined]);

  const cleanup = useCallback(() => {
    if (clientRef.current) {
      try {
        if (isJoined) clientRef.current.leave();
      } catch (error) {
        console.warn('Cleanup warning:', error);
      }
      clientRef.current = null;
    }
    setIsReady(false);
    setIsJoined(false);
    setIsJoining(false);
  }, [isJoined]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    isReady,
    isJoined,
    isJoining,
    joinMeeting,
    leaveMeeting,
    cleanup,
    client: clientRef.current,
    initializeSDK
  };
}

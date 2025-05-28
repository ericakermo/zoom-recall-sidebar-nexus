
import { useState, useRef, useCallback, useEffect } from 'react';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

interface UseZoomSDKProps {
  onReady?: () => void;
  onError?: (error: string) => void;
}

export function useZoomSDK({ onReady, onError }: UseZoomSDKProps = {}) {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);

  const initializeSDK = useCallback(async () => {
    if (!containerRef.current) {
      console.log('⏸️ Container not ready yet');
      return;
    }

    try {
      console.log('🔄 Creating Zoom embedded client...');
      
      // Create the embedded client
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      console.log('🔄 Initializing Zoom embedded client...');
      
      // Initialize with the container element
      await clientRef.current.init({
        zoomAppRoot: containerRef.current,
        language: 'en-US',
        patchJsMedia: true,
        leaveOnPageUnload: true
      });

      console.log('✅ Zoom embedded client initialized successfully');
      setIsSDKLoaded(true);
      setIsReady(true);
      onReady?.();
    } catch (error: any) {
      console.error('❌ Failed to initialize Zoom embedded client:', error);
      onError?.(error.message || 'Failed to initialize Zoom SDK');
    }
  }, [onReady, onError]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    if (!isReady || !clientRef.current) {
      throw new Error('Zoom SDK not ready');
    }

    console.log('🔄 Joining meeting with embedded client...');
    
    try {
      const result = await clientRef.current.join({
        sdkKey: joinConfig.sdkKey,
        signature: joinConfig.signature,
        meetingNumber: joinConfig.meetingNumber,
        password: joinConfig.passWord || '',
        userName: joinConfig.userName,
        userEmail: joinConfig.userEmail || '',
        tk: joinConfig.tk || '',
        zak: joinConfig.zak || ''
      });
      
      console.log('✅ Successfully joined meeting with embedded client');
      return result;
    } catch (error: any) {
      console.error('❌ Failed to join meeting:', error);
      throw new Error(error.message || 'Failed to join meeting');
    }
  }, [isReady]);

  const leaveMeeting = useCallback(() => {
    if (clientRef.current) {
      console.log('🔄 Leaving meeting...');
      try {
        clientRef.current.leave();
        console.log('✅ Left meeting successfully');
      } catch (error) {
        console.error('❌ Error leaving meeting:', error);
      }
    }
  }, []);

  // Initialize when container is available
  useEffect(() => {
    if (containerRef.current && !isSDKLoaded) {
      initializeSDK();
    }
  }, [initializeSDK, isSDKLoaded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        try {
          clientRef.current.leave();
        } catch (error) {
          console.error('Cleanup error:', error);
        }
      }
    };
  }, []);

  return {
    containerRef,
    isSDKLoaded,
    isReady,
    joinMeeting,
    leaveMeeting
  };
}


import { useState, useRef, useCallback, useEffect } from 'react';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

interface UseZoomSDKProps {
  onReady?: () => void;
  onError?: (error: string) => void;
}

export function useZoomSDK({ onReady, onError }: UseZoomSDKProps = {}) {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const initializationRef = useRef(false);
  const isJoiningRef = useRef(false);
  const cleanupInProgressRef = useRef(false);

  const cleanup = useCallback(() => {
    if (cleanupInProgressRef.current) {
      console.log('⏸️ Cleanup already in progress, skipping...');
      return;
    }

    cleanupInProgressRef.current = true;
    console.log('🧹 Starting Zoom SDK cleanup...');
    
    if (clientRef.current) {
      try {
        if (isJoined && typeof clientRef.current.leave === 'function') {
          clientRef.current.leave();
          console.log('✅ Left meeting during cleanup');
        }
        
        if (typeof clientRef.current.destroy === 'function') {
          clientRef.current.destroy();
          console.log('✅ Destroyed Zoom client');
        }
      } catch (error) {
        console.warn('⚠️ Cleanup warning (non-critical):', error);
      }
      
      clientRef.current = null;
    }
    
    setIsSDKLoaded(false);
    setIsReady(false);
    setIsJoined(false);
    initializationRef.current = false;
    isJoiningRef.current = false;
    cleanupInProgressRef.current = false;
    
    console.log('✅ Zoom SDK cleanup completed');
  }, [isJoined]);

  const initializeSDK = useCallback(async () => {
    if (initializationRef.current || !containerRef.current || cleanupInProgressRef.current) {
      console.log('⏸️ SDK initialization skipped - already initialized, container not ready, or cleanup in progress');
      return false;
    }

    initializationRef.current = true;

    try {
      console.log('🔄 Creating new Zoom embedded client instance...');
      console.log('📍 Container element:', containerRef.current);
      
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      console.log('🔄 Initializing Zoom embedded client with simple config...');
      
      await clientRef.current.init({
        debug: true,
        zoomAppRoot: containerRef.current,
        language: 'en-US',
        patchJsMedia: true,
        leaveOnPageUnload: true,
        customize: {
          video: {
            isResizable: false,
            viewSizes: {
              default: { width: 900, height: 506 }
            }
          }
        }
      });

      setIsSDKLoaded(true);
      setIsReady(true);
      console.log('✅ Zoom embedded client initialized');
      
      if (!cleanupInProgressRef.current) {
        onReady?.();
      }
      
      return true;
    } catch (error: any) {
      console.error('❌ Failed to initialize Zoom embedded client:', error);
      initializationRef.current = false;
      onError?.(error.message || 'Failed to initialize Zoom SDK');
      return false;
    }
  }, [onReady, onError]);

  const setupSpeakerView = useCallback(async () => {
    console.log('🔄 setupSpeakerView called');

    if (!clientRef.current || !isJoined || cleanupInProgressRef.current) {
      console.log('⏸️ Cannot setup speaker view - conditions not met');
      return;
    }

    try {
      console.log('🔄 Setting up speaker view...');
      
      // Wait for meeting to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Set speaker view
      if (typeof clientRef.current.setGalleryView === 'function') {
        await clientRef.current.setGalleryView(false);
        console.log('✅ Speaker view enabled');
      }

      // Start video
      const mediaStream = clientRef.current.getMediaStream();
      if (mediaStream && typeof mediaStream.startVideo === 'function') {
        await mediaStream.startVideo();
        console.log('✅ Video started');
      }
      
      console.log('✅ Speaker view setup completed');
    } catch (error) {
      console.error('❌ Speaker view setup error:', error);
    }
  }, [isJoined]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    console.log('📍 joinMeeting called');

    if (!isReady || !clientRef.current) {
      throw new Error('Zoom SDK not ready');
    }

    if (isJoiningRef.current || cleanupInProgressRef.current) {
      console.log('⏸️ Join attempt already in progress or cleanup in progress');
      return;
    }

    isJoiningRef.current = true;

    console.log('🔄 Joining meeting...');

    const meetingNumberStr = String(joinConfig.meetingNumber).replace(/\s+/g, '');
    if (!/^\d{10,11}$/.test(meetingNumberStr)) {
      isJoiningRef.current = false;
      throw new Error(`Invalid meeting number format: ${joinConfig.meetingNumber}`);
    }
    
    try {
      const result = await clientRef.current.join({
        sdkKey: joinConfig.sdkKey,
        signature: joinConfig.signature,
        meetingNumber: meetingNumberStr,
        password: joinConfig.passWord || '',
        userName: joinConfig.userName,
        userEmail: joinConfig.userEmail || '',
        zak: joinConfig.zak || ''
      });
      
      console.log('✅ Successfully joined meeting');
      setIsJoined(true);
      
      // Setup speaker view
      setTimeout(async () => {
        await setupSpeakerView();
      }, 3000);
      
      return result;
    } catch (error: any) {
      console.error('❌ Failed to join meeting:', error);
      
      let errorMessage = error.message || 'Failed to join meeting';
      if (error?.errorCode === 200) {
        errorMessage = 'Meeting join failed - please refresh and try again';
      } else if (error?.errorCode === 3712) {
        errorMessage = 'Invalid signature - authentication failed';
      } else if (error?.errorCode === 1) {
        errorMessage = 'Meeting not found - verify meeting ID is correct';
      } else if (error?.errorCode === 3000) {
        errorMessage = 'Meeting password required or incorrect';
      }
      
      throw new Error(errorMessage);
    } finally {
      isJoiningRef.current = false;
    }
  }, [isReady, setupSpeakerView]);

  const leaveMeeting = useCallback(() => {
    if (clientRef.current && isJoined && !cleanupInProgressRef.current) {
      console.log('🔄 Leaving meeting...');
      try {
        if (typeof clientRef.current.leave === 'function') {
          clientRef.current.leave();
          setIsJoined(false);
          console.log('✅ Left meeting successfully');
        }
      } catch (error) {
        console.error('❌ Error during meeting leave:', error);
      }
    }
  }, [isJoined]);

  useEffect(() => {
    if (containerRef.current && !initializationRef.current && !cleanupInProgressRef.current) {
      console.log('🎯 Container is ready, initializing SDK...');
      initializeSDK();
    }
  }, []);

  useEffect(() => {
    return () => {
      console.log('🔄 Component unmounting, cleaning up...');
      cleanup();
    };
  }, [cleanup]);

  return {
    containerRef,
    isSDKLoaded,
    isReady,
    isJoined,
    joinMeeting,
    leaveMeeting,
    cleanup
  };
}

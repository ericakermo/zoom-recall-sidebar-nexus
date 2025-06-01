
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
    
    // Clear the container
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
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
      console.log('⏸️ SDK initialization skipped');
      return false;
    }

    initializationRef.current = true;

    try {
      console.log('🔄 Creating Zoom embedded client...');
      
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      console.log('🔄 Initializing Zoom SDK with corrected embedded settings...');
      
      await clientRef.current.init({
        zoomAppRoot: containerRef.current,
        language: 'en-US',
        customize: {
          video: {
            isResizable: false,
            viewSizes: {
              default: {
                width: 900,
                height: 506
              }
            }
          }
        }
      });

      setIsSDKLoaded(true);
      setIsReady(true);
      console.log('✅ Zoom SDK initialized successfully with corrected settings');
      
      if (!cleanupInProgressRef.current) {
        onReady?.();
      }
      
      return true;
    } catch (error: any) {
      console.error('❌ Failed to initialize Zoom SDK:', error);
      initializationRef.current = false;
      onError?.(error.message || 'Failed to initialize Zoom SDK');
      return false;
    }
  }, [onReady, onError]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    console.log('📍 Joining meeting with corrected embedded SDK...');

    if (!isReady || !clientRef.current) {
      throw new Error('Zoom SDK not ready');
    }

    if (isJoiningRef.current || cleanupInProgressRef.current) {
      console.log('⏸️ Join attempt already in progress');
      return;
    }

    isJoiningRef.current = true;

    // Ensure meeting number is a clean string
    const meetingNumberStr = String(joinConfig.meetingNumber).replace(/\s+/g, '');
    if (!/^\d{10,11}$/.test(meetingNumberStr)) {
      isJoiningRef.current = false;
      throw new Error(`Invalid meeting number format: ${joinConfig.meetingNumber}`);
    }
    
    try {
      console.log('🔄 Joining with corrected config format:', {
        meetingNumber: meetingNumberStr,
        userName: joinConfig.userName,
        role: joinConfig.role
      });
      
      // Use the exact format expected by the embedded SDK
      const correctedJoinConfig = {
        sdkKey: String(joinConfig.sdkKey || ''),
        signature: String(joinConfig.signature || ''),
        meetingNumber: meetingNumberStr,
        password: String(joinConfig.passWord || joinConfig.password || ''),
        userName: String(joinConfig.userName || 'Guest'),
        userEmail: String(joinConfig.userEmail || ''),
        tk: String(joinConfig.zak || '')  // Use 'tk' instead of 'zak' for embedded SDK
      };
      
      console.log('🔧 Corrected join config prepared');
      
      const result = await clientRef.current.join(correctedJoinConfig);
      
      console.log('✅ Successfully joined meeting with corrected embedded SDK');
      setIsJoined(true);
      
      return result;
    } catch (error: any) {
      console.error('❌ Failed to join meeting:', error);
      
      let errorMessage = error.message || 'Failed to join meeting';
      if (error?.errorCode === 200) {
        errorMessage = 'Host join failed - session conflict or expired token. Please refresh and try again.';
      } else if (error?.errorCode === 3712) {
        errorMessage = 'Invalid signature - authentication failed';
      } else if (error?.errorCode === 1) {
        errorMessage = 'Meeting not found - verify meeting ID';
      } else if (error?.errorCode === 3000) {
        errorMessage = 'Meeting password required or incorrect';
      }
      
      throw new Error(errorMessage);
    } finally {
      isJoiningRef.current = false;
    }
  }, [isReady]);

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
      console.log('🎯 Container ready, initializing SDK...');
      initializeSDK();
    }
  }, [initializeSDK]);

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


import { useState, useRef, useCallback, useEffect } from 'react';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';
import { useZoomSession } from '@/context/ZoomSessionContext';

interface UseZoomSDKProps {
  onReady?: () => void;
  onError?: (error: string) => void;
}

export function useZoomSDKEnhanced({ onReady, onError }: UseZoomSDKProps = {}) {
  const [isReady, setIsReady] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const clientRef = useRef<any>(null);
  const isInitializedRef = useRef(false);
  const { 
    setCurrentClient, 
    forceLeaveSession, 
    isSessionActive 
  } = useZoomSession();

  const cleanup = useCallback(async () => {
    console.log('🧹 [SDK] Starting cleanup...');
    
    await forceLeaveSession();
    
    if (clientRef.current) {
      clientRef.current = null;
    }
    
    setIsReady(false);
    setIsJoined(false);
    setIsJoining(false);
    isInitializedRef.current = false;
    
    console.log('✅ [SDK] Cleanup complete');
  }, [forceLeaveSession]);

  const initializeSDK = useCallback(async () => {
    if (isInitializedRef.current || clientRef.current) {
      console.log('⏸️ [SDK] Already initialized, skipping');
      return;
    }

    console.log('🔄 [SDK] Starting initialization...');
    
    // Wait for container
    let attempts = 0;
    while (attempts < 50) {
      const meetingSDKElement = document.getElementById('meetingSDKElement');
      if (meetingSDKElement) {
        console.log('✅ [SDK] Container found');
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    const meetingSDKElement = document.getElementById('meetingSDKElement');
    if (!meetingSDKElement) {
      throw new Error('Meeting container not found');
    }

    try {
      console.log('🔄 [SDK] Creating Zoom client...');
      clientRef.current = ZoomMtgEmbedded.createClient();

      const initConfig = {
        debug: true,
        zoomAppRoot: meetingSDKElement,
        assetPath: '/lib',
        language: 'en-US'
      };

      console.log('🔄 [SDK] Initializing client...');
      await clientRef.current.init(initConfig);
      
      isInitializedRef.current = true;
      setIsReady(true);
      onReady?.();
      console.log('✅ [SDK] Initialization complete');
    } catch (error: any) {
      console.error('❌ [SDK] Initialization failed:', error);
      clientRef.current = null;
      isInitializedRef.current = false;
      onError?.(error.message || 'Failed to initialize Zoom SDK');
    }
  }, [onReady, onError]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    console.log('🔄 [SDK] Join meeting called');
    
    if (!isReady || !clientRef.current || isJoining || isJoined) {
      throw new Error('SDK not ready or already joining/joined');
    }

    // Clean up any existing sessions
    if (isSessionActive()) {
      console.log('🔄 [SDK] Cleaning up existing session...');
      await forceLeaveSession();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const meetingNumberStr = String(joinConfig.meetingNumber).replace(/\s+/g, '');
    if (!/^\d{10,11}$/.test(meetingNumberStr)) {
      throw new Error(`Invalid meeting number format: ${joinConfig.meetingNumber}`);
    }
    
    setIsJoining(true);
    
    try {
      const meetingConfig = {
        sdkKey: joinConfig.sdkKey,
        signature: joinConfig.signature,
        meetingNumber: meetingNumberStr,
        password: joinConfig.password || '',
        userName: joinConfig.userName,
        userEmail: joinConfig.userEmail || '',
        zak: joinConfig.zak || ''
      };

      console.log('🔄 [SDK] Calling client.join()...');
      await clientRef.current.join(meetingConfig);
      
      setCurrentClient(clientRef.current);
      setIsJoined(true);
      setIsJoining(false);
      console.log('✅ [SDK] Join successful');
    } catch (error: any) {
      console.error('❌ [SDK] Join failed:', error);
      setIsJoining(false);
      
      let errorMessage = error.message || 'Failed to join meeting';
      if (error?.reason === 'Duplicated join operation') {
        errorMessage = 'Session conflict detected. Please try again.';
        await forceLeaveSession();
      }
      
      throw new Error(errorMessage);
    }
  }, [isReady, isJoining, isJoined, setCurrentClient, forceLeaveSession, isSessionActive]);

  const leaveMeeting = useCallback(async () => {
    if (clientRef.current && isJoined) {
      console.log('🔄 [SDK] Leaving meeting...');
      await forceLeaveSession();
      setIsJoined(false);
      setIsJoining(false);
    }
  }, [isJoined, forceLeaveSession]);

  // Initialize when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isInitializedRef.current) {
        initializeSDK().catch(error => {
          console.error('Failed to initialize SDK:', error);
          onError?.(error.message);
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [initializeSDK, onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isReady,
    isJoined,
    isJoining,
    joinMeeting,
    leaveMeeting,
    cleanup,
    client: clientRef.current
  };
}

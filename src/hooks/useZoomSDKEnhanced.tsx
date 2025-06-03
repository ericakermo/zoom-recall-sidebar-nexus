
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
    currentClient, 
    setCurrentClient, 
    forceLeaveSession, 
    isSessionActive, 
    resetSession 
  } = useZoomSession();

  const validateContainer = useCallback(() => {
    const meetingSDKElement = document.getElementById('meetingSDKElement');
    if (!meetingSDKElement) {
      console.error('🚨 [SDK-ENHANCED] meetingSDKElement not found in DOM');
      return false;
    }

    const computedStyle = window.getComputedStyle(meetingSDKElement);
    console.log('🔍 [SDK-ENHANCED] Container validation:', {
      element: meetingSDKElement,
      display: computedStyle.display,
      visibility: computedStyle.visibility,
      width: computedStyle.width,
      height: computedStyle.height,
      rect: meetingSDKElement.getBoundingClientRect()
    });

    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
      console.error('🚨 [SDK-ENHANCED] Container not visible');
      return false;
    }

    const rect = meetingSDKElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.error('🚨 [SDK-ENHANCED] Container has zero dimensions:', rect);
      return false;
    }

    console.log('✅ [SDK-ENHANCED] Container validation passed');
    return true;
  }, []);

  const cleanup = useCallback(async () => {
    console.log('🧹 [SDK-ENHANCED] Starting enhanced cleanup...');
    
    // Use session manager for cleanup
    await forceLeaveSession();
    
    if (clientRef.current) {
      clientRef.current = null;
    }
    
    setIsReady(false);
    setIsJoined(false);
    setIsJoining(false);
    isInitializedRef.current = false;
    
    console.log('✅ [SDK-ENHANCED] Enhanced cleanup complete');
  }, [forceLeaveSession]);

  const checkForExistingSession = useCallback(async () => {
    if (isSessionActive()) {
      console.log('⚠️ [SDK-ENHANCED] Existing session detected, cleaning up first');
      await forceLeaveSession();
      // Wait a moment for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }, [isSessionActive, forceLeaveSession]);

  const initializeSDK = useCallback(async () => {
    // Check for existing sessions first
    await checkForExistingSession();

    // Prevent multiple initializations
    if (isInitializedRef.current || clientRef.current) {
      console.log('⏸️ [SDK-ENHANCED] SDK already initialized, skipping');
      return;
    }

    console.log('🔄 [SDK-ENHANCED] Starting enhanced SDK initialization...');
    
    const meetingSDKElement = document.getElementById('meetingSDKElement');
    if (!meetingSDKElement) {
      console.error('🚨 [SDK-ENHANCED] meetingSDKElement not found');
      return;
    }

    if (!validateContainer()) {
      console.error('🚨 [SDK-ENHANCED] Container validation failed');
      return;
    }

    try {
      console.log('🔄 [SDK-ENHANCED] Creating Zoom embedded client...');
      
      clientRef.current = ZoomMtgEmbedded.createClient();
      console.log('✅ [SDK-ENHANCED] Zoom client created:', clientRef.current);

      const assetPath = '/lib';
      const initConfig = {
        debug: true,
        zoomAppRoot: meetingSDKElement,
        assetPath: assetPath,
        language: 'en-US'
      };

      console.log('🔄 [SDK-ENHANCED] Calling client.init()...');
      await clientRef.current.init(initConfig);
      
      console.log('✅ [SDK-ENHANCED] client.init() completed successfully');
      validateContainer();

      isInitializedRef.current = true;
      setIsReady(true);
      onReady?.();
      console.log('✅ [SDK-ENHANCED] Enhanced SDK initialization complete');
    } catch (error: any) {
      console.error('❌ [SDK-ENHANCED] client.init() failed:', error);
      clientRef.current = null;
      isInitializedRef.current = false;
      resetSession(); // Reset session state on error
      onError?.(error.message || 'Failed to initialize Zoom SDK');
    }
  }, [onReady, onError, validateContainer, checkForExistingSession, resetSession]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    console.log('🔄 [SDK-ENHANCED] Enhanced joinMeeting() called');

    // Check for existing sessions
    await checkForExistingSession();
    
    if (!isReady || !clientRef.current || isJoining || isJoined) {
      console.error('🚨 [SDK-ENHANCED] Cannot join - invalid state:', {
        isReady,
        hasClient: !!clientRef.current,
        isJoining,
        isJoined
      });
      
      if (isJoined || isSessionActive()) {
        throw new Error('Session already active - cleaning up and retry');
      }
      
      throw new Error('Zoom SDK not ready');
    }

    if (!validateContainer()) {
      throw new Error('Meeting container not properly mounted');
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

      console.log('🔄 [SDK-ENHANCED] Calling client.join()...');
      const joinResult = await clientRef.current.join(meetingConfig);
      
      console.log('✅ [SDK-ENHANCED] client.join() completed successfully');
      
      // Register with session manager
      setCurrentClient(clientRef.current);
      
      setTimeout(() => {
        validateContainer();
      }, 1000);
      
      setIsJoined(true);
      setIsJoining(false);
      console.log('✅ [SDK-ENHANCED] Enhanced meeting join complete');
      return joinResult;
    } catch (error: any) {
      console.error('❌ [SDK-ENHANCED] client.join() failed:', error);
      setIsJoining(false);
      
      let errorMessage = error.message || 'Failed to join meeting';
      if (error?.reason === 'Duplicated join operation') {
        errorMessage = 'Session conflict detected. Cleaning up and retrying...';
        await forceLeaveSession();
      } else if (error?.errorCode === 200 || error?.reason === 'Fail to join the meeting.') {
        if (joinConfig.role === 1) {
          errorMessage = 'Host authentication failed. This may be due to an expired ZAK token or active session conflict.';
        } else {
          errorMessage = 'Meeting join failed. The meeting may not be active or there may be authentication issues.';
        }
      }
      
      throw new Error(errorMessage);
    }
  }, [isReady, isJoining, isJoined, validateContainer, checkForExistingSession, setCurrentClient, forceLeaveSession]);

  const leaveMeeting = useCallback(async () => {
    if (clientRef.current && isJoined) {
      console.log('🔄 [SDK-ENHANCED] Leaving meeting...');
      await forceLeaveSession();
      setIsJoined(false);
      setIsJoining(false);
    }
  }, [isJoined, forceLeaveSession]);

  // Initialize when DOM is ready
  useEffect(() => {
    if (isInitializedRef.current) {
      return;
    }

    const initWhenReady = () => {
      const meetingSDKElement = document.getElementById('meetingSDKElement');
      if (meetingSDKElement) {
        console.log('🔍 [SDK-ENHANCED] meetingSDKElement found, starting initialization');
        initializeSDK();
      } else {
        console.log('⏳ [SDK-ENHANCED] Waiting for meetingSDKElement...');
        setTimeout(initWhenReady, 50);
      }
    };
    
    initWhenReady();
  }, [initializeSDK]);

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

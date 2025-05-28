
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
      
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      console.log('🔄 Initializing Zoom embedded client...');
      
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
    console.log('📋 Join config details:', {
      meetingNumber: joinConfig.meetingNumber,
      userName: joinConfig.userName,
      role: joinConfig.role,
      sdkKey: joinConfig.sdkKey ? 'present' : 'missing',
      signature: joinConfig.signature ? 'present' : 'missing',
      hasPassword: !!joinConfig.passWord
    });
    
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
      
      // Enhanced error logging
      if (error?.errorCode) {
        console.error(`🔍 Zoom Error Code: ${error.errorCode}`);
      }
      if (error?.reason) {
        console.error(`📝 Zoom Error Reason: ${error.reason}`);
      }
      if (error?.type) {
        console.error(`🏷️ Zoom Error Type: ${error.type}`);
      }
      
      // Provide more specific error messages based on common error codes
      let errorMessage = error.message || 'Failed to join meeting';
      if (error?.errorCode === 200) {
        errorMessage = 'Meeting join failed - check meeting ID, password, or wait for host to start the meeting';
      } else if (error?.errorCode === 3712) {
        errorMessage = 'Invalid signature - authentication failed';
      } else if (error?.errorCode === 1) {
        errorMessage = 'Meeting not found - check meeting ID';
      }
      
      throw new Error(errorMessage);
    }
  }, [isReady]);

  const leaveMeeting = useCallback(() => {
    if (clientRef.current && typeof clientRef.current.leave === 'function') {
      console.log('🔄 Leaving meeting...');
      try {
        clientRef.current.leave();
        console.log('✅ Left meeting successfully');
      } catch (error) {
        console.error('❌ Error leaving meeting:', error);
      }
    } else {
      console.warn('⚠️ Zoom client not initialized or leave function missing - safe cleanup');
    }
  }, []);

  // Initialize when container is available
  useEffect(() => {
    if (containerRef.current && !isSDKLoaded) {
      initializeSDK();
    }
  }, [initializeSDK, isSDKLoaded]);

  // Enhanced cleanup on unmount with defensive guards
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        try {
          if (typeof clientRef.current.leave === 'function') {
            clientRef.current.leave();
            console.log('🧹 Cleanup: Meeting left successfully');
          } else {
            console.warn('⚠️ Cleanup: Leave function not available');
          }
        } catch (error) {
          console.warn('⚠️ Cleanup warning (non-critical):', error);
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


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
      hasPassword: !!joinConfig.passWord,
      hasZak: !!joinConfig.zak
    });

    // Enhanced validation for host role
    if (joinConfig.role === 1 && !joinConfig.zak) {
      console.warn('⚠️ Host role (1) specified but no ZAK token provided - this may cause join failure');
    }

    // Validate meeting number format
    const meetingNumberStr = String(joinConfig.meetingNumber).replace(/\s+/g, '');
    if (!/^\d{10,11}$/.test(meetingNumberStr)) {
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
      
      console.log('✅ Successfully joined meeting with embedded client');
      return result;
    } catch (error: any) {
      console.error('❌ Failed to join meeting:', error);
      
      // Enhanced error logging with specific code handling
      if (error?.errorCode) {
        console.error(`🔍 Zoom Error Code: ${error.errorCode}`);
      }
      if (error?.reason) {
        console.error(`📝 Zoom Error Reason: ${error.reason}`);
      }
      if (error?.type) {
        console.error(`🏷️ Zoom Error Type: ${error.type}`);
      }
      
      // Provide specific error messages for common scenarios
      let errorMessage = error.message || 'Failed to join meeting';
      if (error?.errorCode === 200) {
        if (joinConfig.role === 1) {
          errorMessage = 'Host join failed - check ZAK token validity and ensure meeting is properly configured for host access';
        } else {
          errorMessage = 'Meeting join failed - meeting may not be started, check meeting ID and password, or wait for host to start the meeting';
        }
      } else if (error?.errorCode === 3712) {
        errorMessage = 'Invalid signature - authentication failed, check SDK key and signature generation';
      } else if (error?.errorCode === 1) {
        errorMessage = 'Meeting not found - verify meeting ID is correct';
      } else if (error?.errorCode === 3000) {
        errorMessage = 'Meeting password required or incorrect';
      }
      
      throw new Error(errorMessage);
    }
  }, [isReady]);

  const leaveMeeting = useCallback(() => {
    if (clientRef.current) {
      console.log('🔄 Leaving meeting...');
      try {
        // Enhanced defensive check for leave function
        if (typeof clientRef.current.leave === 'function') {
          clientRef.current.leave();
          console.log('✅ Left meeting successfully');
        } else {
          console.warn('⚠️ Leave function not available on Zoom client - attempting cleanup');
          // Alternative cleanup if leave is not available
          if (typeof clientRef.current.destroy === 'function') {
            clientRef.current.destroy();
            console.log('✅ Zoom client destroyed successfully');
          }
        }
      } catch (error) {
        console.error('❌ Error during meeting cleanup:', error);
      }
    } else {
      console.warn('⚠️ Zoom client not initialized - safe cleanup');
    }
  }, []);

  // Initialize when container is available
  useEffect(() => {
    if (containerRef.current && !isSDKLoaded) {
      initializeSDK();
    }
  }, [initializeSDK, isSDKLoaded]);

  // Enhanced cleanup on unmount with better error handling
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        try {
          if (typeof clientRef.current.leave === 'function') {
            clientRef.current.leave();
            console.log('🧹 Cleanup: Meeting left successfully');
          } else if (typeof clientRef.current.destroy === 'function') {
            clientRef.current.destroy();
            console.log('🧹 Cleanup: Client destroyed successfully');
          } else {
            console.warn('⚠️ Cleanup: No cleanup method available on client');
          }
        } catch (error) {
          console.warn('⚠️ Cleanup warning (non-critical):', error);
        } finally {
          clientRef.current = null;
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

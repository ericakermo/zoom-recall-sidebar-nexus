
import { useState, useRef, useCallback, useEffect } from 'react';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

interface UseZoomSDKProps {
  onReady?: () => void;
  onError?: (error: string) => void;
}

// Global singleton to prevent multiple SDK instances
let globalZoomClient: any = null;
let globalInitialized = false;

export function useZoomSDK({ onReady, onError }: UseZoomSDKProps = {}) {
  const [isSDKLoaded, setIsSDKLoaded] = useState(globalInitialized);
  const [isReady, setIsReady] = useState(globalInitialized);
  const [isJoined, setIsJoined] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(globalZoomClient);
  const initializationRef = useRef(false);
  const joinAttemptRef = useRef(false);

  // Track visibility changes to prevent cleanup on tab switch
  const [isVisible, setIsVisible] = useState(!document.hidden);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
      console.log('🔄 Tab visibility changed:', !document.hidden ? 'visible' : 'hidden');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const initializeSDK = useCallback(async () => {
    // Prevent multiple initialization attempts
    if (initializationRef.current || globalInitialized || !containerRef.current) {
      console.log('⏸️ SDK initialization skipped - already initialized or container not ready');
      return;
    }

    initializationRef.current = true;

    try {
      console.log('🔄 Creating Zoom embedded client (singleton)...');
      
      // Use global client if it exists, otherwise create new one
      if (!globalZoomClient) {
        globalZoomClient = ZoomMtgEmbedded.createClient();
        clientRef.current = globalZoomClient;
      } else {
        clientRef.current = globalZoomClient;
        console.log('✅ Using existing global Zoom client');
      }
      
      console.log('🔄 Initializing Zoom embedded client...');
      
      await clientRef.current.init({
        zoomAppRoot: containerRef.current,
        language: 'en-US',
        patchJsMedia: true,
        leaveOnPageUnload: false,
        customize: {
          video: {
            isResizable: false, // Let Zoom handle sizing
            viewSizes: {
              default: {
                width: '100%',
                height: '100%'
              }
            },
            popper: {
              disableDraggable: true // Prevent dragging to let it fill container
            }
          },
          toolbar: {
            buttons: [
              {
                text: 'Leave',
                className: 'CustomLeaveButton',
                onClick: () => {
                  console.log('Custom leave button clicked');
                }
              }
            ]
          }
        }
      });

      globalInitialized = true;
      setIsSDKLoaded(true);
      setIsReady(true);
      onReady?.();
      console.log('✅ Zoom embedded client initialized successfully');
    } catch (error: any) {
      console.error('❌ Failed to initialize Zoom embedded client:', error);
      initializationRef.current = false;
      onError?.(error.message || 'Failed to initialize Zoom SDK');
    }
  }, [onReady, onError]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    if (!isReady || !clientRef.current) {
      throw new Error('Zoom SDK not ready');
    }

    // Prevent multiple join attempts
    if (joinAttemptRef.current) {
      console.log('⏸️ Join attempt already in progress');
      return;
    }

    joinAttemptRef.current = true;

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
      joinAttemptRef.current = false;
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
      
      setIsJoined(true);
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
    } finally {
      joinAttemptRef.current = false;
    }
  }, [isReady]);

  const leaveMeeting = useCallback(() => {
    if (clientRef.current) {
      console.log('🔄 Leaving meeting...');
      try {
        if (typeof clientRef.current.leave === 'function') {
          clientRef.current.leave();
          setIsJoined(false);
          console.log('✅ Left meeting successfully');
        } else {
          console.warn('⚠️ Leave function not available on Zoom client');
        }
      } catch (error) {
        console.error('❌ Error during meeting leave:', error);
      }
    }
  }, []);

  // Initialize when container is available and not already initialized
  useEffect(() => {
    if (containerRef.current && !globalInitialized && !initializationRef.current) {
      initializeSDK();
    }
  }, [initializeSDK]);

  // Only cleanup on actual unmount, not on tab switch
  useEffect(() => {
    return () => {
      // Only cleanup if the page is actually being unloaded
      if (document.visibilityState === 'hidden') {
        console.log('🧹 Tab hidden - preserving Zoom session');
        return;
      }

      // Only cleanup on actual component unmount
      if (clientRef.current && !isVisible) {
        try {
          if (typeof clientRef.current.leave === 'function') {
            clientRef.current.leave();
            console.log('🧹 Cleanup: Meeting left successfully');
          }
        } catch (error) {
          console.warn('⚠️ Cleanup warning (non-critical):', error);
        }
      }
    };
  }, [isVisible]);

  return {
    containerRef,
    isSDKLoaded,
    isReady,
    isJoined,
    joinMeeting,
    leaveMeeting
  };
}

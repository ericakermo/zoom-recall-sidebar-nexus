

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
  const joinAttemptRef = useRef(false);

  const cleanup = useCallback(() => {
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
    joinAttemptRef.current = false;
    
    console.log('✅ Zoom SDK cleanup completed');
  }, [isJoined]);

  const initializeSDK = useCallback(async () => {
    if (initializationRef.current) {
      console.log('⏸️ SDK initialization skipped - already initialized');
      return;
    }

    // Wait for the element with the specific ID
    const meetingSDKElement = document.getElementById('meetingSDKElement');
    if (!meetingSDKElement) {
      console.log('⏸️ SDK initialization waiting for meetingSDKElement');
      return;
    }

    // Log container dimensions for debugging
    const rect = meetingSDKElement.getBoundingClientRect();
    console.log('📐 [ZOOM-SDK] Container dimensions:', {
      width: rect.width,
      height: rect.height,
      aspectRatio: (rect.width / rect.height).toFixed(2)
    });

    initializationRef.current = true;

    try {
      console.log('🔄 Creating new Zoom embedded client instance...');
      
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      console.log('🔄 Initializing Zoom embedded client with strict 16:9 aspect ratio...');
      
      // Force 16:9 aspect ratio - calculate both width and height constraints
      const maxWidth = 1000;
      const aspectRatio = 16 / 9;
      const calculatedHeight = maxWidth / aspectRatio;

      console.log('📏 [ZOOM-SDK] Enforced 16:9 dimensions:', {
        width: maxWidth,
        height: Math.round(calculatedHeight)
      });

      await clientRef.current.init({
        zoomAppRoot: meetingSDKElement,
        language: 'en-US',
        customize: {
          video: {
            isResizable: false,
            disableDragging: true, // Disable dragging functionality
            viewSizes: {
              default: {
                width: maxWidth,
                height: Math.round(calculatedHeight)
              }
            }
          },
          layout: {
            mode: 'gallery',
            viewMode: 'fit'
          }
        },
        patchJsMedia: true,
        leaveOnPageUnload: true
      });

      setIsSDKLoaded(true);
      setIsReady(true);
      onReady?.();
      console.log('✅ Zoom embedded client initialized with strict 16:9 and no dragging');
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

    if (joinAttemptRef.current) {
      console.log('⏸️ Join attempt already in progress');
      return;
    }

    joinAttemptRef.current = true;

    console.log('🔄 Joining meeting with fresh session...');
    console.log('📋 Join config details:', {
      meetingNumber: joinConfig.meetingNumber,
      userName: joinConfig.userName,
      role: joinConfig.role,
      sdkKey: joinConfig.sdkKey ? 'present' : 'missing',
      signature: joinConfig.signature ? 'present' : 'missing',
      hasPassword: !!joinConfig.passWord,
      hasZak: !!joinConfig.zak
    });

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
      console.log('✅ Successfully joined meeting');
      return result;
    } catch (error: any) {
      console.error('❌ Failed to join meeting:', error);
      
      if (error?.errorCode) {
        console.error(`🔍 Zoom Error Code: ${error.errorCode}`);
      }
      if (error?.reason) {
        console.error(`📝 Zoom Error Reason: ${error.reason}`);
      }
      
      let errorMessage = error.message || 'Failed to join meeting';
      if (error?.errorCode === 200) {
        if (joinConfig.role === 1) {
          errorMessage = 'Host join failed - this usually means there is an active session conflict. Please refresh the page and try again, or the ZAK token may be expired.';
        } else {
          errorMessage = 'Meeting join failed - meeting may not be started or there may be a session conflict. Try refreshing the page.';
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
    if (clientRef.current && isJoined) {
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
  }, [isJoined]);

  // Initialize when DOM element is ready
  useEffect(() => {
    const checkForElement = () => {
      const meetingSDKElement = document.getElementById('meetingSDKElement');
      if (meetingSDKElement && !initializationRef.current) {
        // Add a small delay to ensure container is fully rendered
        setTimeout(() => {
          initializeSDK();
        }, 100);
      } else if (!meetingSDKElement) {
        // Keep checking for the element
        setTimeout(checkForElement, 100);
      }
    };
    
    checkForElement();
  }, [initializeSDK]);

  // Cleanup on unmount and page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log('🔄 Page unload detected, cleaning up Zoom session...');
      cleanup();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('🔄 Page hidden, leaving meeting...');
        if (clientRef.current && isJoined) {
          leaveMeeting();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cleanup();
    };
  }, [isJoined, leaveMeeting, cleanup]);

  return {
    containerRef,
    isSDKLoaded,
    isReady,
    isJoined,
    joinMeeting,
    leaveMeeting,
    cleanup,
    client: clientRef.current
  };
}


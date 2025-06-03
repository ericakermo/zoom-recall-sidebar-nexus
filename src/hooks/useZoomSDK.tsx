
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
  const initializationRef = useRef<boolean>(false);
  const hasJoinedSuccessfullyRef = useRef<boolean>(false);

  const cleanup = useCallback(() => {
    // Don't cleanup if we've successfully joined and are still in a meeting
    if (hasJoinedSuccessfullyRef.current && isJoined) {
      console.log('⏸️ Skipping cleanup - meeting is active');
      return;
    }

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
    hasJoinedSuccessfullyRef.current = false;
    
    console.log('✅ Zoom SDK cleanup completed');
  }, [isJoined]);

  const initializeSDK = useCallback(async () => {
    const meetingSDKElement = document.getElementById('meetingSDKElement');
    if (!meetingSDKElement) {
      console.log('⏸️ SDK initialization waiting for meetingSDKElement');
      return;
    }

    if (clientRef.current || initializationRef.current) {
      console.log('⏸️ SDK already initialized or initializing');
      return;
    }

    initializationRef.current = true;

    try {
      console.log('📐 [ZOOM-SDK] Container dimensions:', {
        width: meetingSDKElement.offsetWidth,
        height: meetingSDKElement.offsetHeight,
        aspectRatio: (meetingSDKElement.offsetWidth / meetingSDKElement.offsetHeight).toFixed(2)
      });

      console.log('🔄 Creating new Zoom embedded client instance...');
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      if (!clientRef.current) {
        throw new Error('Failed to create Zoom embedded client');
      }

      console.log('🔄 Initializing Zoom embedded client with strict 16:9 aspect ratio...');

      const containerWidth = meetingSDKElement.offsetWidth;
      const containerHeight = Math.round(containerWidth / (16/9));
      
      console.log('📏 [ZOOM-SDK] Enforced 16:9 dimensions:', {
        width: containerWidth,
        height: containerHeight
      });

      // Calculate asset path following Zoom's official pattern
      const tmpPort = window.location.port === "" ? "" : ":" + window.location.port;
      const assetPath = window.location.protocol + "//" + window.location.hostname + tmpPort + "/lib";

      console.log('📁 Asset path configured:', assetPath);

      // Initialize with configuration that prevents dragging and enforces sizing
      await clientRef.current.init({
        debug: true,
        zoomAppRoot: meetingSDKElement,
        assetPath: assetPath,
        language: 'en-US',
        patchJsMedia: true,
        videoDrag: false, // Disable dragging
        sharingMode: 'both',
        videoHeader: true,
        isLockBottom: true, // Lock bottom controls
        screenShare: true,
        meetingInfo: ['topic', 'host', 'mn', 'pwd', 'telPwd', 'invite', 'participant', 'dc', 'enctype'],
        success: () => {
          console.log('✅ [COMPONENT-VIEW] SDK ready - proceeding to join');
          setIsSDKLoaded(true);
          setIsReady(true);
          onReady?.();
        },
        error: (error: any) => {
          console.error('❌ SDK initialization error:', error);
          initializationRef.current = false;
          onError?.(error?.message || 'Failed to initialize Zoom SDK');
        }
      });

      console.log('✅ Zoom embedded client initialized with strict 16:9 and no dragging');
    } catch (error: any) {
      console.error('❌ Failed to initialize Zoom embedded client:', error);
      clientRef.current = null;
      initializationRef.current = false;
      onError?.(error.message || 'Failed to initialize Zoom SDK');
    }
  }, [onReady, onError]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    if (!isReady || !clientRef.current) {
      throw new Error('Zoom SDK not ready');
    }

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

    const meetingNumberStr = String(joinConfig.meetingNumber).replace(/\s+/g, '');
    if (!/^\d{10,11}$/.test(meetingNumberStr)) {
      throw new Error(`Invalid meeting number format: ${joinConfig.meetingNumber}`);
    }
    
    try {
      // Join with simplified configuration
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
      hasJoinedSuccessfullyRef.current = true;
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
    }
  }, [isReady]);

  const leaveMeeting = useCallback(() => {
    if (clientRef.current && isJoined) {
      console.log('🔄 Leaving meeting...');
      try {
        if (typeof clientRef.current.leave === 'function') {
          clientRef.current.leave();
          setIsJoined(false);
          hasJoinedSuccessfullyRef.current = false;
          console.log('✅ Left meeting successfully');
        } else {
          console.warn('⚠️ Leave function not available on Zoom client');
        }
      } catch (error) {
        console.error('❌ Error during meeting leave:', error);
      }
    }
  }, [isJoined]);

  // Initialize when DOM is ready
  useEffect(() => {
    if (initializationRef.current) return;

    const initWhenReady = () => {
      const meetingSDKElement = document.getElementById('meetingSDKElement');
      if (meetingSDKElement && !initializationRef.current) {
        initializeSDK();
      } else if (!initializationRef.current) {
        setTimeout(initWhenReady, 50);
      }
    };
    
    initWhenReady();
  }, [initializeSDK]);

  // Only cleanup on unmount if we haven't successfully joined
  useEffect(() => {
    return () => {
      if (!hasJoinedSuccessfullyRef.current) {
        console.log('🔚 [ZOOM-SDK] Component unmounting - cleaning up');
        cleanup();
      } else {
        console.log('🔄 [ZOOM-SDK] Component unmounting but meeting active - preserving connection');
      }
    };
  }, [cleanup]);

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

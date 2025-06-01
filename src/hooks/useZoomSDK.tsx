
import { useState, useRef, useCallback, useEffect } from 'react';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

interface UseZoomSDKProps {
  sessionId?: string;
  onReady?: () => void;
  onError?: (error: string) => void;
}

export function useZoomSDK({ sessionId, onReady, onError }: UseZoomSDKProps = {}) {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const initializationRef = useRef(false);
  const isJoiningRef = useRef(false);
  const cleanupInProgressRef = useRef(false);

  // Enhanced cleanup
  const cleanup = useCallback(() => {
    if (cleanupInProgressRef.current) {
      console.log('⏸️ [DEBUG] Cleanup already in progress, skipping...', sessionId);
      return;
    }

    cleanupInProgressRef.current = true;
    console.log('🧹 [DEBUG] Starting Zoom SDK cleanup...', sessionId);
    
    if (clientRef.current) {
      try {
        if (isJoined && typeof clientRef.current.leave === 'function') {
          clientRef.current.leave();
          console.log('✅ [DEBUG] Left meeting during cleanup');
        }
        
        if (typeof clientRef.current.destroy === 'function') {
          clientRef.current.destroy();
          console.log('✅ [DEBUG] Destroyed Zoom client');
        }
      } catch (error) {
        console.warn('⚠️ [DEBUG] Cleanup warning (non-critical):', error);
      }
      
      clientRef.current = null;
    }
    
    // Safe DOM cleanup
    if (containerRef.current) {
      try {
        const container = containerRef.current;
        container.innerHTML = '';
        console.log('✅ [DEBUG] Container cleared safely');
      } catch (error) {
        console.warn('⚠️ [DEBUG] Container cleanup error:', error);
      }
    }
    
    setIsSDKLoaded(false);
    setIsReady(false);
    setIsJoined(false);
    initializationRef.current = false;
    isJoiningRef.current = false;
    cleanupInProgressRef.current = false;
    
    console.log('✅ [DEBUG] Zoom SDK cleanup completed', sessionId);
  }, [isJoined, sessionId]);

  const initializeSDK = useCallback(async () => {
    if (initializationRef.current || !containerRef.current || cleanupInProgressRef.current) {
      console.log('⏸️ [DEBUG] SDK initialization skipped', {
        alreadyInitializing: initializationRef.current,
        noContainer: !containerRef.current,
        cleanupInProgress: cleanupInProgressRef.current,
        sessionId
      });
      return false;
    }

    initializationRef.current = true;

    try {
      console.log('🔄 [DEBUG] Creating Zoom embedded client...', sessionId);
      
      // Create client first
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      if (!clientRef.current) {
        throw new Error('Failed to create Zoom client');
      }

      // Validate container exists and has proper ID
      if (!containerRef.current) {
        throw new Error('Container not available for SDK initialization');
      }

      // Ensure container has the required ID
      if (!containerRef.current.id) {
        containerRef.current.id = 'meetingSDKElement';
      }

      console.log('🔧 [DEBUG] Container validation:', {
        exists: !!containerRef.current,
        id: containerRef.current.id,
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
        sessionId
      });

      console.log('🔄 [DEBUG] Initializing Zoom SDK with working config pattern...');
      
      // Use the exact same config as the working example
      const initConfig = {
        zoomAppRoot: containerRef.current,
        language: "en-US",
        patchJsMedia: true,
        leaveOnPageUnload: true
      };

      console.log('🔧 [DEBUG] SDK init config:', {
        hasZoomAppRoot: !!initConfig.zoomAppRoot,
        containerElementId: containerRef.current.id,
        language: initConfig.language,
        patchJsMedia: initConfig.patchJsMedia,
        leaveOnPageUnload: initConfig.leaveOnPageUnload,
        sessionId
      });

      await clientRef.current.init(initConfig);

      console.log('🔍 [DEBUG] SDK state after init:', {
        clientExists: !!clientRef.current,
        containerChildren: containerRef.current?.children.length,
        sessionId
      });

      setIsSDKLoaded(true);
      setIsReady(true);
      console.log('✅ [DEBUG] Zoom SDK initialized successfully');
      
      if (!cleanupInProgressRef.current) {
        onReady?.();
      }
      
      return true;
    } catch (error: any) {
      console.error('❌ [DEBUG] Failed to initialize Zoom SDK:', error);
      initializationRef.current = false;
      onError?.(error.message || 'Failed to initialize Zoom SDK');
      return false;
    }
  }, [onReady, onError, sessionId]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    console.log('📍 [DEBUG] Joining meeting with SDK...', sessionId);

    if (!isReady || !clientRef.current) {
      const error = new Error('Zoom SDK not ready for join');
      console.error('❌ [DEBUG] SDK not ready:', {
        isReady,
        hasClient: !!clientRef.current,
        sessionId
      });
      throw error;
    }

    if (isJoiningRef.current || cleanupInProgressRef.current) {
      console.log('⏸️ [DEBUG] Join attempt already in progress');
      return;
    }

    isJoiningRef.current = true;

    // Validate meeting number format
    const meetingNumberStr = String(joinConfig.meetingNumber).replace(/\s+/g, '');
    if (!/^\d{10,11}$/.test(meetingNumberStr)) {
      isJoiningRef.current = false;
      throw new Error(`Invalid meeting number format: ${joinConfig.meetingNumber}`);
    }
    
    try {
      console.log('🔄 [DEBUG] Join config validation:', {
        meetingNumber: meetingNumberStr,
        hasSignature: !!joinConfig.signature,
        hasSDKKey: !!joinConfig.sdkKey,
        hasUserName: !!joinConfig.userName,
        hasZAK: !!joinConfig.zak,
        role: joinConfig.role,
        sessionId
      });
      
      // Use the exact same join config format as the working example
      const finalJoinConfig = {
        signature: String(joinConfig.signature || ''),
        sdkKey: String(joinConfig.sdkKey || ''),
        meetingNumber: meetingNumberStr,
        password: String(joinConfig.passWord || joinConfig.password || ''),
        userName: String(joinConfig.userName || 'Guest'),
        userEmail: String(joinConfig.userEmail || ''),
        tk: String(joinConfig.zak || ''), // ZAK token for host (registrant token)
        zak: String(joinConfig.zak || '') // ZAK token for host
      };
      
      console.log('🔧 [DEBUG] Final join config prepared (working example format):', {
        ...finalJoinConfig,
        signature: finalJoinConfig.signature.substring(0, 20) + '...',
        tk: finalJoinConfig.tk ? 'present' : 'missing',
        zak: finalJoinConfig.zak ? 'present' : 'missing'
      });
      
      const result = await clientRef.current.join(finalJoinConfig);
      
      console.log('✅ [DEBUG] Join method completed successfully');
      setIsJoined(true);
      
      // Debug container content after join with delay
      setTimeout(() => {
        console.log('🔍 [DEBUG] Post-join container analysis:', {
          containerChildren: containerRef.current?.children.length,
          containerHTML: containerRef.current?.innerHTML.length,
          visibleElements: containerRef.current?.querySelectorAll('video, canvas, iframe').length,
          sessionId
        });
      }, 2000);
      
      return result;
    } catch (error: any) {
      console.error('❌ [DEBUG] Join failed:', {
        error: error.message,
        errorCode: error?.errorCode,
        sessionId
      });
      
      let errorMessage = error.message || 'Failed to join meeting';
      
      // Enhanced error handling
      if (error?.errorCode === 200 || error?.reason === 200) {
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
  }, [isReady, sessionId]);

  const leaveMeeting = useCallback(() => {
    if (clientRef.current && isJoined && !cleanupInProgressRef.current) {
      console.log('🔄 [DEBUG] Leaving meeting...', sessionId);
      try {
        if (typeof clientRef.current.leave === 'function') {
          clientRef.current.leave();
          setIsJoined(false);
          console.log('✅ [DEBUG] Left meeting successfully');
        }
      } catch (error) {
        console.error('❌ [DEBUG] Error during meeting leave:', error);
      }
    }
  }, [isJoined, sessionId]);

  // Initialize SDK when container is ready
  useEffect(() => {
    if (containerRef.current && !initializationRef.current && !cleanupInProgressRef.current) {
      console.log('🎯 [DEBUG] Container ready, initializing SDK...', {
        containerExists: !!containerRef.current,
        containerDimensions: {
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        },
        sessionId
      });
      
      // Immediate initialization for working example pattern
      initializeSDK();
    }
  }, [initializeSDK, sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🔄 [DEBUG] Component unmounting, cleaning up...', sessionId);
      cleanup();
    };
  }, [cleanup, sessionId]);

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

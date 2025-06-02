
import { useState, useRef, useCallback, useEffect } from 'react';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

interface UseZoomSDKProps {
  containerRef: React.RefObject<HTMLDivElement>;
  shouldInitialize?: boolean;
  onReady?: () => void;
  onError?: (error: string) => void;
}

export function useZoomSDK({ containerRef, shouldInitialize = true, onReady, onError }: UseZoomSDKProps) {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const clientRef = useRef<any>(null);
  const initializationRef = useRef(false);
  const isJoiningRef = useRef(false);
  const cleanupInProgressRef = useRef(false);
  const sessionId = useRef(Date.now().toString());

  // Debug logging helper
  const debugLog = useCallback((message: string, data?: any) => {
    console.log(`🔍 [ZOOM-DEBUG] ${message}`, data || '');
  }, []);

  const cleanup = useCallback(() => {
    if (cleanupInProgressRef.current) {
      debugLog('Cleanup already in progress, skipping...');
      return;
    }

    cleanupInProgressRef.current = true;
    debugLog('Starting Zoom SDK cleanup...');
    
    if (clientRef.current) {
      try {
        if (isJoined && typeof clientRef.current.leave === 'function') {
          clientRef.current.leave();
          debugLog('Left meeting during cleanup');
        }
        
        if (typeof clientRef.current.destroy === 'function') {
          clientRef.current.destroy();
          debugLog('Destroyed Zoom client');
        }
      } catch (error) {
        debugLog('Cleanup warning (non-critical):', error);
      }
      
      clientRef.current = null;
    }

    // Clean container following Zoom documentation
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      debugLog('Container cleaned with innerHTML = ""');
    }
    
    setIsSDKLoaded(false);
    setIsReady(false);
    setIsJoined(false);
    initializationRef.current = false;
    isJoiningRef.current = false;
    cleanupInProgressRef.current = false;
    
    debugLog('Zoom SDK cleanup completed');
  }, [isJoined, containerRef, debugLog]);

  const validateContainer = useCallback(() => {
    if (!containerRef.current) {
      debugLog('Container ref is null');
      return false;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const styles = window.getComputedStyle(containerRef.current);
    
    const validation = {
      exists: !!containerRef.current,
      dimensions: { width: rect.width, height: rect.height },
      computedStyles: {
        width: styles.width,
        height: styles.height,
        display: styles.display,
        visibility: styles.visibility,
        position: styles.position
      },
      isVisible: rect.width > 0 && rect.height > 0,
      hasFixedDimensions: rect.width === 900 && rect.height === 506
    };

    debugLog('Container validation:', validation);
    return validation.exists && validation.isVisible;
  }, [containerRef, debugLog]);

  const initializeSDK = useCallback(async () => {
    if (initializationRef.current || !containerRef.current || cleanupInProgressRef.current || !shouldInitialize) {
      debugLog('SDK initialization skipped - already initialized, container not ready, cleanup in progress, or not allowed to initialize');
      return false;
    }

    if (!validateContainer()) {
      debugLog('Container validation failed');
      return false;
    }

    initializationRef.current = true;
    debugLog('Starting SDK initialization following Zoom documentation...');

    try {
      // Step 1: Create new client instance (following Zoom docs)
      debugLog('Creating new ZoomMtgEmbedded client...');
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      if (!clientRef.current) {
        throw new Error('Failed to create Zoom client');
      }

      // Step 2: Clean container with innerHTML = "" (following Zoom docs)
      containerRef.current.innerHTML = '';
      debugLog('Container cleaned before init');

      // Step 3: Initialize with zoomAppRoot (following Zoom docs)
      const initConfig = {
        zoomAppRoot: containerRef.current,
        language: 'en-US',
        patchJsMedia: true,
        leaveOnPageUnload: true,
        disablePreview: false,
        success: (event: any) => {
          debugLog('Zoom client initialized successfully', event);
        },
        error: (event: any) => {
          debugLog('Zoom client initialization error', event);
          throw new Error(`Zoom init failed: ${event?.errorMessage || 'Unknown error'}`);
        }
      };

      debugLog('Calling client.init() with config:', { 
        ...initConfig, 
        zoomAppRoot: 'DOM Element'
      });
      
      await clientRef.current.init(initConfig);

      debugLog('client.init() completed successfully');
      
      // Validate post-init state
      const postInitValidation = {
        containerHasContent: containerRef.current.children.length > 0,
        containerHTML: containerRef.current.innerHTML.length,
        clientExists: !!clientRef.current,
        sessionId: sessionId.current
      };

      debugLog('Post-init validation:', postInitValidation);

      setIsSDKLoaded(true);
      setIsReady(true);
      
      if (!cleanupInProgressRef.current) {
        onReady?.();
      }
      
      return true;
    } catch (error: any) {
      debugLog('Failed to initialize Zoom SDK:', error);
      initializationRef.current = false;
      onError?.(error.message || 'Failed to initialize Zoom SDK');
      return false;
    }
  }, [containerRef, shouldInitialize, validateContainer, onReady, onError, debugLog]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    debugLog('joinMeeting called with config:', joinConfig);

    if (!isReady || !clientRef.current) {
      throw new Error('Zoom SDK not ready - client.init() must complete first');
    }

    if (isJoiningRef.current || cleanupInProgressRef.current) {
      debugLog('Join attempt already in progress or cleanup in progress');
      return;
    }

    isJoiningRef.current = true;
    debugLog('Starting join process...');

    const meetingNumberStr = String(joinConfig.meetingNumber).replace(/\s+/g, '');
    if (!/^\d{10,11}$/.test(meetingNumberStr)) {
      isJoiningRef.current = false;
      throw new Error(`Invalid meeting number format: ${joinConfig.meetingNumber}`);
    }

    try {
      const joinParams = {
        sdkKey: joinConfig.sdkKey,
        signature: joinConfig.signature,
        meetingNumber: meetingNumberStr,
        password: joinConfig.passWord || '',
        userName: joinConfig.userName,
        userEmail: joinConfig.userEmail || '',
        zak: joinConfig.zak || '',
        success: (success: any) => {
          debugLog('Join meeting success:', success);
          setIsJoined(true);
          
          // Post-join validation
          setTimeout(() => {
            if (containerRef.current) {
              const postJoinValidation = {
                containerChildren: containerRef.current.children.length,
                containerHTML: containerRef.current.innerHTML.length,
                hasVideoCanvas: !!containerRef.current.querySelector('canvas'),
                hasVideoElements: !!containerRef.current.querySelector('video'),
                sessionId: sessionId.current
              };
              debugLog('Post-join container analysis:', postJoinValidation);
            }
          }, 2000);
        },
        error: (error: any) => {
          debugLog('Join meeting error:', error);
          isJoiningRef.current = false;
          
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
        }
      };

      debugLog('Calling client.join() with params:', { 
        ...joinParams, 
        signature: '[REDACTED]', 
        zak: joinParams.zak ? '[PRESENT]' : '[EMPTY]',
        success: '[FUNCTION]',
        error: '[FUNCTION]'
      });
      
      await clientRef.current.join(joinParams);
      
      return true;
    } catch (error: any) {
      debugLog('client.join() failed:', error);
      isJoiningRef.current = false;
      throw error;
    }
  }, [isReady, containerRef, debugLog]);

  const leaveMeeting = useCallback(() => {
    if (clientRef.current && isJoined && !cleanupInProgressRef.current) {
      debugLog('Leaving meeting...');
      try {
        if (typeof clientRef.current.leave === 'function') {
          clientRef.current.leave();
          setIsJoined(false);
          debugLog('Left meeting successfully');
        }
      } catch (error) {
        debugLog('Error during meeting leave:', error);
      }
    }
  }, [isJoined, debugLog]);

  useEffect(() => {
    if (containerRef.current && shouldInitialize && !initializationRef.current && !cleanupInProgressRef.current) {
      debugLog('Container and conditions ready, initializing SDK...');
      initializeSDK();
    }
  }, [containerRef, shouldInitialize, initializeSDK, debugLog]);

  useEffect(() => {
    return () => {
      debugLog('Component unmounting, cleaning up...');
      cleanup();
    };
  }, [cleanup, debugLog]);

  return {
    isSDKLoaded,
    isReady,
    isJoined,
    joinMeeting,
    leaveMeeting,
    cleanup
  };
}

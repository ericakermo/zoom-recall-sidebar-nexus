
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
  const hasJoinedRef = useRef(false);

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

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      debugLog('Container cleaned');
    }
    
    setIsSDKLoaded(false);
    setIsReady(false);
    setIsJoined(false);
    initializationRef.current = false;
    isJoiningRef.current = false;
    hasJoinedRef.current = false;
    cleanupInProgressRef.current = false;
    
    debugLog('Zoom SDK cleanup completed');
  }, [isJoined, debugLog]);

  const validateContainer = useCallback(() => {
    if (!containerRef.current) {
      debugLog('Container ref is null');
      return false;
    }

    const rect = containerRef.current.getBoundingClientRect();
    
    const validation = {
      exists: !!containerRef.current,
      dimensions: { width: rect.width, height: rect.height },
      isVisible: rect.width > 0 && rect.height > 0,
      hasFixedDimensions: rect.width === 900 && rect.height === 506
    };

    debugLog('Container validation:', validation);
    return validation.exists && validation.isVisible;
  }, [debugLog]);

  const initializeSDK = useCallback(async () => {
    if (initializationRef.current || !containerRef.current || cleanupInProgressRef.current) {
      debugLog('SDK initialization skipped - already initialized, container not ready, or cleanup in progress');
      return false;
    }

    if (!validateContainer()) {
      debugLog('Container validation failed');
      return false;
    }

    initializationRef.current = true;
    debugLog('Starting SDK initialization...');

    try {
      debugLog('Creating new ZoomMtgEmbedded client...');
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      if (!clientRef.current) {
        throw new Error('Failed to create Zoom client');
      }

      containerRef.current.innerHTML = '';
      debugLog('Container cleaned before init');

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

      debugLog('Calling client.init()...');
      await clientRef.current.init(initConfig);

      debugLog('client.init() completed successfully');
      
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
  }, [validateContainer, onReady, onError, debugLog]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    debugLog('joinMeeting called');

    if (!isReady || !clientRef.current) {
      throw new Error('Zoom SDK not ready - client.init() must complete first');
    }

    if (isJoiningRef.current || hasJoinedRef.current || cleanupInProgressRef.current) {
      debugLog('Join attempt blocked - already joining/joined or cleanup in progress');
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
          hasJoinedRef.current = true;
          setIsJoined(true);
          
          // Set responsive video options after successful join
          setTimeout(() => {
            if (clientRef.current && typeof clientRef.current.updateVideoOptions === 'function') {
              try {
                clientRef.current.updateVideoOptions({
                  viewSizes: {
                    default: {
                      width: 900,
                      height: 506
                    }
                  }
                });
                debugLog('Responsive video dimensions configured successfully');
              } catch (error) {
                debugLog('Failed to configure video dimensions:', error);
              }
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

      debugLog('Calling client.join()...');
      await clientRef.current.join(joinParams);
      
      return true;
    } catch (error: any) {
      debugLog('client.join() failed:', error);
      isJoiningRef.current = false;
      throw error;
    }
  }, [isReady, debugLog]);

  const leaveMeeting = useCallback(() => {
    if (clientRef.current && isJoined && !cleanupInProgressRef.current) {
      debugLog('Leaving meeting...');
      try {
        if (typeof clientRef.current.leave === 'function') {
          clientRef.current.leave();
          setIsJoined(false);
          hasJoinedRef.current = false;
          debugLog('Left meeting successfully');
        }
      } catch (error) {
        debugLog('Error during meeting leave:', error);
      }
    }
  }, [isJoined, debugLog]);

  useEffect(() => {
    if (containerRef.current && !initializationRef.current && !cleanupInProgressRef.current) {
      debugLog('Container is ready, initializing SDK...');
      initializeSDK();
    }
  }, [initializeSDK, debugLog]);

  useEffect(() => {
    return () => {
      debugLog('Component unmounting, cleaning up...');
      cleanup();
    };
  }, [cleanup, debugLog]);

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


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
  }, [isJoined, debugLog]);

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
  }, [debugLog]);

  const setupSDKEventListeners = useCallback((client: any) => {
    debugLog('Setting up SDK event listeners...');

    // Connection events
    client.on('connection-change', (payload: any) => {
      debugLog('🔌 connection-change event:', payload);
    });

    client.on('media-sdk-change', (payload: any) => {
      debugLog('📺 media-sdk-change event:', payload);
    });

    // Meeting events
    client.on('meeting-status-changed', (payload: any) => {
      debugLog('📋 meeting-status-changed event:', payload);
    });

    // Video events
    client.on('video-active-change', (payload: any) => {
      debugLog('🎥 video-active-change event:', payload);
    });

    client.on('peer-video-state-change', (payload: any) => {
      debugLog('👥 peer-video-state-change event:', payload);
    });

    // Audio events
    client.on('audio-change', (payload: any) => {
      debugLog('🔊 audio-change event:', payload);
    });

    client.on('active-speaker', (payload: any) => {
      debugLog('🗣️ active-speaker event:', payload);
    });

    // User events
    client.on('user-added', (payload: any) => {
      debugLog('👤 user-added event:', payload);
    });

    client.on('user-removed', (payload: any) => {
      debugLog('👤 user-removed event:', payload);
    });

    debugLog('SDK event listeners configured');
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
    debugLog('Starting SDK initialization following Zoom documentation...');

    try {
      // Step 1: Create new client instance (following Zoom docs)
      debugLog('Creating new ZoomMtgEmbedded client...');
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      // Step 2: Setup event listeners before init
      setupSDKEventListeners(clientRef.current);

      // Step 3: Clean container with innerHTML = "" (following Zoom docs)
      containerRef.current.innerHTML = '';
      debugLog('Container cleaned before init');

      // Step 4: Initialize with zoomAppRoot (following Zoom docs)
      const initConfig = {
        zoomAppRoot: containerRef.current,
        language: 'en-US',
        patchJsMedia: true,
        leaveOnPageUnload: true
      };

      debugLog('Calling client.init() with config:', initConfig);
      
      await clientRef.current.init(initConfig);

      debugLog('client.init() completed successfully');
      
      // Validate post-init state
      const postInitValidation = {
        containerHasContent: containerRef.current.children.length > 0,
        containerHTML: containerRef.current.innerHTML.length,
        clientExists: !!clientRef.current
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
  }, [validateContainer, setupSDKEventListeners, onReady, onError, debugLog]);

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
        zak: joinConfig.zak || ''
      };

      debugLog('Calling client.join() with params:', { ...joinParams, signature: '[REDACTED]', zak: joinParams.zak ? '[PRESENT]' : '[EMPTY]' });
      
      const result = await clientRef.current.join(joinParams);
      
      debugLog('client.join() completed successfully:', result);
      setIsJoined(true);

      // Post-join validation
      setTimeout(() => {
        if (containerRef.current) {
          const postJoinValidation = {
            containerChildren: containerRef.current.children.length,
            containerHTML: containerRef.current.innerHTML.length,
            hasVideoCanvas: !!containerRef.current.querySelector('canvas'),
            hasVideoElements: !!containerRef.current.querySelector('video'),
            visibleElements: Array.from(containerRef.current.querySelectorAll('*')).filter(el => {
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            }).length
          };
          debugLog('Post-join container analysis:', postJoinValidation);
        }
      }, 2000);
      
      return result;
    } catch (error: any) {
      debugLog('client.join() failed:', error);
      
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
    } finally {
      isJoiningRef.current = false;
    }
  }, [isReady, debugLog]);

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

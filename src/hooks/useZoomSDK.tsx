
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

  // Debug: Log join configuration
  const debugJoinConfig = useCallback((config: any) => {
    console.log('🔧 [DEBUG] Join configuration analysis:', {
      hasSDKKey: !!config.sdkKey,
      hasSignature: !!config.signature,
      hasMeetingNumber: !!config.meetingNumber,
      hasUserName: !!config.userName,
      hasPassword: !!config.password,
      hasZAK: !!config.tk,
      role: config.role,
      meetingNumberFormat: typeof config.meetingNumber,
      signatureLength: config.signature?.length,
      sessionId
    });
    
    // Validate required fields
    const requiredFields = ['sdkKey', 'signature', 'meetingNumber', 'userName'];
    const missingFields = requiredFields.filter(field => !config[field]);
    if (missingFields.length > 0) {
      console.error('❌ [DEBUG] Missing required join config fields:', missingFields);
    }
    
    // Check data types
    if (typeof config.meetingNumber !== 'string') {
      console.warn('⚠️ [DEBUG] meetingNumber should be string, got:', typeof config.meetingNumber);
    }
  }, [sessionId]);

  // Enhanced cleanup with better DOM handling
  const cleanup = useCallback(() => {
    if (cleanupInProgressRef.current) {
      console.log('⏸️ [DEBUG] Cleanup already in progress, skipping...', sessionId);
      return;
    }

    cleanupInProgressRef.current = true;
    console.log('🧹 [DEBUG] Starting enhanced Zoom SDK cleanup...', sessionId);
    
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
    
    // Enhanced DOM cleanup with error handling
    if (containerRef.current) {
      try {
        // Clear container content safely
        const container = containerRef.current;
        while (container.firstChild) {
          try {
            container.removeChild(container.firstChild);
          } catch (e) {
            // Child might have been removed by React or other code
            console.log('⚠️ [DEBUG] Child already removed during cleanup');
            break;
          }
        }
        console.log('✅ [DEBUG] Container cleared safely');
      } catch (error) {
        console.warn('⚠️ [DEBUG] Container cleanup error:', error);
      }
    }
    
    // Clear global Zoom state if possible
    try {
      if (window.ZoomMtgEmbedded) {
        // Force cleanup any lingering instances
        console.log('🔄 [DEBUG] Clearing global Zoom state');
      }
    } catch (error) {
      console.log('⚠️ [DEBUG] Global state cleanup warning:', error);
    }
    
    setIsSDKLoaded(false);
    setIsReady(false);
    setIsJoined(false);
    initializationRef.current = false;
    isJoiningRef.current = false;
    cleanupInProgressRef.current = false;
    
    console.log('✅ [DEBUG] Enhanced Zoom SDK cleanup completed', sessionId);
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
      
      // Wait a moment to ensure DOM is stable
      await new Promise(resolve => setTimeout(resolve, 100));
      
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      console.log('🔄 [DEBUG] Initializing Zoom SDK with enhanced session-aware settings...');
      
      const initConfig = {
        zoomAppRoot: containerRef.current,
        language: 'en-US',
        patchJSMedia: true,
        leaveOnPageUnload: true,
        customize: {
          video: {
            isResizable: false,
            viewSizes: {
              default: {
                width: 900,
                height: 506
              }
            }
          },
          meetingInfo: ['topic', 'host', 'mn', 'pwd', 'telPwd', 'invite', 'participant', 'dc', 'enctype'],
          toolbar: {
            buttons: [
              {
                text: 'Custom Button',
                className: 'CustomButton',
                onClick: () => {
                  console.log('🔘 [DEBUG] Custom button clicked');
                }
              }
            ]
          }
        }
      };

      console.log('🔧 [DEBUG] SDK init config:', {
        hasContainer: !!initConfig.zoomAppRoot,
        containerDimensions: {
          width: containerRef.current?.offsetWidth,
          height: containerRef.current?.offsetHeight
        },
        sessionId
      });

      await clientRef.current.init(initConfig);

      // Verify SDK state after initialization
      console.log('🔍 [DEBUG] SDK state after init:', {
        clientExists: !!clientRef.current,
        containerHasContent: containerRef.current?.children.length,
        sessionId
      });

      setIsSDKLoaded(true);
      setIsReady(true);
      console.log('✅ [DEBUG] Zoom SDK initialized successfully with enhanced session awareness');
      
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
    console.log('📍 [DEBUG] Joining meeting with enhanced session-aware SDK...', sessionId);

    // Debug join configuration
    debugJoinConfig(joinConfig);

    if (!isReady || !clientRef.current) {
      const error = new Error('Zoom SDK not ready');
      console.error('❌ [DEBUG] SDK not ready for join:', {
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

    // Validate and format meeting number
    const meetingNumberStr = String(joinConfig.meetingNumber).replace(/\s+/g, '');
    if (!/^\d{10,11}$/.test(meetingNumberStr)) {
      isJoiningRef.current = false;
      throw new Error(`Invalid meeting number format: ${joinConfig.meetingNumber}`);
    }
    
    try {
      console.log('🔄 [DEBUG] Joining with enhanced session-aware config format:', {
        meetingNumber: meetingNumberStr,
        userName: joinConfig.userName,
        role: joinConfig.role,
        hasSignature: !!joinConfig.signature,
        hasZAK: !!joinConfig.zak,
        sessionId
      });
      
      // Enhanced join configuration for embedded SDK
      const enhancedJoinConfig = {
        sdkKey: String(joinConfig.sdkKey || ''),
        signature: String(joinConfig.signature || ''),
        meetingNumber: meetingNumberStr,
        password: String(joinConfig.passWord || joinConfig.password || ''),
        userName: String(joinConfig.userName || 'Guest'),
        userEmail: String(joinConfig.userEmail || ''),
        tk: String(joinConfig.zak || ''), // Use 'tk' for embedded SDK
        success: (success: any) => {
          console.log('✅ [DEBUG] Successfully joined meeting with enhanced session-aware SDK', {
            success,
            sessionId
          });
          setIsJoined(true);
          
          // Debug: Check if video content is rendered
          setTimeout(() => {
            console.log('🔍 [DEBUG] Post-join container analysis:', {
              containerChildren: containerRef.current?.children.length,
              containerContent: containerRef.current?.innerHTML.length,
              visibleElements: containerRef.current?.querySelectorAll('video, canvas').length,
              sessionId
            });
          }, 2000);
        },
        error: (error: any) => {
          console.error('❌ [DEBUG] Join error from enhanced SDK:', {
            error,
            errorCode: error?.errorCode,
            reason: error?.reason,
            sessionId
          });
          throw error;
        }
      };
      
      console.log('🔧 [DEBUG] Enhanced session-aware join config prepared');
      
      const result = await clientRef.current.join(enhancedJoinConfig);
      
      console.log('✅ [DEBUG] Join method called successfully with enhanced config');
      return result;
    } catch (error: any) {
      console.error('❌ [DEBUG] Failed to join meeting:', {
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
      } else if (errorMessage.includes('conflict') || errorMessage.includes('session')) {
        errorMessage = 'Session conflict detected - please retry with a fresh session';
      }
      
      throw new Error(errorMessage);
    } finally {
      isJoiningRef.current = false;
    }
  }, [isReady, sessionId, debugJoinConfig]);

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

  useEffect(() => {
    if (containerRef.current && !initializationRef.current && !cleanupInProgressRef.current) {
      console.log('🎯 [DEBUG] Container ready, initializing SDK with enhanced debugging...', {
        containerExists: !!containerRef.current,
        sessionId
      });
      initializeSDK();
    }
  }, [initializeSDK, sessionId]);

  useEffect(() => {
    return () => {
      console.log('🔄 [DEBUG] Component unmounting, cleaning up with enhanced debugging...', sessionId);
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

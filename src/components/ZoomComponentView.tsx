
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useZoomSDK } from '@/hooks/useZoomSDK';
import { useZoomMeeting } from '@/hooks/useZoomMeeting';
import { ZoomMeetingControls } from '@/components/zoom/ZoomMeetingControls';
import { ZoomLoadingOverlay } from '@/components/zoom/ZoomLoadingOverlay';
import { ZoomErrorDisplay } from '@/components/zoom/ZoomErrorDisplay';

interface ZoomComponentViewProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingJoined?: () => void;
  onMeetingError?: (error: string) => void;
  onMeetingLeft?: () => void;
}

interface ZoomJoinConfig {
  sdkKey: string;
  signature: string;
  meetingNumber: string;
  userName: string;
  userEmail?: string;
  passWord: string;
  role: number;
  zak?: string;
  success: (result: any) => void;
  error: (error: any) => void;
}

export function ZoomComponentView({
  meetingNumber,
  meetingPassword,
  userName: providedUserName,
  role = 0,
  onMeetingJoined,
  onMeetingError,
  onMeetingLeft
}: ZoomComponentViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef(false);
  
  const { user } = useAuth();
  const MAX_RETRIES = 3;

  const {
    sdkReady,
    error,
    currentStep,
    mountedRef,
    logStep,
    handleError,
    loadZoomSDK
  } = useZoomSDK(onMeetingError);

  const {
    isJoined,
    setIsJoined,
    isMuted,
    isVideoOff,
    clientRef,
    getTokens,
    toggleMute,
    toggleVideo,
    handleLeaveMeeting
  } = useZoomMeeting({
    onMeetingJoined,
    onMeetingError,
    onMeetingLeft,
    logStep,
    handleError,
    mountedRef
  });

  // Enhanced container validation
  const validateContainer = useCallback((container: HTMLElement): string | null => {
    logStep('🔍 Enhanced container validation...');
    
    if (!container) {
      return 'Container element is null';
    }

    if (!document.contains(container)) {
      return 'Container is not mounted in DOM';
    }

    // Wait for layout to complete
    const rect = container.getBoundingClientRect();
    logStep(`📏 Container dimensions: ${rect.width}x${rect.height}`);
    
    if (rect.width === 0 || rect.height === 0) {
      return `Container has zero dimensions: ${rect.width}x${rect.height}`;
    }

    // Check minimum size requirements for Zoom SDK
    if (rect.width < 400 || rect.height < 300) {
      return `Container too small for Zoom SDK: ${rect.width}x${rect.height} (minimum 400x300)`;
    }

    const computedStyle = window.getComputedStyle(container);
    if (computedStyle.display === 'none') {
      return 'Container is hidden (display: none)';
    }

    if (computedStyle.visibility === 'hidden') {
      return 'Container is hidden (visibility: hidden)';
    }

    // Check if any parent is hidden
    let parent = container.parentElement;
    while (parent && parent !== document.body) {
      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
        return `Parent element is hidden: ${parent.tagName}`;
      }
      parent = parent.parentElement;
    }

    logStep('✅ Container validation passed');
    return null;
  }, [logStep]);

  // Initialize and join meeting
  const initializeAndJoin = useCallback(async () => {
    if (initializationRef.current || !containerRef.current || !sdkReady || !mountedRef.current) {
      return;
    }

    initializationRef.current = true;
    
    if (mountedRef.current) {
      setIsLoading(true);
    }

    try {
      logStep('Starting Zoom Component initialization...');

      // Get tokens first
      const tokens = await getTokens(meetingNumber, role || 0);

      // Wait for DOM to be completely stable
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 200);
        });
      });

      // Validate container
      if (!containerRef.current || !mountedRef.current) {
        throw new Error('Container element not available');
      }

      const container = containerRef.current;
      const containerError = validateContainer(container);
      if (containerError) {
        throw new Error(`Container validation failed: ${containerError}`);
      }

      // Force container properties that Zoom SDK requires
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.minHeight = '500px';
      container.style.display = 'block';
      container.style.visibility = 'visible';
      container.style.position = 'relative';
      container.style.overflow = 'hidden';
      
      if (!container.id) {
        container.id = 'zoomComponentContainer';
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Create client
      logStep('Creating Zoom client...');
      if (!window.ZoomMtgEmbedded) {
        throw new Error('ZoomMtgEmbedded not available');
      }
      
      if (clientRef.current) {
        try {
          if (typeof clientRef.current.leave === 'function') {
            clientRef.current.leave();
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      const client = window.ZoomMtgEmbedded.createClient();
      clientRef.current = client;

      // Complete init configuration
      logStep('Initializing client with complete configuration...');
      
      const initConfig = {
        zoomAppRoot: container,
        language: 'en-US',
        patchJsMedia: true,
        leaveUrl: window.location.origin + '/calendar',
        success: () => {
          logStep('✅ Client init success callback fired');
        },
        error: (error: any) => {
          logStep('❌ Client init error callback fired');
          console.error('Init error details:', error);
        },
        isSupportAV: true,
        isSupportChat: true,
        isSupportQA: true,
        isSupportCC: true,
        isSupportPolling: true,
        isSupportBreakout: true,
        screenShare: true,
        videoDrag: true,
        sharingMode: 'both',
        videoHeader: true,
        isLockBottom: true,
        isShowJoinAudioFunction: true,
        isSupportNonverbal: true,
        isShowMeetingHeader: false,
        disableInvite: false,
        disableCallOut: false,
        disableRecord: false,
        disableJoinAudio: false,
        audioPanelAlwaysOpen: false,
        showMeetingHeader: false,
        showPureSharingContent: false,
        enableLoggerUI: false,
        showLearningExperienceUrl: false,
        showSurveyUrl: false,
        showUpgradeWarning: false,
        showOriginUrlInInvite: false,
        enableInviteUrlOnJoinScreen: false,
        disablePhonePasscode: false
      };

      logStep('Init config prepared with all required properties');

      // Initialize with timeout
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          if (!mountedRef.current || !clientRef.current) {
            reject(new Error('Component unmounted or client null during init'));
            return;
          }

          let resolved = false;

          const originalSuccess = initConfig.success;
          const originalError = initConfig.error;

          initConfig.success = () => {
            if (!resolved) {
              resolved = true;
              originalSuccess();
              logStep('✅ Client initialized successfully - resolving promise');
              resolve();
            }
          };

          initConfig.error = (error: any) => {
            if (!resolved) {
              resolved = true;
              originalError(error);
              const errorMessage = error.message || error.reason || 'Unknown init error';
              logStep(`❌ Client init failed: ${errorMessage}`);
              reject(new Error(`Initialization failed: ${errorMessage}`));
            }
          };

          logStep('🚀 Calling client.init() with complete configuration...');
          
          try {
            clientRef.current.init(initConfig);
            logStep('📞 client.init() called, waiting for callbacks...');
          } catch (syncError) {
            if (!resolved) {
              resolved = true;
              logStep(`💥 Synchronous error in client.init(): ${syncError.message}`);
              reject(new Error(`Sync init error: ${syncError.message}`));
            }
          }
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => {
            logStep('⏰ Client initialization timed out after 10 seconds');
            reject(new Error('Client initialization timed out - SDK configuration issue detected'));
          }, 10000);
        })
      ]);

      if (!mountedRef.current) {
        throw new Error('Component unmounted during initialization');
      }

      // JOIN THE MEETING
      logStep('Proceeding to join meeting...');

      const joinConfig: ZoomJoinConfig = {
        sdkKey: tokens.sdkKey,
        signature: tokens.signature,
        meetingNumber,
        userName: providedUserName || user?.email || 'Guest',
        userEmail: user?.email || '',
        passWord: meetingPassword || '',
        role: role || 0,
        success: (result: any) => {
          logStep('✅ Join success', result);
          if (mountedRef.current) {
            setIsJoined(true);
            setIsLoading(false);
            onMeetingJoined?.();
          }
        },
        error: (error: any) => {
          console.error('❌ Join error:', error);
          const errorMessage = error.message || error.reason || 'Failed to join meeting';
          if (mountedRef.current) {
            handleError(errorMessage);
          }
        }
      };

      // Add ZAK token if available
      if (role === 1 && tokens.zak) {
        joinConfig.zak = tokens.zak;
        logStep('Added ZAK token to join config');
      }

      if (!mountedRef.current || !clientRef.current) {
        throw new Error('Component unmounted or client null before join');
      }

      // Join with timeout
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          if (!clientRef.current) {
            reject(new Error('Client is null'));
            return;
          }

          const originalSuccess = joinConfig.success;
          joinConfig.success = (result: any) => {
            originalSuccess(result);
            resolve();
          };

          const originalError = joinConfig.error;
          joinConfig.error = (error: any) => {
            originalError(error);
            reject(new Error(error.message || error.reason || 'Join failed'));
          };

          logStep('Calling client.join() with config');
          clientRef.current.join(joinConfig);
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Join operation timed out after 20 seconds'));
          }, 20000);
        })
      ]);

      logStep('✅ Meeting joined successfully!');

    } catch (err: any) {
      console.error('❌ Initialization/Join error:', err);
      if (mountedRef.current) {
        handleError(err.message || 'Failed to initialize meeting');
      }
    } finally {
      initializationRef.current = false;
    }
  }, [
    sdkReady,
    meetingNumber,
    role,
    providedUserName,
    user,
    meetingPassword,
    onMeetingJoined,
    handleError,
    getTokens,
    logStep,
    validateContainer,
    setIsJoined,
    setIsLoading
  ]);

  const handleRetry = useCallback(() => {
    if (retryCount >= MAX_RETRIES) {
      handleError('Maximum retry attempts reached');
      return;
    }

    logStep(`Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
    if (mountedRef.current) {
      setRetryCount(prev => prev + 1);
    }
    initializationRef.current = false;
    
    setTimeout(() => {
      if (mountedRef.current) {
        initializeAndJoin();
      }
    }, 1000);
  }, [retryCount, initializeAndJoin, handleError, logStep]);

  // Load SDK on mount
  useEffect(() => {
    mountedRef.current = true;
    logStep('Component mounted, loading SDK...');
    loadZoomSDK().catch(err => {
      console.error('Failed to load SDK:', err);
      if (mountedRef.current) {
        handleError('Failed to load Zoom SDK');
      }
    });

    return () => {
      mountedRef.current = false;
    };
  }, [loadZoomSDK, handleError, logStep]);

  // Initialize when ready
  useEffect(() => {
    if (sdkReady && containerRef.current && meetingNumber && !initializationRef.current && mountedRef.current) {
      logStep('SDK ready, starting initialization in 1000ms...');
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          initializeAndJoin();
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [sdkReady, meetingNumber, initializeAndJoin, logStep]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      logStep('Component unmounting, cleaning up...');
      mountedRef.current = false;
      if (clientRef.current && typeof clientRef.current.leave === 'function') {
        try {
          clientRef.current.leave();
        } catch (error) {
          console.error('Cleanup error:', error);
        }
      }
    };
  }, [logStep]);

  if (error) {
    return (
      <ZoomErrorDisplay
        error={error}
        meetingNumber={meetingNumber}
        retryCount={retryCount}
        maxRetries={MAX_RETRIES}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      <ZoomLoadingOverlay
        isLoading={isLoading}
        currentStep={currentStep}
        meetingNumber={meetingNumber}
        retryCount={retryCount}
        maxRetries={MAX_RETRIES}
      />

      <div 
        ref={containerRef}
        id="zoomComponentContainer"
        className="w-full h-full"
        style={{ 
          minHeight: '500px',
          minWidth: '400px',
          position: 'relative',
          overflow: 'hidden'
        }}
      />

      <ZoomMeetingControls
        isJoined={isJoined}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onLeaveMeeting={handleLeaveMeeting}
      />
    </div>
  );
}

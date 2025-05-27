
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

  // Simplified container validation
  const validateContainer = useCallback((container: HTMLElement): string | null => {
    if (!container || !document.contains(container)) {
      return 'Container not in DOM';
    }

    const rect = container.getBoundingClientRect();
    if (rect.width < 400 || rect.height < 300) {
      return `Container too small: ${rect.width}x${rect.height}`;
    }

    return null;
  }, []);

  // Fixed initialization with proper configuration
  const initializeAndJoin = useCallback(async () => {
    if (initializationRef.current || !containerRef.current || !sdkReady || !mountedRef.current) {
      return;
    }

    initializationRef.current = true;
    
    if (mountedRef.current) {
      setIsLoading(true);
    }

    try {
      logStep('Starting Zoom initialization...');

      // Get tokens first
      const tokens = await getTokens(meetingNumber, role || 0);

      // Wait for DOM stability
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 100);
        });
      });

      // Validate container
      const container = containerRef.current;
      if (!container || !mountedRef.current) {
        throw new Error('Container not available');
      }

      const containerError = validateContainer(container);
      if (containerError) {
        throw new Error(`Container validation failed: ${containerError}`);
      }

      // Setup container with required properties
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.minHeight = '400px';
      container.style.position = 'relative';
      container.style.overflow = 'hidden';
      container.id = 'zoomComponentContainer';

      logStep('Creating Zoom client...');
      if (!window.ZoomMtgEmbedded) {
        throw new Error('ZoomMtgEmbedded not available');
      }
      
      // Clean up any existing client
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

      // Simplified, working init configuration
      logStep('Initializing client...');
      
      const initConfig = {
        zoomAppRoot: container,
        language: 'en-US',
        patchJsMedia: true,
        leaveUrl: window.location.origin + '/calendar',
        isSupportAV: true,
        isSupportChat: true,
        screenShare: true,
        success: () => {
          logStep('✅ Client initialized successfully');
        },
        error: (error: any) => {
          logStep('❌ Client init error');
          console.error('Init error details:', error);
        }
      };

      // Initialize with reduced timeout
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          if (!mountedRef.current || !clientRef.current) {
            reject(new Error('Component unmounted during init'));
            return;
          }

          let resolved = false;

          const originalSuccess = initConfig.success;
          const originalError = initConfig.error;

          initConfig.success = () => {
            if (!resolved) {
              resolved = true;
              originalSuccess();
              resolve();
            }
          };

          initConfig.error = (error: any) => {
            if (!resolved) {
              resolved = true;
              originalError(error);
              reject(new Error(`Init failed: ${error.message || error.reason || 'Unknown error'}`));
            }
          };

          logStep('Calling client.init()...');
          
          try {
            clientRef.current.init(initConfig);
          } catch (syncError) {
            if (!resolved) {
              resolved = true;
              reject(new Error(`Sync init error: ${syncError.message}`));
            }
          }
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Client initialization timed out after 5 seconds'));
          }, 5000);
        })
      ]);

      if (!mountedRef.current) {
        throw new Error('Component unmounted during initialization');
      }

      // JOIN THE MEETING
      logStep('Joining meeting...');

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
        logStep('Added ZAK token for host');
      }

      if (!mountedRef.current || !clientRef.current) {
        throw new Error('Component unmounted before join');
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

          logStep('Calling client.join()...');
          clientRef.current.join(joinConfig);
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Join operation timed out after 15 seconds'));
          }, 15000);
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
      logStep('SDK ready, initializing...');
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          initializeAndJoin();
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [sdkReady, meetingNumber, initializeAndJoin, logStep]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      logStep('Component unmounting...');
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
          minHeight: '400px',
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

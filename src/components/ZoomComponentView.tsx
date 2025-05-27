import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ZOOM_SDK_KEY } from '@/lib/zoom-component-config';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, MicOff, Video, VideoOff, Phone, AlertCircle } from 'lucide-react';

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
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [currentStep, setCurrentStep] = useState('Initializing...');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const initializationRef = useRef(false);
  const joinAttemptRef = useRef(false);
  const mountedRef = useRef(true);
  
  const { user } = useAuth();
  const { toast } = useToast();

  const MAX_RETRIES = 3;

  const logStep = useCallback((step: string, data?: any) => {
    console.log(`🔄 [ZoomComponentView] ${step}`, data || '');
    if (mountedRef.current) {
      setCurrentStep(step);
    }
  }, []);

  const handleError = useCallback((errorMessage: string, details?: any) => {
    console.error('❌ [ZoomComponentView] Error:', errorMessage, details);
    if (mountedRef.current) {
      setError(errorMessage);
      setIsLoading(false);
      onMeetingError?.(errorMessage);
    }
  }, [onMeetingError]);

  // Load Zoom SDK with improved error handling
  const loadZoomSDK = useCallback(async () => {
    if (window.ZoomMtgEmbedded || sdkReady) {
      logStep('SDK already loaded');
      setSdkReady(true);
      return true;
    }

    try {
      logStep('Loading Zoom Component SDK...');
      
      // Make React available globally (CRITICAL for SDK)
      if (!window.React) {
        logStep('Loading React globally...');
        window.React = (await import('react')).default;
      }
      if (!window.ReactDOM) {
        logStep('Loading ReactDOM globally...');
        window.ReactDOM = (await import('react-dom')).default;
      }

      // Load CSS files first
      logStep('Loading Zoom CSS files...');
      const cssFiles = [
        'https://source.zoom.us/3.13.2/css/bootstrap.css',
        'https://source.zoom.us/3.13.2/css/react-select.css'
      ];

      await Promise.all(cssFiles.map(url => {
        return new Promise<void>((resolve) => {
          if (document.querySelector(`link[href="${url}"]`)) {
            resolve();
            return;
          }
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = url;
          link.onload = () => resolve();
          link.onerror = () => resolve(); // Don't fail on CSS errors
          document.head.appendChild(link);
        });
      }));

      // Load SDK script
      logStep('Loading Zoom SDK script...');
      await new Promise<void>((resolve, reject) => {
        if (document.querySelector('script[src*="zoom-meeting-embedded"]')) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://source.zoom.us/3.13.2/zoom-meeting-embedded-3.13.2.min.js';
        script.async = false;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Zoom SDK script'));
        document.head.appendChild(script);
      });

      // Wait for SDK to be available with better polling
      logStep('Waiting for ZoomMtgEmbedded...');
      let attempts = 0;
      const maxAttempts = 100; // Increased attempts
      
      while (!window.ZoomMtgEmbedded && attempts < maxAttempts && mountedRef.current) {
        await new Promise(resolve => setTimeout(resolve, 50)); // Shorter intervals
        attempts++;
      }

      if (!window.ZoomMtgEmbedded) {
        throw new Error('Zoom SDK failed to initialize after timeout');
      }

      logStep('✅ Zoom Component SDK loaded successfully');
      
      if (mountedRef.current) {
        setSdkReady(true);
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to load Zoom SDK:', error);
      throw error;
    }
  }, [sdkReady, logStep]);

  // Get tokens
  const getTokens = useCallback(async () => {
    try {
      logStep('Fetching Zoom tokens...', { meetingNumber, role });

      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
        body: {
          meetingNumber,
          role: role || 0,
          expirationSeconds: 7200
        }
      });

      if (tokenError) {
        throw new Error(`Token error: ${tokenError.message}`);
      }

      logStep('Tokens retrieved successfully');

      // Get ZAK token if host
      let zakToken = null;
      if (role === 1) {
        logStep('Fetching ZAK token for host...');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        if (!zakError && zakData) {
          zakToken = zakData.zak;
          logStep('ZAK token retrieved successfully');
        }
      }

      return { ...tokenData, zak: zakToken };
    } catch (error) {
      console.error('❌ Token fetch failed:', error);
      throw error;
    }
  }, [meetingNumber, role, logStep]);

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

  // FIXED: Initialize and join meeting with proper SDK configuration
  const initializeAndJoin = useCallback(async () => {
    if (initializationRef.current || !containerRef.current || !sdkReady || !mountedRef.current) {
      return;
    }

    initializationRef.current = true;
    
    if (mountedRef.current) {
      setIsLoading(true);
      setError(null);
    }

    try {
      logStep('Starting Zoom Component initialization...');

      // Get tokens first
      const tokens = await getTokens();

      // CRITICAL: Wait for DOM to be completely stable
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 200); // Give extra time for DOM stability
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

      // CRITICAL: Force container properties that Zoom SDK requires
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.minHeight = '500px';
      container.style.display = 'block';
      container.style.visibility = 'visible';
      container.style.position = 'relative';
      container.style.overflow = 'hidden'; // Zoom SDK requirement
      
      // Ensure container has a proper ID (SDK requirement)
      if (!container.id) {
        container.id = 'zoomComponentContainer';
      }

      // Wait for styling to take effect
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create client ONCE
      logStep('Creating Zoom client...');
      if (!window.ZoomMtgEmbedded) {
        throw new Error('ZoomMtgEmbedded not available');
      }
      
      // Clear any existing client
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

      // FIXED: Complete init configuration (missing properties cause hangs)
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
        // CRITICAL: Missing properties that cause hangs
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

      // Initialize with proper timeout and error handling
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
        // Reduced timeout to 10 seconds (if it takes longer, something is wrong)
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
    validateContainer
  ]);

  const handleRetry = useCallback(() => {
    if (retryCount >= MAX_RETRIES) {
      handleError('Maximum retry attempts reached');
      return;
    }

    logStep(`Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
    if (mountedRef.current) {
      setRetryCount(prev => prev + 1);
      setError(null);
    }
    initializationRef.current = false;
    
    setTimeout(() => {
      if (mountedRef.current) {
        initializeAndJoin();
      }
    }, 1000);
  }, [retryCount, initializeAndJoin, handleError, logStep]);

  const handleLeaveMeeting = useCallback(async () => {
    try {
      logStep('Leaving meeting...');
      if (clientRef.current && typeof clientRef.current.leave === 'function') {
        await clientRef.current.leave();
        logStep('✅ Successfully left meeting');
      }
      if (mountedRef.current) {
        setIsJoined(false);
        onMeetingLeft?.();
      }
    } catch (error) {
      console.error('❌ Error leaving meeting:', error);
    }
  }, [onMeetingLeft, logStep]);

  const toggleMute = useCallback(() => {
    if (clientRef.current && isJoined && mountedRef.current) {
      try {
        if (isMuted) {
          clientRef.current.unmuteAudio();
          logStep('Audio unmuted');
        } else {
          clientRef.current.muteAudio();
          logStep('Audio muted');
        }
        setIsMuted(!isMuted);
      } catch (error) {
        console.error('Error toggling mute:', error);
      }
    }
  }, [isMuted, isJoined, logStep]);

  const toggleVideo = useCallback(() => {
    if (clientRef.current && isJoined && mountedRef.current) {
      try {
        if (isVideoOff) {
          clientRef.current.startVideo();
          logStep('Video started');
        } else {
          clientRef.current.stopVideo();
          logStep('Video stopped');
        }
        setIsVideoOff(!isVideoOff);
      } catch (error) {
        console.error('Error toggling video:', error);
      }
    }
  }, [isVideoOff, isJoined, logStep]);

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

  // Initialize when ready with better timing
  useEffect(() => {
    if (sdkReady && containerRef.current && meetingNumber && !initializationRef.current && mountedRef.current) {
      logStep('SDK ready, starting initialization in 1000ms...');
      // Increased delay to ensure DOM is completely stable
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
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md">
          <p className="text-red-600 font-medium">Meeting Error</p>
          <p className="text-red-500 text-sm mt-1">{error}</p>
        </div>
        {retryCount < MAX_RETRIES && (
          <Button onClick={handleRetry} className="mb-2">
            Retry ({retryCount + 1}/{MAX_RETRIES + 1})
          </Button>
        )}
        <p className="text-sm text-gray-600">
          Meeting ID: {meetingNumber}
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-50">
          <div className="text-center text-white">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-lg">{currentStep}</p>
            <p className="text-sm text-gray-400 mt-2">Meeting ID: {meetingNumber}</p>
            {retryCount > 0 && (
              <p className="text-xs text-yellow-400 mt-1">
                Retry attempt {retryCount}/{MAX_RETRIES}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Zoom meeting container with required properties */}
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

      {/* Custom meeting controls */}
      {isJoined && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40">
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2">
            <Button
              size="sm"
              variant={isMuted ? "destructive" : "secondary"}
              onClick={toggleMute}
              className="rounded-full w-10 h-10 p-0"
            >
              {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            
            <Button
              size="sm"
              variant={isVideoOff ? "destructive" : "secondary"}
              onClick={toggleVideo}
              className="rounded-full w-10 h-10 p-0"
            >
              {isVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            </Button>
            
            <Button
              size="sm"
              variant="destructive"
              onClick={handleLeaveMeeting}
              className="rounded-full w-10 h-10 p-0 ml-2"
            >
              <Phone className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

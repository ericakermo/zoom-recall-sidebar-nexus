
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
  
  const { user } = useAuth();
  const { toast } = useToast();

  const MAX_RETRIES = 3;

  const logStep = useCallback((step: string, data?: any) => {
    console.log(`🔄 [ZoomComponentView] ${step}`, data || '');
    setCurrentStep(step);
  }, []);

  const handleError = useCallback((errorMessage: string, details?: any) => {
    console.error('❌ [ZoomComponentView] Error:', errorMessage, details);
    setError(errorMessage);
    setIsLoading(false);
    onMeetingError?.(errorMessage);
  }, [onMeetingError]);

  // Load Zoom SDK with comprehensive logging
  const loadZoomSDK = useCallback(async () => {
    if (window.ZoomMtgEmbedded || sdkReady) {
      logStep('SDK already loaded');
      setSdkReady(true);
      return true;
    }

    try {
      logStep('Starting Zoom Component SDK loading...');
      
      // Make React available globally
      if (!window.React) {
        logStep('Loading React globally...');
        window.React = (await import('react')).default;
      }
      if (!window.ReactDOM) {
        logStep('Loading ReactDOM globally...');
        window.ReactDOM = (await import('react-dom')).default;
      }

      // Load CSS files
      logStep('Loading Zoom CSS files...');
      const cssFiles = [
        'https://source.zoom.us/3.13.2/css/bootstrap.css',
        'https://source.zoom.us/3.13.2/css/react-select.css'
      ];

      await Promise.all(cssFiles.map(url => {
        return new Promise<void>((resolve) => {
          if (document.querySelector(`link[href="${url}"]`)) {
            logStep(`CSS already loaded: ${url}`);
            resolve();
            return;
          }
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = url;
          link.onload = () => {
            logStep(`CSS loaded successfully: ${url}`);
            resolve();
          };
          link.onerror = () => {
            console.warn(`Failed to load CSS: ${url}`);
            resolve(); // Don't fail on CSS errors
          };
          document.head.appendChild(link);
        });
      }));

      // Load SDK script
      logStep('Loading Zoom SDK script...');
      await new Promise<void>((resolve, reject) => {
        if (document.querySelector('script[src*="zoom-meeting-embedded"]')) {
          logStep('SDK script already exists');
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://source.zoom.us/3.13.2/zoom-meeting-embedded-3.13.2.min.js';
        script.async = false;
        script.onload = () => {
          logStep('SDK script loaded successfully');
          resolve();
        };
        script.onerror = () => {
          const error = new Error('Failed to load Zoom SDK script');
          console.error('❌ SDK script load error:', error);
          reject(error);
        };
        document.head.appendChild(script);
      });

      // Wait for SDK to be available
      logStep('Waiting for ZoomMtgEmbedded to be available...');
      let attempts = 0;
      const maxAttempts = 50;
      
      while (!window.ZoomMtgEmbedded && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
        if (attempts % 10 === 0) {
          logStep(`Still waiting for SDK... (${attempts}/${maxAttempts})`);
        }
      }

      if (!window.ZoomMtgEmbedded) {
        throw new Error('Zoom SDK failed to initialize after timeout');
      }

      logStep('✅ Zoom Component SDK loaded successfully', {
        version: window.ZoomMtgEmbedded.version || 'unknown',
        attempts
      });
      setSdkReady(true);
      return true;
    } catch (error) {
      console.error('❌ Failed to load Zoom SDK:', error);
      throw error;
    }
  }, [sdkReady, logStep]);

  // Validate meeting status with detailed logging
  const validateMeetingStatus = useCallback(async () => {
    try {
      logStep('Validating meeting status...', { meetingNumber });
      
      const { data, error } = await supabase.functions.invoke('validate-meeting-status', {
        body: { meetingId: meetingNumber }
      });

      if (error) {
        throw new Error(`Meeting validation failed: ${error.message}`);
      }

      logStep('Meeting status validated', data);
      
      if (data.status === 'ended') {
        throw new Error('Meeting has already ended');
      }
      
      if (data.status === 'waiting' && !data.joinBeforeHost && role !== 1) {
        throw new Error('Meeting is waiting for host to start');
      }

      return data;
    } catch (error) {
      console.error('❌ Meeting validation failed:', error);
      throw error;
    }
  }, [meetingNumber, role, logStep]);

  // Get tokens with comprehensive logging
  const getTokens = useCallback(async () => {
    try {
      logStep('Fetching Zoom tokens...', {
        meetingNumber,
        role,
        isHost: role === 1
      });

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

      logStep('Tokens retrieved successfully', {
        hasSdkKey: !!tokenData.sdkKey,
        hasSignature: !!tokenData.signature,
        signatureLength: tokenData.signature?.length
      });

      // Get ZAK token if host
      let zakToken = null;
      if (role === 1) {
        logStep('Fetching ZAK token for host...');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        if (!zakError && zakData) {
          zakToken = zakData.zak;
          logStep('ZAK token retrieved successfully', {
            hasZak: !!zakToken,
            zakLength: zakToken?.length
          });
        } else {
          console.warn('Failed to get ZAK token:', zakError);
        }
      }

      return { ...tokenData, zak: zakToken };
    } catch (error) {
      console.error('❌ Token fetch failed:', error);
      throw error;
    }
  }, [meetingNumber, role, logStep]);

  // Initialize and join meeting with detailed steps
  const initializeAndJoin = useCallback(async () => {
    if (initializationRef.current || joinAttemptRef.current || !containerRef.current || !sdkReady) {
      logStep('Skipping initialization - already in progress or not ready');
      return;
    }

    initializationRef.current = true;
    joinAttemptRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      logStep('Starting Zoom Component initialization...');

      // Step 1: Validate meeting
      const meetingStatus = await validateMeetingStatus();

      // Step 2: Get tokens
      const tokens = await getTokens();

      // Step 3: Ensure container is ready
      if (!containerRef.current) {
        throw new Error('Container element not available');
      }

      const container = containerRef.current;
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.minHeight = '500px';
      container.style.display = 'block';
      container.style.visibility = 'visible';
      
      logStep('Container prepared', {
        width: container.offsetWidth,
        height: container.offsetHeight,
        id: container.id
      });

      // Step 4: Create and initialize client
      logStep('Creating Zoom client...');
      const client = window.ZoomMtgEmbedded.createClient();
      clientRef.current = client;

      logStep('Initializing client...');
      await new Promise<void>((resolve, reject) => {
        client.init({
          zoomAppRoot: container,
          language: 'en-US',
          patchJsMedia: true,
          isSupportAV: true,
          isSupportChat: true,
          screenShare: true,
          success: () => {
            logStep('✅ Client initialized successfully');
            resolve();
          },
          error: (error: any) => {
            console.error('❌ Client initialization error:', error);
            reject(new Error(`Initialization failed: ${error.message || error.reason}`));
          }
        });
      });

      // Step 5: Join meeting
      logStep('Joining meeting...', {
        meetingNumber,
        userName: providedUserName || user?.email || 'Guest',
        role,
        hasZak: !!tokens.zak
      });

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
          setIsJoined(true);
          setIsLoading(false);
          onMeetingJoined?.();
        },
        error: (error: any) => {
          console.error('❌ Join error:', error);
          const errorMessage = error.message || error.reason || 'Failed to join meeting';
          throw new Error(errorMessage);
        }
      };

      // Add ZAK token if available
      if (role === 1 && tokens.zak) {
        joinConfig.zak = tokens.zak;
        logStep('Added ZAK token to join config');
      }

      await new Promise<void>((resolve, reject) => {
        client.join(joinConfig);
        // The success/error callbacks will handle resolution
        setTimeout(() => {
          if (!isJoined) {
            reject(new Error('Join operation timed out'));
          }
        }, 30000); // 30 second timeout
      });

    } catch (err: any) {
      console.error('❌ Initialization/Join error:', err);
      handleError(err.message || 'Failed to initialize meeting');
      
      // Reset refs for retry
      initializationRef.current = false;
      joinAttemptRef.current = false;
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
    validateMeetingStatus,
    getTokens,
    logStep,
    isJoined
  ]);

  // Handle retry
  const handleRetry = useCallback(() => {
    if (retryCount >= MAX_RETRIES) {
      handleError('Maximum retry attempts reached');
      return;
    }

    logStep(`Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
    setRetryCount(prev => prev + 1);
    setError(null);
    initializationRef.current = false;
    joinAttemptRef.current = false;
    
    setTimeout(() => {
      initializeAndJoin();
    }, 1000);
  }, [retryCount, initializeAndJoin, handleError, logStep]);

  // Leave meeting
  const handleLeaveMeeting = useCallback(async () => {
    try {
      logStep('Leaving meeting...');
      if (clientRef.current && typeof clientRef.current.leave === 'function') {
        await clientRef.current.leave();
        logStep('✅ Successfully left meeting');
      }
      setIsJoined(false);
      onMeetingLeft?.();
    } catch (error) {
      console.error('❌ Error leaving meeting:', error);
    }
  }, [onMeetingLeft, logStep]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (clientRef.current && isJoined) {
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

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (clientRef.current && isJoined) {
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
    logStep('Component mounted, loading SDK...');
    loadZoomSDK().catch(err => {
      console.error('Failed to load SDK:', err);
      handleError('Failed to load Zoom SDK');
    });
  }, [loadZoomSDK, handleError, logStep]);

  // Initialize when ready
  useEffect(() => {
    if (sdkReady && containerRef.current && meetingNumber && !initializationRef.current) {
      logStep('SDK ready, starting initialization in 500ms...');
      const timer = setTimeout(() => {
        initializeAndJoin();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [sdkReady, meetingNumber, initializeAndJoin, logStep]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      logStep('Component unmounting, cleaning up...');
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

      {/* Zoom meeting container */}
      <div 
        ref={containerRef}
        id="zoomComponentContainer"
        className="w-full h-full"
        style={{ minHeight: '500px' }}
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

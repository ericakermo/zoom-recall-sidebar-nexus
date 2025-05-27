
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
  
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const initializationRef = useRef(false);
  const joinAttemptRef = useRef(false);
  
  const { user } = useAuth();
  const { toast } = useToast();

  const MAX_RETRIES = 3;

  const handleError = useCallback((errorMessage: string) => {
    console.error('❌ Zoom Component Error:', errorMessage);
    setError(errorMessage);
    setIsLoading(false);
    onMeetingError?.(errorMessage);
  }, [onMeetingError]);

  // Load Zoom SDK
  const loadZoomSDK = useCallback(async () => {
    if (window.ZoomMtgEmbedded || sdkReady) {
      setSdkReady(true);
      return true;
    }

    try {
      console.log('🔄 Loading Zoom Component SDK...');
      
      // Make React available globally
      if (!window.React) {
        window.React = (await import('react')).default;
      }
      if (!window.ReactDOM) {
        window.ReactDOM = (await import('react-dom')).default;
      }

      // Load CSS files
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
      await new Promise<void>((resolve, reject) => {
        if (document.querySelector('script[src*="zoom-meeting-embedded"]')) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://source.zoom.us/3.13.2/zoom-meeting-embedded-3.13.2.min.js';
        script.async = false;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Zoom SDK'));
        document.head.appendChild(script);
      });

      // Wait for SDK to be available
      let attempts = 0;
      const maxAttempts = 50;
      
      while (!window.ZoomMtgEmbedded && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!window.ZoomMtgEmbedded) {
        throw new Error('Zoom SDK failed to initialize after timeout');
      }

      console.log('✅ Zoom Component SDK loaded successfully');
      setSdkReady(true);
      return true;
    } catch (error) {
      console.error('❌ Failed to load Zoom SDK:', error);
      throw error;
    }
  }, [sdkReady]);

  // Validate meeting status
  const validateMeetingStatus = useCallback(async () => {
    try {
      console.log('🔄 Validating meeting status...');
      
      const { data, error } = await supabase.functions.invoke('validate-meeting-status', {
        body: { meetingId: meetingNumber }
      });

      if (error) {
        throw new Error(`Meeting validation failed: ${error.message}`);
      }

      console.log('✅ Meeting status validated:', data);
      
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
  }, [meetingNumber, role]);

  // Initialize and join meeting
  const initializeAndJoin = useCallback(async () => {
    if (initializationRef.current || joinAttemptRef.current || !containerRef.current || !sdkReady) {
      return;
    }

    initializationRef.current = true;
    joinAttemptRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      console.log('🔄 Starting Zoom Component initialization...');

      // Validate meeting first
      await validateMeetingStatus();

      // Get tokens
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

      console.log('✅ Tokens retrieved successfully');

      // Ensure container is ready and visible
      if (!containerRef.current) {
        throw new Error('Container element not available');
      }

      // Set container properties
      const container = containerRef.current;
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.minHeight = '500px';
      container.style.display = 'block';
      container.style.visibility = 'visible';
      
      console.log('🔄 Creating Zoom client...');
      const client = window.ZoomMtgEmbedded.createClient();
      clientRef.current = client;

      // Initialize client
      await new Promise<void>((resolve, reject) => {
        console.log('🔄 Initializing client...');
        
        client.init({
          zoomAppRoot: container,
          language: 'en-US',
          patchJsMedia: true,
          isSupportAV: true,
          isSupportChat: true,
          screenShare: true,
          success: () => {
            console.log('✅ Client initialized successfully');
            resolve();
          },
          error: (error: any) => {
            console.error('❌ Client initialization error:', error);
            reject(new Error(`Initialization failed: ${error.message || error.reason}`));
          }
        });
      });

      // Get ZAK token if host
      let zakToken = null;
      if (role === 1) {
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        if (!zakError && zakData) {
          zakToken = zakData.zak;
        }
      }

      // Join meeting
      await new Promise<void>((resolve, reject) => {
        console.log('🔄 Joining meeting...');
        
        const joinConfig = {
          sdkKey: tokenData.sdkKey,
          signature: tokenData.signature,
          meetingNumber,
          userName: providedUserName || user?.email || 'Guest',
          userEmail: user?.email || '',
          passWord: meetingPassword || '',
          role: role || 0,
          success: (result: any) => {
            console.log('✅ Join success:', result);
            setIsJoined(true);
            setIsLoading(false);
            onMeetingJoined?.();
            resolve();
          },
          error: (error: any) => {
            console.error('❌ Join error:', error);
            const errorMessage = error.message || error.reason || 'Failed to join meeting';
            reject(new Error(errorMessage));
          }
        };

        if (role === 1 && zakToken) {
          joinConfig.zak = zakToken;
        }

        console.log('Join config:', {
          meetingNumber: joinConfig.meetingNumber,
          userName: joinConfig.userName,
          hasSignature: !!joinConfig.signature,
          role: joinConfig.role,
          hasZak: !!joinConfig.zak
        });

        client.join(joinConfig);
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
    validateMeetingStatus
  ]);

  // Handle retry
  const handleRetry = useCallback(() => {
    if (retryCount >= MAX_RETRIES) {
      handleError('Maximum retry attempts reached');
      return;
    }

    setRetryCount(prev => prev + 1);
    setError(null);
    initializationRef.current = false;
    joinAttemptRef.current = false;
    
    // Small delay before retry
    setTimeout(() => {
      initializeAndJoin();
    }, 1000);
  }, [retryCount, initializeAndJoin, handleError]);

  // Leave meeting
  const handleLeaveMeeting = useCallback(async () => {
    try {
      if (clientRef.current && typeof clientRef.current.leave === 'function') {
        console.log('🔄 Leaving meeting...');
        await clientRef.current.leave();
      }
      setIsJoined(false);
      onMeetingLeft?.();
    } catch (error) {
      console.error('❌ Error leaving meeting:', error);
    }
  }, [onMeetingLeft]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (clientRef.current && isJoined) {
      try {
        if (isMuted) {
          clientRef.current.unmuteAudio();
        } else {
          clientRef.current.muteAudio();
        }
        setIsMuted(!isMuted);
      } catch (error) {
        console.error('Error toggling mute:', error);
      }
    }
  }, [isMuted, isJoined]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (clientRef.current && isJoined) {
      try {
        if (isVideoOff) {
          clientRef.current.startVideo();
        } else {
          clientRef.current.stopVideo();
        }
        setIsVideoOff(!isVideoOff);
      } catch (error) {
        console.error('Error toggling video:', error);
      }
    }
  }, [isVideoOff, isJoined]);

  // Load SDK on mount
  useEffect(() => {
    loadZoomSDK().catch(err => {
      console.error('Failed to load SDK:', err);
      handleError('Failed to load Zoom SDK');
    });
  }, [loadZoomSDK, handleError]);

  // Initialize when ready
  useEffect(() => {
    if (sdkReady && containerRef.current && meetingNumber && !initializationRef.current) {
      const timer = setTimeout(() => {
        initializeAndJoin();
      }, 500); // Small delay to ensure DOM is ready

      return () => clearTimeout(timer);
    }
  }, [sdkReady, meetingNumber, initializeAndJoin]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current && typeof clientRef.current.leave === 'function') {
        try {
          clientRef.current.leave();
        } catch (error) {
          console.error('Cleanup error:', error);
        }
      }
    };
  }, []);

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
            <p className="text-lg">
              {!sdkReady ? 'Loading Zoom SDK...' : 'Joining meeting...'}
            </p>
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

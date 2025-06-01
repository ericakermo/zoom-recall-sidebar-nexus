
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ZoomLoadingOverlay } from '@/components/zoom/ZoomLoadingOverlay';
import { ZoomErrorDisplay } from '@/components/zoom/ZoomErrorDisplay';
import { supabase } from '@/integrations/supabase/client';

interface ZoomComponentViewProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingJoined?: () => void;
  onMeetingError?: (error: string) => void;
  onMeetingLeft?: () => void;
}

declare global {
  interface Window {
    ZoomMtgEmbedded: any;
  }
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
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState('Loading Zoom SDK...');
  const [retryCount, setRetryCount] = useState(0);
  const [hasAttemptedJoin, setHasAttemptedJoin] = useState(false);
  const [client, setClient] = useState<any>(null);
  const maxRetries = 2;
  
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  // Debug logging helper
  const debugLog = useCallback((message: string, data?: any) => {
    console.log(`🔍 [ZOOM-EMBEDDED] ${message}`, data || '');
  }, []);

  // Load Zoom SDK scripts dynamically
  const loadZoomSDK = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      if (window.ZoomMtgEmbedded) {
        debugLog('Zoom SDK already loaded');
        resolve();
        return;
      }

      const scripts = [
        'https://source.zoom.us/3.13.2/lib/vendor/react.min.js',
        'https://source.zoom.us/3.13.2/lib/vendor/react-dom.min.js',
        'https://source.zoom.us/3.13.2/zoom-meeting-embedded-3.13.2.min.js'
      ];

      let loadedCount = 0;
      
      scripts.forEach((src, index) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = false; // Ensure order
        
        script.onload = () => {
          loadedCount++;
          debugLog(`Loaded script ${index + 1}/${scripts.length}: ${src}`);
          
          if (loadedCount === scripts.length) {
            debugLog('All Zoom SDK scripts loaded successfully');
            resolve();
          }
        };
        
        script.onerror = () => {
          debugLog(`Failed to load script: ${src}`);
          reject(new Error(`Failed to load Zoom SDK script: ${src}`));
        };
        
        document.head.appendChild(script);
      });
    });
  }, [debugLog]);

  // Get authentication tokens
  const getTokens = useCallback(async (meetingNumber: string, role: number) => {
    try {
      debugLog('Requesting fresh tokens for meeting:', { meetingNumber, role });
      
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
        body: {
          meetingNumber,
          role: role || 0,
          expirationSeconds: 7200
        }
      });

      if (tokenError) {
        debugLog('Token request failed:', tokenError);
        throw new Error(`Token error: ${tokenError.message}`);
      }

      debugLog('Fresh tokens received');

      // Get fresh ZAK token for host role
      let zakToken = null;
      if (role === 1) {
        debugLog('Requesting fresh ZAK token for host role...');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        
        if (zakError || !zakData?.zak) {
          debugLog('ZAK token request failed:', zakError);
          throw new Error('Host role requires fresh ZAK token - please try again or check your Zoom connection');
        }
        
        zakToken = zakData.zak;
        debugLog('Fresh ZAK token received for host authentication');
      }

      return { ...tokenData, zak: zakToken };
    } catch (error) {
      debugLog('Token fetch failed:', error);
      throw error;
    }
  }, [debugLog]);

  // Initialize Zoom client
  const initializeZoomClient = useCallback(async () => {
    if (!containerRef.current || !window.ZoomMtgEmbedded) {
      throw new Error('Container or Zoom SDK not available');
    }

    debugLog('Creating Zoom embedded client...');
    
    try {
      const zoomClient = window.ZoomMtgEmbedded.createClient();
      
      await new Promise<void>((resolve, reject) => {
        const initConfig = {
          zoomAppRoot: containerRef.current,
          language: 'en-US',
          patchJsMedia: true,
          leaveOnPageUnload: true,
          success: () => {
            debugLog('Zoom client initialized successfully');
            resolve();
          },
          error: (error: any) => {
            debugLog('Zoom client initialization failed:', error);
            reject(new Error(`Zoom init failed: ${error?.errorMessage || 'Unknown error'}`));
          }
        };

        zoomClient.init(initConfig);
      });

      setClient(zoomClient);
      return zoomClient;
    } catch (error) {
      debugLog('Failed to initialize Zoom client:', error);
      throw error;
    }
  }, [debugLog]);

  // Join meeting
  const joinMeeting = useCallback(async (zoomClient: any) => {
    if (!zoomClient) {
      throw new Error('Zoom client not initialized');
    }

    try {
      setCurrentStep('Getting authentication tokens...');
      const tokens = await getTokens(meetingNumber, role || 0);

      const joinConfig = {
        sdkKey: tokens.sdkKey,
        signature: tokens.signature,
        meetingNumber: meetingNumber,
        userName: providedUserName || user?.email || 'Guest',
        userEmail: user?.email || '',
        password: meetingPassword || '',
        zak: tokens.zak || ''
      };

      debugLog('Attempting to join meeting with config:', {
        ...joinConfig,
        signature: '[REDACTED]',
        zak: joinConfig.zak ? '[PRESENT]' : '[EMPTY]'
      });

      setCurrentStep('Joining meeting...');

      await new Promise<void>((resolve, reject) => {
        zoomClient.join({
          ...joinConfig,
          success: () => {
            debugLog('Successfully joined meeting');
            setIsLoading(false);
            setCurrentStep('Connected to meeting');
            onMeetingJoined?.();
            resolve();
          },
          error: (error: any) => {
            debugLog('Failed to join meeting:', error);
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
            reject(new Error(errorMessage));
          }
        });
      });

    } catch (error: any) {
      debugLog('Join meeting process failed:', error);
      throw error;
    }
  }, [getTokens, meetingNumber, role, providedUserName, user, meetingPassword, onMeetingJoined, debugLog]);

  // Main initialization effect
  useEffect(() => {
    let isMounted = true;

    const initializeAndJoin = async () => {
      if (hasAttemptedJoin) return;

      try {
        setHasAttemptedJoin(true);
        setCurrentStep('Loading Zoom SDK...');
        
        // Load SDK
        await loadZoomSDK();
        
        if (!isMounted) return;
        
        setCurrentStep('Initializing Zoom client...');
        
        // Initialize client
        const zoomClient = await initializeZoomClient();
        
        if (!isMounted) return;
        
        // Join meeting
        await joinMeeting(zoomClient);
        
      } catch (error: any) {
        if (!isMounted) return;
        
        debugLog('Initialization failed:', error);
        setError(error.message);
        setIsLoading(false);
        setHasAttemptedJoin(false);
        onMeetingError?.(error.message);
      }
    };

    initializeAndJoin();

    return () => {
      isMounted = false;
    };
  }, [loadZoomSDK, initializeZoomClient, joinMeeting, hasAttemptedJoin, onMeetingError, debugLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (client) {
        try {
          client.leave?.();
          debugLog('Left meeting during cleanup');
        } catch (error) {
          debugLog('Error during cleanup:', error);
        }
      }
    };
  }, [client, debugLog]);

  const handleRetry = useCallback(() => {
    if (retryCount < maxRetries) {
      debugLog(`Retrying join attempt ${retryCount + 1}/${maxRetries}`);
      setRetryCount(prev => prev + 1);
      setError(null);
      setIsLoading(true);
      setHasAttemptedJoin(false);
      setCurrentStep('Retrying...');
      setClient(null);
      
      // Clear container
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }, [retryCount, maxRetries, debugLog]);

  const handleLeaveMeeting = useCallback(() => {
    if (client) {
      try {
        client.leave();
        debugLog('Left meeting');
      } catch (error) {
        debugLog('Error leaving meeting:', error);
      }
    }
    onMeetingLeft?.();
  }, [client, onMeetingLeft, debugLog]);

  if (error) {
    return (
      <ZoomErrorDisplay
        error={error}
        meetingNumber={meetingNumber}
        retryCount={retryCount}
        maxRetries={maxRetries}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <div className="zoom-embedded-wrapper">
      <ZoomLoadingOverlay
        isLoading={isLoading}
        currentStep={currentStep}
        meetingNumber={meetingNumber}
        retryCount={retryCount}
        maxRetries={maxRetries}
      />
      
      {/* Zoom embedded container */}
      <div 
        ref={containerRef}
        id="zoom-embedded-container"
        className="zoom-embedded-container"
      />
    </div>
  );
}


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
  const maxRetries = 2;
  
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const hasAttemptedJoinRef = useRef(false);
  const initializationPromiseRef = useRef<Promise<void> | null>(null);

  // Debug logging helper
  const debugLog = useCallback((message: string, data?: any) => {
    console.log(`🔍 [ZOOM-FIXED] ${message}`, data || '');
  }, []);

  // Stable token fetching function
  const getTokens = useCallback(async (meetingNumber: string, role: number) => {
    debugLog('Requesting tokens for meeting:', { meetingNumber, role });
    
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

    // Get ZAK token for host role
    let zakToken = null;
    if (role === 1) {
      const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
      
      if (zakError || !zakData?.zak) {
        throw new Error('Host role requires ZAK token - please try again');
      }
      
      zakToken = zakData.zak;
    }

    return { ...tokenData, zak: zakToken };
  }, [debugLog]);

  // Load Zoom SDK scripts only once
  const loadZoomSDK = useCallback(() => {
    if (initializationPromiseRef.current) {
      return initializationPromiseRef.current;
    }

    initializationPromiseRef.current = new Promise<void>((resolve, reject) => {
      if (window.ZoomMtgEmbedded) {
        resolve();
        return;
      }

      const scripts = [
        'https://source.zoom.us/3.13.2/lib/vendor/react.min.js',
        'https://source.zoom.us/3.13.2/lib/vendor/react-dom.min.js',
        'https://source.zoom.us/3.13.2/zoom-meeting-embedded-3.13.2.min.js'
      ];

      let loadedCount = 0;
      
      scripts.forEach((src) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        
        script.onload = () => {
          loadedCount++;
          if (loadedCount === scripts.length) {
            resolve();
          }
        };
        
        script.onerror = () => {
          reject(new Error(`Failed to load Zoom SDK script: ${src}`));
        };
        
        document.head.appendChild(script);
      });
    });

    return initializationPromiseRef.current;
  }, []);

  // Initialize and join meeting - single execution with guards
  const initializeAndJoin = useCallback(async () => {
    // Prevent multiple executions
    if (hasAttemptedJoinRef.current || !mountedRef.current) {
      debugLog('Skipping join - already attempted or not ready', { 
        attempted: hasAttemptedJoinRef.current, 
        mounted: mountedRef.current
      });
      return;
    }

    hasAttemptedJoinRef.current = true;

    try {
      // Load SDK
      setCurrentStep('Loading Zoom SDK...');
      await loadZoomSDK();
      
      if (!mountedRef.current) return;

      // Initialize client
      setCurrentStep('Initializing Zoom client...');
      if (!containerRef.current) {
        throw new Error('Container not available');
      }

      const zoomClient = window.ZoomMtgEmbedded.createClient();
      
      await new Promise<void>((resolve, reject) => {
        zoomClient.init({
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
        });
      });

      if (!mountedRef.current) return;

      clientRef.current = zoomClient;

      // Get tokens and join
      setCurrentStep('Getting authentication tokens...');
      const tokens = await getTokens(meetingNumber, role || 0);

      if (!mountedRef.current) return;

      const joinConfig = {
        sdkKey: tokens.sdkKey,
        signature: tokens.signature,
        meetingNumber: meetingNumber,
        userName: providedUserName || user?.email || 'Guest',
        userEmail: user?.email || '',
        password: meetingPassword || '',
        zak: tokens.zak || ''
      };

      debugLog('Joining meeting with config:', {
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
            if (mountedRef.current) {
              setIsLoading(false);
              setCurrentStep('Connected to meeting');
              onMeetingJoined?.();
            }
            resolve();
          },
          error: (error: any) => {
            debugLog('Failed to join meeting:', error);
            let errorMessage = error.message || 'Failed to join meeting';
            if (error?.errorCode === 200) {
              errorMessage = 'Meeting join failed - please refresh and try again';
            }
            reject(new Error(errorMessage));
          }
        });
      });

    } catch (error: any) {
      debugLog('Join process failed:', error);
      if (mountedRef.current) {
        setError(error.message);
        setIsLoading(false);
        onMeetingError?.(error.message);
      }
    }
  }, [loadZoomSDK, getTokens, meetingNumber, role, providedUserName, user, meetingPassword, onMeetingJoined, onMeetingError, debugLog]);

  // Single effect to start the process ONLY ONCE
  useEffect(() => {
    if (!hasAttemptedJoinRef.current) {
      debugLog('Starting one-time initialization and join process');
      initializeAndJoin();
    }
  }, []); // Empty dependency array - only run once on mount

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      if (clientRef.current) {
        try {
          clientRef.current.leave?.();
          debugLog('Left meeting during cleanup');
        } catch (error) {
          debugLog('Error during cleanup:', error);
        }
      }
    };
  }, [debugLog]);

  const handleRetry = useCallback(() => {
    if (retryCount < maxRetries) {
      debugLog(`Retrying join attempt ${retryCount + 1}/${maxRetries}`);
      setRetryCount(prev => prev + 1);
      setError(null);
      setIsLoading(true);
      setCurrentStep('Retrying...');
      
      // Reset attempt flag and clear container
      hasAttemptedJoinRef.current = false;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      clientRef.current = null;
      initializationPromiseRef.current = null;
    }
  }, [retryCount, maxRetries, debugLog]);

  const handleLeaveMeeting = useCallback(() => {
    if (clientRef.current) {
      try {
        clientRef.current.leave();
        debugLog('Left meeting');
      } catch (error) {
        debugLog('Error leaving meeting:', error);
      }
    }
    onMeetingLeft?.();
  }, [onMeetingLeft, debugLog]);

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
      
      <div 
        ref={containerRef}
        id="zoom-embedded-container"
        className="zoom-embedded-container"
      />
    </div>
  );
}

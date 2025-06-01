
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
  const [joinState, setJoinState] = useState<'idle' | 'loading' | 'joining' | 'joined' | 'failed'>('idle');
  const maxRetries = 2;
  
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const joinAttemptRef = useRef(false);
  const mountedRef = useRef(true);

  // Debug logging helper
  const debugLog = useCallback((message: string, data?: any) => {
    console.log(`🔍 [ZOOM-STABLE] ${message}`, data || '');
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

  // Load Zoom SDK scripts
  const loadZoomSDK = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
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
  }, []);

  // Initialize and join meeting - single stable function
  const initializeAndJoin = useCallback(async () => {
    if (!mountedRef.current || joinAttemptRef.current || joinState !== 'idle') {
      debugLog('Skipping join - conditions not met', { 
        mounted: mountedRef.current, 
        attempting: joinAttemptRef.current, 
        state: joinState 
      });
      return;
    }

    joinAttemptRef.current = true;
    setJoinState('loading');

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
      setJoinState('joining');

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
              setJoinState('joined');
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
        setJoinState('failed');
        setError(error.message);
        setIsLoading(false);
        onMeetingError?.(error.message);
      }
    } finally {
      joinAttemptRef.current = false;
    }
  }, [loadZoomSDK, getTokens, meetingNumber, role, providedUserName, user, meetingPassword, onMeetingJoined, onMeetingError, joinState, debugLog]);

  // Single effect to start the process
  useEffect(() => {
    if (joinState === 'idle') {
      debugLog('Starting initialization and join process');
      initializeAndJoin();
    }
  }, [joinState, initializeAndJoin, debugLog]);

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
      setJoinState('idle');
      setCurrentStep('Retrying...');
      
      // Clear container and client
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      clientRef.current = null;
      joinAttemptRef.current = false;
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

  if (error && joinState === 'failed') {
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

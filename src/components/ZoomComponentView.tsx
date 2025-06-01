
import { useEffect, useRef, useState, useCallback } from 'react';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

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
  meetingPassword = '',
  userName = 'Guest',
  role = 0,
  onMeetingJoined,
  onMeetingError,
  onMeetingLeft
}: ZoomComponentViewProps) {
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const [isContainerReady, setIsContainerReady] = useState(false);
  const [isSDKReady, setIsSDKReady] = useState(false);
  const [isMeetingJoined, setIsMeetingJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Debug logging helper
  const debugLog = useCallback((message: string, data?: any) => {
    console.log(`🔍 [COMPONENT-VIEW] ${message}`, data || '');
  }, []);

  // Effect to check when container ref becomes available
  useEffect(() => {
    const checkContainer = () => {
      if (zoomContainerRef.current) {
        debugLog('Container ref is now available, marking as ready');
        setIsContainerReady(true);
      } else {
        debugLog('Container ref not yet available, will retry');
        // Retry after a short delay
        setTimeout(checkContainer, 50);
      }
    };

    checkContainer();
  }, [debugLog]);

  // Effect to initialize SDK once container is ready
  useEffect(() => {
    if (!isContainerReady || isSDKReady || error) {
      debugLog('Skipping SDK init:', { isContainerReady, isSDKReady, hasError: !!error });
      return;
    }

    const container = zoomContainerRef.current;
    if (!container) {
      debugLog('Container ref lost after being ready - this should not happen');
      return;
    }

    debugLog('Initializing Zoom SDK with ready container...');

    // Create client only once
    if (!clientRef.current) {
      try {
        clientRef.current = ZoomMtgEmbedded.createClient();
        debugLog('Zoom client created successfully');
      } catch (e: any) {
        debugLog('Failed to create Zoom client:', e);
        setError(e?.message || 'Failed to create Zoom client');
        onMeetingError?.(e?.message || 'Failed to create Zoom client');
        return;
      }
    }

    // Ensure container has proper dimensions
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.minHeight = '600px';
    container.style.background = '#000';

    // Initialize the SDK
    clientRef.current.init({
      zoomAppRoot: container,
      language: 'en-US',
      patchJsMedia: true,
      leaveOnPageUnload: true,
      success: () => {
        debugLog('Zoom SDK initialized successfully');
        setIsSDKReady(true);
      },
      error: (err: any) => {
        debugLog('Zoom SDK initialization error:', err);
        setError(err?.message || 'Failed to initialize Zoom SDK');
        onMeetingError?.(err?.message || 'Failed to initialize Zoom SDK');
      }
    });

    // Cleanup function
    return () => {
      debugLog('SDK init effect cleanup...');
      setIsSDKReady(false);
    };
  }, [isContainerReady, isSDKReady, error, debugLog, onMeetingError]);

  // Effect to join meeting once SDK is ready
  useEffect(() => {
    if (!isSDKReady || isMeetingJoined || error) {
      debugLog('Skipping join effect:', { isSDKReady, isMeetingJoined, error: !!error });
      return;
    }

    debugLog('SDK is ready, attempting to join meeting...');

    const joinMeetingAsync = async () => {
      try {
        // Fetch tokens
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

        let zakToken = null;
        if (role === 1) { // Fetch ZAK for host
          debugLog('Requesting fresh ZAK token for host role...');
          const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
          if (zakError || !zakData?.zak) {
            debugLog('ZAK token request failed:', zakError);
            throw new Error('Host role requires fresh ZAK token - please try again or check your Zoom connection');
          }
          zakToken = zakData.zak;
          debugLog('Fresh ZAK token received');
        }

        const joinParams = {
          sdkKey: tokenData.sdkKey,
          signature: tokenData.signature,
          meetingNumber,
          password: meetingPassword,
          userName: userName || user?.email || 'Guest',
          userEmail: user?.email || '',
          zak: zakToken || '',
          success: () => {
            debugLog('Join meeting success');
            setIsMeetingJoined(true);
            onMeetingJoined?.();
          },
          error: (err: any) => {
            debugLog('Join meeting error:', err);
            setError(err?.message || 'Failed to join meeting');
            onMeetingError?.(err?.message || 'Failed to join meeting');
          }
        };

        debugLog('Calling client.join() with params:', { ...joinParams, signature: '[REDACTED]', zak: joinParams.zak ? '[PRESENT]' : '[EMPTY]' });
        clientRef.current.join(joinParams);

      } catch (e: any) {
        debugLog('Error during join process:', e);
        setError(e?.message || 'Failed to fetch meeting credentials or join');
        onMeetingError?.(e?.message || 'Failed to fetch meeting credentials or join');
      }
    };

    joinMeetingAsync();

    // Cleanup join effect
    return () => {
      debugLog('Join effect cleanup...');
      if (clientRef.current && isMeetingJoined) {
        try {
          clientRef.current.leave();
          debugLog('Left meeting during cleanup');
        } catch (e) {
          debugLog('Error leaving meeting during cleanup:', e);
        }
      }
      setIsMeetingJoined(false);
    };

  }, [isSDKReady, isMeetingJoined, error, meetingNumber, meetingPassword, userName, role, user, debugLog, onMeetingJoined, onMeetingError]);

  // Effect to handle component unmount
  useEffect(() => {
    return () => {
      debugLog('Component unmounting, performing final cleanup...');
      if (clientRef.current) {
        try {
          clientRef.current.destroy();
          debugLog('Zoom client destroyed on unmount');
        } catch (e) {
          debugLog('Error destroying client on unmount:', e);
        }
      }
      if (zoomContainerRef.current) {
        zoomContainerRef.current.innerHTML = '';
        debugLog('Container innerHTML cleared on unmount');
      }
    };
  }, [debugLog]);

  // Render loading/error states or the container
  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (!isContainerReady || !isSDKReady) {
    return <div className="text-gray-500">Loading Zoom SDK...</div>;
  }

  return (
    <div
      ref={zoomContainerRef}
      style={{ width: '100%', height: '100%', minHeight: '600px', background: '#000' }}
    />
  );
}


import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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

interface ComponentState {
  isContainerReady: boolean;
  isSDKReady: boolean;
  isMeetingJoined: boolean;
  isJoining: boolean;
  retryCount: number;
  isLockedOut: boolean;
  error: string | null;
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
  const sessionIdRef = useRef<string>('');
  const { user } = useAuth();

  // Initialize session ID once
  if (!sessionIdRef.current) {
    sessionIdRef.current = Date.now().toString();
  }

  // Consolidated state management
  const [state, setState] = useState<ComponentState>({
    isContainerReady: false,
    isSDKReady: false,
    isMeetingJoined: false,
    isJoining: false,
    retryCount: 0,
    isLockedOut: false,
    error: null
  });

  // Memoized props for lifecycle stability
  const stableProps = useMemo(() => ({
    meetingNumber,
    meetingPassword,
    userName: userName || user?.email || 'Guest',
    role,
    sessionId: sessionIdRef.current
  }), [meetingNumber, meetingPassword, userName, role, user?.email]);

  const debugLog = useCallback((message: string, data?: any) => {
    console.log(`🔍 [COMPONENT-VIEW] ${message}`, data || '');
  }, []);

  // Container ref guard with robust checking
  useEffect(() => {
    if (state.isContainerReady || state.isLockedOut) return;

    let checkAttempts = 0;
    const maxCheckAttempts = 20; // 1 second total
    
    const checkContainer = () => {
      checkAttempts++;
      
      if (zoomContainerRef.current && zoomContainerRef.current.offsetParent !== null) {
        debugLog('Container ref ready and visible', {
          attempts: checkAttempts,
          sessionId: sessionIdRef.current,
          dimensions: {
            width: zoomContainerRef.current.offsetWidth,
            height: zoomContainerRef.current.offsetHeight
          }
        });
        setState(prev => ({ ...prev, isContainerReady: true }));
        return;
      }

      if (checkAttempts >= maxCheckAttempts) {
        debugLog('Container ref check timeout after max attempts');
        setState(prev => ({ 
          ...prev, 
          error: 'Container initialization timeout',
          isLockedOut: true 
        }));
        onMeetingError?.('Container initialization timeout');
        return;
      }

      debugLog(`Container ref check attempt ${checkAttempts}/${maxCheckAttempts}`);
      setTimeout(checkContainer, 50);
    };

    checkContainer();
  }, [state.isContainerReady, state.isLockedOut, debugLog, onMeetingError]);

  // SDK initialization with container guard
  useEffect(() => {
    if (!state.isContainerReady || state.isSDKReady || state.error || state.isLockedOut) {
      return;
    }

    const container = zoomContainerRef.current;
    if (!container) {
      debugLog('Container lost after being ready');
      setState(prev => ({ ...prev, error: 'Container lost during initialization' }));
      return;
    }

    debugLog('Initializing Zoom SDK with guarded container', {
      sessionId: sessionIdRef.current,
      containerDimensions: { width: container.offsetWidth, height: container.offsetHeight }
    });

    // Create client only once
    if (!clientRef.current) {
      try {
        clientRef.current = ZoomMtgEmbedded.createClient();
        debugLog('Zoom client created successfully');
      } catch (e: any) {
        debugLog('Failed to create Zoom client:', e);
        setState(prev => ({ 
          ...prev, 
          error: e?.message || 'Failed to create Zoom client',
          isLockedOut: true 
        }));
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
        setState(prev => ({ ...prev, isSDKReady: true }));
      },
      error: (err: any) => {
        debugLog('Zoom SDK initialization error:', err);
        setState(prev => ({ 
          ...prev, 
          error: err?.message || 'Failed to initialize Zoom SDK',
          isLockedOut: true 
        }));
        onMeetingError?.(err?.message || 'Failed to initialize Zoom SDK');
      }
    });

    return () => {
      debugLog('SDK init effect cleanup');
      setState(prev => ({ ...prev, isSDKReady: false }));
    };
  }, [state.isContainerReady, state.isSDKReady, state.error, state.isLockedOut, debugLog, onMeetingError]);

  // Meeting join with retry hardening
  useEffect(() => {
    if (!state.isSDKReady || state.isMeetingJoined || state.isJoining || state.error || state.isLockedOut) {
      return;
    }

    if (state.retryCount >= 3) {
      debugLog('Maximum retry attempts reached - component locked out', {
        retryCount: state.retryCount,
        sessionId: sessionIdRef.current
      });
      setState(prev => ({ 
        ...prev, 
        error: 'Maximum join attempts exceeded. Please refresh the page.',
        isLockedOut: true 
      }));
      onMeetingError?.('Maximum join attempts exceeded. Please refresh the page.');
      return;
    }

    setState(prev => ({ ...prev, isJoining: true }));
    
    const joinMeetingAsync = async () => {
      try {
        debugLog('Starting join attempt', { 
          attempt: state.retryCount + 1,
          sessionId: sessionIdRef.current,
          props: stableProps 
        });

        // Fetch tokens
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
          body: {
            meetingNumber: stableProps.meetingNumber,
            role: stableProps.role || 0,
            expirationSeconds: 7200
          }
        });

        if (tokenError) {
          throw new Error(`Token error: ${tokenError.message}`);
        }

        let zakToken = null;
        if (stableProps.role === 1) {
          const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
          if (zakError || !zakData?.zak) {
            throw new Error('Host role requires ZAK token');
          }
          zakToken = zakData.zak;
        }

        const joinParams = {
          sdkKey: tokenData.sdkKey,
          signature: tokenData.signature,
          meetingNumber: stableProps.meetingNumber,
          password: stableProps.meetingPassword,
          userName: stableProps.userName,
          userEmail: user?.email || '',
          zak: zakToken || '',
          success: () => {
            debugLog('Meeting joined successfully');
            setState(prev => ({ 
              ...prev, 
              isMeetingJoined: true, 
              isJoining: false,
              error: null 
            }));
            onMeetingJoined?.();
          },
          error: (err: any) => {
            debugLog('Meeting join error:', err);
            const errorMessage = err?.message || 'Failed to join meeting';
            
            setState(prev => ({ 
              ...prev, 
              isJoining: false,
              retryCount: prev.retryCount + 1,
              error: prev.retryCount >= 2 ? `${errorMessage} (Max retries reached)` : errorMessage
            }));
            
            if (state.retryCount >= 2) {
              onMeetingError?.(errorMessage);
            }
          }
        };

        debugLog('Calling client.join with stable params', {
          meetingNumber: joinParams.meetingNumber,
          hasSignature: !!joinParams.signature,
          hasZAK: !!joinParams.zak,
          attempt: state.retryCount + 1
        });
        
        clientRef.current.join(joinParams);

      } catch (e: any) {
        debugLog('Join process error:', e);
        setState(prev => ({ 
          ...prev, 
          isJoining: false,
          retryCount: prev.retryCount + 1,
          error: e?.message || 'Failed to join meeting'
        }));
        
        if (state.retryCount >= 2) {
          onMeetingError?.(e?.message || 'Failed to join meeting');
        }
      }
    };

    joinMeetingAsync();

    return () => {
      debugLog('Join effect cleanup');
      if (clientRef.current && state.isMeetingJoined) {
        try {
          clientRef.current.leave();
        } catch (e) {
          debugLog('Error leaving meeting during cleanup:', e);
        }
      }
      setState(prev => ({ ...prev, isJoining: false, isMeetingJoined: false }));
    };
  }, [
    state.isSDKReady, 
    state.isMeetingJoined, 
    state.isJoining, 
    state.error, 
    state.isLockedOut,
    state.retryCount,
    stableProps,
    user,
    debugLog, 
    onMeetingJoined, 
    onMeetingError
  ]);

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      debugLog('Component unmounting - final cleanup', { sessionId: sessionIdRef.current });
      if (clientRef.current) {
        try {
          clientRef.current.destroy();
        } catch (e) {
          debugLog('Error destroying client:', e);
        }
      }
      if (zoomContainerRef.current) {
        zoomContainerRef.current.innerHTML = '';
      }
    };
  }, [debugLog]);

  // Render states
  if (state.isLockedOut) {
    return (
      <div className="text-red-500 p-4 text-center">
        <div className="font-semibold">Meeting Access Locked</div>
        <div className="text-sm mt-2">{state.error}</div>
        <div className="text-xs mt-2 text-gray-500">
          Please refresh the page to try again
        </div>
      </div>
    );
  }

  if (state.error && state.retryCount >= 3) {
    return (
      <div className="text-red-500 p-4 text-center">
        <div className="font-semibold">Connection Failed</div>
        <div className="text-sm mt-2">{state.error}</div>
        <div className="text-xs mt-2 text-gray-500">
          Retry attempts: {state.retryCount}/3
        </div>
      </div>
    );
  }

  if (!state.isContainerReady || !state.isSDKReady) {
    return (
      <div className="text-gray-500 p-4 text-center">
        <div>Loading Zoom SDK...</div>
        {state.retryCount > 0 && (
          <div className="text-xs mt-2">
            Retry attempt: {state.retryCount}/3
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={zoomContainerRef}
      style={{ width: '100%', height: '100%', minHeight: '600px', background: '#000' }}
    />
  );
}

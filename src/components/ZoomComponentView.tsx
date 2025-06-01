
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

interface ZoomComponentViewProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingJoined?: () => void;
  onMeetingError?: (error: string) => void;
  onMeetingLeft?: () => void;
  sdkKey?: string;
  signature?: string;
}

export function ZoomComponentView({
  meetingNumber,
  meetingPassword = '',
  userName = 'Guest',
  role = 0,
  onMeetingJoined,
  onMeetingError,
  onMeetingLeft,
}: ZoomComponentViewProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const { user } = useAuth();

  const MAX_RETRIES = 3;

  const debugLog = (message: string, data?: any) => {
    console.log(`🔍 [ZOOM-COMPONENT] ${message}`, data || '');
  };

  const handleError = (errorMessage: string) => {
    debugLog('Error occurred:', errorMessage);
    setError(errorMessage);
    onMeetingError?.(errorMessage);
  };

  const cleanup = () => {
    if (clientRef.current) {
      try {
        if (typeof clientRef.current.leave === 'function') {
          clientRef.current.leave();
        }
        if (typeof clientRef.current.destroy === 'function') {
          clientRef.current.destroy();
        }
      } catch (err) {
        debugLog('Cleanup warning (non-critical):', err);
      }
      clientRef.current = null;
    }
    
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    
    setIsInitialized(false);
    setIsJoining(false);
  };

  const getZoomCredentials = async () => {
    if (!user) {
      throw new Error('Authentication required');
    }

    try {
      debugLog('Requesting Zoom signature...');
      
      const tokenData = localStorage.getItem('sb-qsxlvwwebbakmzpwjfbb-auth-token');
      if (!tokenData) {
        throw new Error('Authentication token not found');
      }
      
      const parsedToken = JSON.parse(tokenData);
      const authToken = parsedToken?.access_token;
      
      const response = await fetch(`https://qsxlvwwebbakmzpwjfbb.supabase.co/functions/v1/generate-zoom-signature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          meetingNumber,
          role
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get Zoom credentials');
      }

      const data = await response.json();
      debugLog('Zoom credentials received:', { 
        hasAccessToken: !!data.accessToken,
        hasSdkKey: !!data.sdkKey,
        meetingNumber: data.meetingNumber
      });
      
      return data;
    } catch (error: any) {
      debugLog('Failed to get Zoom credentials:', error);
      throw new Error(`Failed to get Zoom credentials: ${error.message}`);
    }
  };

  const getZakToken = async () => {
    if (role !== 1) return null; // Only needed for host role
    
    try {
      debugLog('Requesting ZAK token for host...');
      
      const tokenData = localStorage.getItem('sb-qsxlvwwebbakmzpwjfbb-auth-token');
      if (!tokenData) {
        throw new Error('Authentication token not found');
      }
      
      const parsedToken = JSON.parse(tokenData);
      const authToken = parsedToken?.access_token;
      
      const response = await fetch(`https://qsxlvwwebbakmzpwjfbb.supabase.co/functions/v1/get-zoom-zak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get ZAK token');
      }

      const data = await response.json();
      debugLog('ZAK token received');
      return data.zak;
    } catch (error: any) {
      debugLog('Failed to get ZAK token:', error);
      throw new Error(`Failed to get ZAK token: ${error.message}`);
    }
  };

  const initializeAndJoinMeeting = async () => {
    if (isJoining || retryCount >= MAX_RETRIES || !containerRef.current) {
      debugLog('Skipping join - already joining, max retries reached, or no container');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      debugLog(`Attempt ${retryCount + 1}/${MAX_RETRIES} - Starting initialization and join...`);

      // Get credentials
      const credentials = await getZoomCredentials();
      const zakToken = await getZakToken();

      // Create client if not exists
      if (!clientRef.current) {
        debugLog('Creating Zoom client...');
        clientRef.current = ZoomMtgEmbedded.createClient();
      }

      // Ensure container is ready
      const container = containerRef.current;
      container.innerHTML = '';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.minHeight = '600px';

      debugLog('Initializing Zoom SDK...');
      
      // Initialize SDK
      await clientRef.current.init({
        zoomAppRoot: container,
        language: 'en-US',
        patchJsMedia: true,
        leaveOnPageUnload: true,
        success: () => {
          debugLog('SDK initialized successfully');
          setIsInitialized(true);
        },
        error: (error: any) => {
          throw new Error(`SDK initialization failed: ${error?.errorMessage || 'Unknown error'}`);
        }
      });

      debugLog('Joining meeting with credentials...');
      
      // Join meeting
      const joinConfig = {
        sdkKey: credentials.sdkKey,
        signature: credentials.signature || credentials.accessToken,
        meetingNumber: String(meetingNumber),
        password: meetingPassword,
        userName: userName || user?.email || 'Guest',
        userEmail: user?.email || '',
        zak: zakToken || '',
        success: (success: any) => {
          debugLog('Meeting joined successfully:', success);
          setIsJoining(false);
          onMeetingJoined?.();
        },
        error: (error: any) => {
          debugLog('Join failed:', error);
          throw new Error(`Failed to join meeting: ${error?.errorMessage || error?.message || 'Unknown join error'}`);
        }
      };

      debugLog('Calling client.join() with config:', {
        ...joinConfig,
        signature: '[REDACTED]',
        zak: joinConfig.zak ? '[PRESENT]' : '[EMPTY]'
      });

      await clientRef.current.join(joinConfig);

    } catch (error: any) {
      debugLog('Join attempt failed:', error);
      setIsJoining(false);
      setRetryCount(prev => prev + 1);
      
      if (retryCount + 1 >= MAX_RETRIES) {
        handleError(`Failed after ${MAX_RETRIES} attempts: ${error.message}`);
      } else {
        debugLog(`Will retry in 2 seconds... (${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => {
          initializeAndJoinMeeting();
        }, 2000);
      }
    }
  };

  useEffect(() => {
    if (containerRef.current && meetingNumber && !isInitialized && !isJoining) {
      debugLog('Container ready, starting meeting join process...');
      initializeAndJoinMeeting();
    }

    return cleanup;
  }, [meetingNumber, containerRef.current]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
        <div className="text-center max-w-md">
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 font-medium">Unable to Join Meeting</p>
            <p className="text-red-500 text-sm mt-1">{error}</p>
          </div>
          <button
            onClick={() => {
              setError(null);
              setRetryCount(0);
              initializeAndJoinMeeting();
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="zoom-meeting-container w-full h-full">
      {isJoining && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 z-10">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span>Joining meeting... (Attempt {retryCount + 1}/{MAX_RETRIES})</span>
            </div>
          </div>
        </div>
      )}
      
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '600px',
          background: '#000'
        }}
      />
    </div>
  );
}

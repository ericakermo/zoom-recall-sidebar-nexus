
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useZoomClient } from '@/hooks/useZoomClient';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ZoomMeetingContainerProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onJoinSuccess?: () => void;
  onError?: (error: string) => void;
}

export function ZoomMeetingContainer({
  meetingNumber,
  meetingPassword,
  userName: providedUserName,
  role = 0,
  onJoinSuccess,
  onError
}: ZoomMeetingContainerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const { user } = useAuth();

  const {
    containerRef,
    isReady,
    isJoined,
    joinMeeting,
    leaveMeeting
  } = useZoomClient({
    onReady: () => {
      console.log('Zoom client ready');
      setLoading(false);
    },
    onError: (err) => {
      setError(err);
      setLoading(false);
      onError?.(err);
    },
    onJoined: () => {
      setJoining(false);
      onJoinSuccess?.();
    }
  });

  const getAuthTokens = useCallback(async () => {
    try {
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
        body: {
          meetingNumber,
          role: role || 0,
          expirationSeconds: 7200
        }
      });

      if (tokenError) throw new Error(`Token error: ${tokenError.message}`);

      let zakToken = null;
      if (role === 1) {
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        if (zakError || !zakData?.zak) {
          throw new Error('Host role requires ZAK token');
        }
        zakToken = zakData.zak;
      }

      return { ...tokenData, zak: zakToken };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }, [meetingNumber, role]);

  const handleJoin = useCallback(async () => {
    if (!isReady || joining) return;

    setJoining(true);
    setError(null);

    try {
      const tokens = await getAuthTokens();
      
      const joinConfig = {
        sdkKey: tokens.sdkKey,
        signature: tokens.signature,
        meetingNumber: meetingNumber.replace(/\s+/g, ''),
        userName: providedUserName || user?.email || 'Guest',
        userEmail: user?.email || '',
        passWord: meetingPassword || '',
        role: role || 0,
        zak: tokens.zak || ''
      };

      await joinMeeting(joinConfig);
    } catch (error: any) {
      setError(error.message);
      setJoining(false);
      onError?.(error.message);
    }
  }, [isReady, joining, getAuthTokens, meetingNumber, providedUserName, user, meetingPassword, role, joinMeeting, onError]);

  useEffect(() => {
    if (isReady && !isJoined && !joining && !error) {
      handleJoin();
    }
  }, [isReady, isJoined, joining, error, handleJoin]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 rounded-lg p-8">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <div className="text-center max-w-md">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Join Meeting</h3>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      {(loading || joining) && (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-50">
          <div className="text-center text-white">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-lg">
              {loading ? 'Initializing Zoom...' : 'Joining meeting...'}
            </p>
          </div>
        </div>
      )}
      
      <div 
        ref={containerRef}
        id="meetingSDKElement"
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
}

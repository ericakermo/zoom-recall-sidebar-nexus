
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useZoomSDK } from '@/hooks/useZoomSDK';
import { supabase } from '@/integrations/supabase/client';

interface ZoomComponentViewProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingJoined?: (client: any) => void;
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
  const [error, setError] = useState<string | null>(null);
  const [hasJoinedSuccessfully, setHasJoinedSuccessfully] = useState(false);
  
  const { user } = useAuth();

  const {
    isReady,
    isJoined,
    joinMeeting,
    leaveMeeting,
    cleanup,
    client
  } = useZoomSDK({
    onReady: () => {
      console.log('✅ [COMPONENT-VIEW] SDK ready - proceeding to join');
    },
    onError: (error) => {
      console.error('❌ [COMPONENT-VIEW] SDK error:', error);
      setError(error);
      onMeetingError?.(error);
    }
  });

  const getTokens = useCallback(async (meetingNumber: string, role: number) => {
    try {
      console.log('🔐 [COMPONENT-VIEW] Getting authentication tokens');
      
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
        body: {
          meetingNumber,
          role: role || 0,
          expirationSeconds: 7200
        }
      });

      if (tokenError) {
        console.error('❌ [COMPONENT-VIEW] Token request failed:', tokenError);
        throw new Error(`Token error: ${tokenError.message}`);
      }

      // Get fresh ZAK token for host role
      let zakToken = null;
      if (role === 1) {
        console.log('👑 [COMPONENT-VIEW] Getting ZAK token for host');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        
        if (zakError || !zakData?.zak) {
          console.error('❌ [COMPONENT-VIEW] ZAK token request failed:', zakError);
          throw new Error('Host role requires fresh ZAK token - please try again or check your Zoom connection');
        }
        
        zakToken = zakData.zak;
      }

      console.log('✅ [COMPONENT-VIEW] Authentication tokens obtained successfully');
      return { ...tokenData, zak: zakToken };
    } catch (error) {
      console.error('❌ [COMPONENT-VIEW] Token fetch failed:', error);
      throw error;
    }
  }, []);

  const handleJoinMeeting = useCallback(async () => {
    if (!isReady || hasJoinedSuccessfully || isJoined) {
      console.log('⏸️ [COMPONENT-VIEW] Skipping join - already joined or not ready');
      return;
    }

    try {
      console.log('🎯 [COMPONENT-VIEW] Starting join process');
      const tokens = await getTokens(meetingNumber, role || 0);

      const joinConfig = {
        sdkKey: tokens.sdkKey,
        signature: tokens.signature,
        meetingNumber,
        userName: providedUserName || user?.email || 'Guest',
        userEmail: user?.email || '',
        passWord: meetingPassword || '',
        role: role || 0,
        zak: tokens.zak || ''
      };

      console.log('📝 [COMPONENT-VIEW] Join configuration prepared:', {
        meetingNumber: joinConfig.meetingNumber,
        userName: joinConfig.userName,
        role: joinConfig.role,
        hasZAK: !!joinConfig.zak,
        hasSDKKey: !!joinConfig.sdkKey,
        hasSignature: !!joinConfig.signature
      });

      console.log('🔗 [COMPONENT-VIEW] Calling joinMeeting()');
      await joinMeeting(joinConfig);
      
      setHasJoinedSuccessfully(true);
      
      console.log('✅ [COMPONENT-VIEW] Join completed successfully');
      onMeetingJoined?.(client);
    } catch (error: any) {
      console.error('❌ [COMPONENT-VIEW] Join failed:', error);
      setError(error.message);
      onMeetingError?.(error.message);
    }
  }, [isReady, hasJoinedSuccessfully, isJoined, meetingNumber, role, providedUserName, user, meetingPassword, getTokens, joinMeeting, onMeetingJoined, client]);

  // Auto-join when ready
  useEffect(() => {
    if (isReady && !hasJoinedSuccessfully && !error) {
      console.log('▶️ [COMPONENT-VIEW] SDK ready - starting auto-join');
      handleJoinMeeting();
    }
  }, [isReady, hasJoinedSuccessfully, error, handleJoinMeeting]);

  const handleLeaveMeeting = useCallback(() => {
    leaveMeeting();
    setHasJoinedSuccessfully(false);
    onMeetingLeft?.();
  }, [leaveMeeting, onMeetingLeft]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
        <div className="text-center max-w-md">
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 font-medium">Unable to Join Meeting</p>
            <p className="text-red-500 text-sm mt-1">{error}</p>
          </div>
          
          <div className="text-sm text-gray-600 mb-6">
            <p className="font-medium mb-2">Troubleshooting tips:</p>
            <ul className="list-disc list-inside text-left space-y-1">
              <li>Check your internet connection</li>
              <li>Verify the meeting ID is correct</li>
              <li>Allow camera and microphone access</li>
              <li>Try using Chrome browser</li>
              <li>Ensure meeting hasn't ended</li>
            </ul>
          </div>
          
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setError(null);
                setHasJoinedSuccessfully(false);
                cleanup();
                setTimeout(() => {
                  handleJoinMeeting();
                }, 1000);
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      {/* Minimal container exactly like Zoom's official sample */}
      <div 
        id="meetingSDKElement"
        className="w-full h-full"
      />
    </div>
  );
}

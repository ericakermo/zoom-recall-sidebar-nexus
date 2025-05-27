
import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';

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

interface UseZoomMeetingProps {
  onMeetingJoined?: () => void;
  onMeetingError?: (error: string) => void;
  onMeetingLeft?: () => void;
  logStep: (step: string, data?: any) => void;
  handleError: (errorMessage: string, details?: any) => void;
  mountedRef: React.MutableRefObject<boolean>;
}

export function useZoomMeeting({
  onMeetingJoined,
  onMeetingError,
  onMeetingLeft,
  logStep,
  handleError,
  mountedRef
}: UseZoomMeetingProps) {
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const clientRef = useRef<any>(null);
  const { user } = useAuth();

  const getTokens = useCallback(async (meetingNumber: string, role: number) => {
    try {
      logStep('Fetching Zoom tokens...', { meetingNumber, role });

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

      logStep('Tokens retrieved successfully');

      // Get ZAK token if host
      let zakToken = null;
      if (role === 1) {
        logStep('Fetching ZAK token for host...');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        if (!zakError && zakData) {
          zakToken = zakData.zak;
          logStep('ZAK token retrieved successfully');
        }
      }

      return { ...tokenData, zak: zakToken };
    } catch (error) {
      console.error('❌ Token fetch failed:', error);
      throw error;
    }
  }, [logStep]);

  const toggleMute = useCallback(() => {
    if (clientRef.current && isJoined && mountedRef.current) {
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

  const toggleVideo = useCallback(() => {
    if (clientRef.current && isJoined && mountedRef.current) {
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

  const handleLeaveMeeting = useCallback(async () => {
    try {
      logStep('Leaving meeting...');
      if (clientRef.current && typeof clientRef.current.leave === 'function') {
        await clientRef.current.leave();
        logStep('✅ Successfully left meeting');
      }
      if (mountedRef.current) {
        setIsJoined(false);
        onMeetingLeft?.();
      }
    } catch (error) {
      console.error('❌ Error leaving meeting:', error);
    }
  }, [onMeetingLeft, logStep]);

  return {
    isJoined,
    setIsJoined,
    isMuted,
    isVideoOff,
    clientRef,
    getTokens,
    toggleMute,
    toggleVideo,
    handleLeaveMeeting
  };
}

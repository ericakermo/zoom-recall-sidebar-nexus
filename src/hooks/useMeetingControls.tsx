
import { useState, useCallback } from 'react';

export function useMeetingControls(client: any) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const toggleMute = useCallback(() => {
    if (!client) return;
    
    try {
      if (isMuted) {
        client.unmuteAudio();
        setIsMuted(false);
      } else {
        client.muteAudio();
        setIsMuted(true);
      }
    } catch (err) {
      console.error("Failed to toggle audio:", err);
    }
  }, [client, isMuted]);

  const toggleVideo = useCallback(() => {
    if (!client) return;
    
    try {
      if (isVideoOff) {
        client.startVideo();
        setIsVideoOff(false);
      } else {
        client.stopVideo();
        setIsVideoOff(true);
      }
    } catch (err) {
      console.error("Failed to toggle video:", err);
    }
  }, [client, isVideoOff]);

  const leaveMeeting = useCallback(() => {
    if (!client) return;
    
    try {
      client.leave();
      console.log('Left the meeting');
    } catch (error) {
      console.error('Error leaving meeting:', error);
    }
  }, [client]);

  return {
    isMuted,
    isVideoOff,
    toggleMute,
    toggleVideo,
    leaveMeeting
  };
}

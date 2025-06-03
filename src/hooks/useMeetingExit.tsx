
import { useEffect, useCallback, useRef } from 'react';

interface UseMeetingExitProps {
  zoomClient: any;
  isJoined: boolean;
  onConfirmExit?: () => void;
  onCancelExit?: () => void;
}

export function useMeetingExit({ 
  zoomClient, 
  isJoined, 
  onConfirmExit, 
  onCancelExit 
}: UseMeetingExitProps) {
  const isLeavingRef = useRef(false);

  const leaveMeeting = useCallback(async () => {
    if (!zoomClient || !isJoined || isLeavingRef.current) {
      return;
    }

    try {
      isLeavingRef.current = true;
      console.log('🚪 [MEETING-EXIT] Leaving Zoom meeting');
      
      if (typeof zoomClient.leave === 'function') {
        await zoomClient.leave();
        console.log('✅ [MEETING-EXIT] Successfully left meeting');
      }
    } catch (error) {
      console.error('❌ [MEETING-EXIT] Error leaving meeting:', error);
    } finally {
      isLeavingRef.current = false;
    }
  }, [zoomClient, isJoined]);

  const checkMeetingStatus = useCallback(() => {
    if (!zoomClient || !isJoined) {
      return false;
    }

    try {
      if (typeof zoomClient.getCurrentMeetingInfo === 'function') {
        const meetingInfo = zoomClient.getCurrentMeetingInfo();
        return meetingInfo && meetingInfo.status === 'active';
      }
      return isJoined;
    } catch (error) {
      console.warn('⚠️ [MEETING-EXIT] Could not get meeting status:', error);
      return isJoined;
    }
  }, [zoomClient, isJoined]);

  const handleBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
    if (checkMeetingStatus()) {
      console.log('🔄 [MEETING-EXIT] Page unload detected, leaving meeting');
      leaveMeeting();
      
      // Show browser confirmation
      event.preventDefault();
      event.returnValue = 'You are currently in a Zoom meeting. Are you sure you want to leave?';
      return event.returnValue;
    }
  }, [checkMeetingStatus, leaveMeeting]);

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'hidden' && checkMeetingStatus()) {
      console.log('👁️ [MEETING-EXIT] Page hidden, leaving meeting');
      leaveMeeting();
    }
  }, [checkMeetingStatus, leaveMeeting]);

  const handlePageHide = useCallback(() => {
    if (checkMeetingStatus()) {
      console.log('📴 [MEETING-EXIT] Pagehide detected, leaving meeting');
      leaveMeeting();
    }
  }, [checkMeetingStatus, leaveMeeting]);

  // Set up event listeners
  useEffect(() => {
    if (isJoined) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('pagehide', handlePageHide);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('pagehide', handlePageHide);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [isJoined, handleBeforeUnload, handleVisibilityChange, handlePageHide]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (checkMeetingStatus()) {
        console.log('🧹 [MEETING-EXIT] Component unmounting, leaving meeting');
        leaveMeeting();
      }
    };
  }, []);

  return {
    leaveMeeting,
    checkMeetingStatus,
    isLeaving: isLeavingRef.current
  };
}

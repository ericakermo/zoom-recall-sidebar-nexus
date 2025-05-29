import { useEffect, useRef } from 'react';
import { useZoomSDK } from '@/hooks/useZoomSDK';

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
  meetingPassword,
  userName,
  role = 1,
  onMeetingJoined,
  onMeetingError,
  onMeetingLeft
}: ZoomComponentViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Your useZoomSDK hook should handle init/join/leave logic
  const { isSDKLoaded, isReady, isJoined, joinMeeting, leaveMeeting } = useZoomSDK({
    onReady: () => { /* ... */ },
    onError: (error) => { /* ... */ }
  });

  useEffect(() => {
    if (isReady && containerRef.current) {
      // joinMeeting should handle the join logic
      joinMeeting({
        meetingNumber,
        password: meetingPassword,
        userName,
        role
      });
    }
    // Cleanup on unmount
    return () => {
      leaveMeeting();
    };
  }, [isReady, meetingNumber, meetingPassword, userName, role, joinMeeting, leaveMeeting]);

  return (
    <div
      ref={containerRef}
      id="meetingSDKElement"
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        background: '#000',
        borderRadius: 8,
        overflow: 'hidden'
      }}
    />
  );
}

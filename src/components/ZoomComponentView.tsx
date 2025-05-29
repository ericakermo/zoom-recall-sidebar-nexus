
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
  role = 0, // Default to attendee
  onMeetingJoined,
  onMeetingError,
  onMeetingLeft
}: ZoomComponentViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  console.log('🎯 ZoomComponentView props:', {
    meetingNumber,
    userName,
    role,
    roleText: role === 1 ? 'Host' : 'Attendee'
  });

  // Your useZoomSDK hook should handle init/join/leave logic
  const { isSDKLoaded, isReady, isJoined, joinMeeting, leaveMeeting } = useZoomSDK({
    onReady: () => {
      console.log('✅ SDK ready in ZoomComponentView');
    },
    onError: (error) => {
      console.error('❌ SDK error in ZoomComponentView:', error);
      onMeetingError?.(error);
    }
  });

  useEffect(() => {
    if (isReady && containerRef.current && meetingNumber) {
      console.log('🚀 Starting join process with role:', role === 1 ? 'Host' : 'Attendee');
      
      // joinMeeting should handle the join logic
      joinMeeting({
        meetingNumber,
        password: meetingPassword || '',
        userName: userName || 'Guest',
        role: role
      }).then(() => {
        console.log('✅ Join successful');
        onMeetingJoined?.();
      }).catch((error) => {
        console.error('❌ Join failed:', error);
        onMeetingError?.(error.message || 'Failed to join meeting');
      });
    }
    
    // Cleanup on unmount
    return () => {
      if (isJoined) {
        console.log('🧹 Cleaning up on unmount');
        leaveMeeting();
        onMeetingLeft?.();
      }
    };
  }, [isReady, meetingNumber, meetingPassword, userName, role, joinMeeting, leaveMeeting, isJoined, onMeetingJoined, onMeetingError, onMeetingLeft]);

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-lg overflow-hidden">
      <div
        ref={containerRef}
        id="meetingSDKElement"
        className="flex-1 w-full bg-black rounded-lg"
        style={{
          minHeight: '400px'
        }}
      />
    </div>
  );
}

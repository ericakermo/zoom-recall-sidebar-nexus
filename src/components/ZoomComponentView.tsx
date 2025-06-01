
import { ZoomMeetingDebugger } from './zoom/ZoomMeetingDebugger';

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
  sdkKey,
  signature
}: ZoomComponentViewProps) {
  console.log('🔍 [COMPONENT-VIEW] Rendering with props:', {
    meetingNumber,
    userName,
    role,
    hasPassword: !!meetingPassword,
    hasSdkKey: !!sdkKey,
    hasSignature: !!signature
  });

  return (
    <div className="zoom-meeting-wrapper">
      <ZoomMeetingDebugger
        meetingNumber={meetingNumber}
        meetingPassword={meetingPassword}
        userName={userName}
        role={role}
        onMeetingJoined={onMeetingJoined}
        onMeetingError={onMeetingError}
        onMeetingLeft={onMeetingLeft}
      />
    </div>
  );
}

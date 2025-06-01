import { useEffect, useRef } from 'react';
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
  sdkKey,
  signature,
  onMeetingJoined,
  onMeetingError,
  onMeetingLeft
}: ZoomComponentViewProps) {
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!zoomContainerRef.current || !sdkKey || !signature) return;

    // Create client only once
    if (!clientRef.current) {
      clientRef.current = ZoomMtgEmbedded.createClient();
    }

    const container = zoomContainerRef.current;
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.minHeight = '600px';
    container.style.background = '#000';

    // Initialize SDK
    clientRef.current.init({
      zoomAppRoot: container,
      language: 'en-US',
      patchJsMedia: true,
      leaveOnPageUnload: true,
      success: () => {
        // Join meeting only after init success
        if (!joinedRef.current) {
          clientRef.current.join({
            sdkKey,
            signature,
            meetingNumber,
            password: meetingPassword,
            userName,
            success: () => {
              joinedRef.current = true;
              onMeetingJoined?.();
            },
            error: (err: any) => {
              onMeetingError?.(err?.message || 'Failed to join meeting');
            }
          });
        }
      },
      error: (err: any) => {
        onMeetingError?.(err?.message || 'Failed to initialize Zoom SDK');
      }
    });

    // Cleanup on unmount
    return () => {
      try {
        if (clientRef.current) {
          clientRef.current.leave();
          clientRef.current.destroy();
        }
      } catch {}
      if (container) container.innerHTML = '';
      joinedRef.current = false;
    };
  }, [sdkKey, signature, meetingNumber, meetingPassword, userName, onMeetingJoined, onMeetingError]);

  return (
    <div
      ref={zoomContainerRef}
      style={{ width: '100%', height: '100%', minHeight: '600px', background: '#000' }}
    />
  );
}

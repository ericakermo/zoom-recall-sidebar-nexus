import { lazy, Suspense } from 'react';

const ZoomComponentViewEnhanced = lazy(() => import('./ZoomComponentViewEnhanced'));

interface ZoomComponentViewProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingJoined?: (client: any) => void;
  onMeetingError?: (error: string) => void;
  onMeetingLeft?: () => void;
}

export function ZoomComponentView(props: ZoomComponentViewProps) {
  console.log('🔄 [COMPONENT-VIEW] Redirecting to enhanced version');

  return (
    <Suspense fallback={<div className="flex items-center justify-center w-full h-full">Loading...</div>}>
      <ZoomComponentViewEnhanced {...props} />
    </Suspense>
  );
}

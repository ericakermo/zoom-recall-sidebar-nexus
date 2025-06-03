
import { useEffect, useState, useCallback, useRef, Suspense, lazy } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useZoomSDK } from '@/hooks/useZoomSDK';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

// Lazy load the enhanced component
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

const LoadingFallback = () => (
  <div className="flex items-center justify-center w-full h-full">
    <div className="text-center">
      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
      <p className="text-lg">Loading Zoom SDK...</p>
    </div>
  </div>
);

export function ZoomComponentView({
  meetingNumber,
  meetingPassword,
  userName: providedUserName,
  role = 0,
  onMeetingJoined,
  onMeetingError,
  onMeetingLeft
}: ZoomComponentViewProps) {
  console.log('🔄 [COMPONENT-VIEW] Loading enhanced Zoom component');
  
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ZoomComponentViewEnhanced
        meetingNumber={meetingNumber}
        meetingPassword={meetingPassword}
        userName={providedUserName}
        role={role}
        onMeetingJoined={onMeetingJoined}
        onMeetingError={onMeetingError}
        onMeetingLeft={onMeetingLeft}
      />
    </Suspense>
  );
}

import { useEffect, useState, useCallback, useRef } from 'react';
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
  // Redirect to enhanced version
  console.log('🔄 [COMPONENT-VIEW] Redirecting to enhanced version');
  
  const ZoomComponentViewEnhanced = require('./ZoomComponentViewEnhanced').ZoomComponentViewEnhanced;
  
  return (
    <ZoomComponentViewEnhanced
      meetingNumber={meetingNumber}
      meetingPassword={meetingPassword}
      userName={providedUserName}
      role={role}
      onMeetingJoined={onMeetingJoined}
      onMeetingError={onMeetingError}
      onMeetingLeft={onMeetingLeft}
    />
  );
}

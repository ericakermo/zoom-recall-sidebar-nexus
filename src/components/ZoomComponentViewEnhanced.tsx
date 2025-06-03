import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useZoomSDKEnhanced } from '@/hooks/useZoomSDKEnhanced';
import { useZoomSession } from '@/context/ZoomSessionContext';
import { supabase } from '@/integrations/supabase/client';

interface ZoomComponentViewEnhancedProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingJoined?: (client: any) => void;
  onMeetingError?: (error: string) => void;
  onMeetingLeft?: () => void;
}

function ZoomComponentViewEnhanced({
  meetingNumber,
  meetingPassword,
  userName: providedUserName,
  role = 0,
  onMeetingJoined,
  onMeetingError,
  onMeetingLeft
}: ZoomComponentViewEnhancedProps) {
  const { user } = useAuth();
  const hasAttemptedJoinRef = useRef(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;
  const { forceLeaveSession, isSessionActive } = useZoomSession();

  console.log('✅ [ENHANCED-VIEW] Component loaded, initializing SDK...');

  const {
    isReady,
    isJoining,
    isJoined,
    joinMeeting,
    client
  } = useZoomSDKEnhanced({
    onReady: () => {
      console.log('✅ [ENHANCED-VIEW] SDK ready - proceeding to join');
    },
    onError: (error) => {
      console.error('❌ [ENHANCED-VIEW] SDK error:', error);
      onMeetingError?.(error);
    }
  });

  const getTokens = useCallback(async (meetingNumber: string, role: number, forceRefresh: boolean = false) => {
    try {
      console.log('🔐 [ENHANCED-VIEW] Getting authentication tokens', { forceRefresh });
      
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
        body: {
          meetingNumber,
          role: role || 0,
          expirationSeconds: 7200
        }
      });

      if (tokenError) {
        console.error('❌ [ENHANCED-VIEW] Token request failed:', tokenError);
        throw new Error(`Token error: ${tokenError.message}`);
      }

      let zakToken = null;
      if (role === 1) {
        console.log('👑 [ENHANCED-VIEW] Getting fresh ZAK token for host (retry:', retryCount, ')');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        
        if (zakError || !zakData?.zak) {
          console.error('❌ [ENHANCED-VIEW] ZAK token request failed:', zakError);
          throw new Error('Host role requires fresh ZAK token - please try again');
        }
        
        zakToken = zakData.zak;
        console.log('✅ [ENHANCED-VIEW] Fresh ZAK token obtained');
      }

      console.log('✅ [ENHANCED-VIEW] Authentication tokens obtained successfully');
      return { ...tokenData, zak: zakToken };
    } catch (error) {
      console.error('❌ [ENHANCED-VIEW] Token fetch failed:', error);
      throw error;
    }
  }, [retryCount]);

  const handleJoinMeeting = useCallback(async () => {
    // Check for existing sessions first
    if (isSessionActive()) {
      console.log('⚠️ [ENHANCED-VIEW] Active session detected, cleaning up first');
      await forceLeaveSession();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Prevent multiple join attempts
    if (!isReady || isJoining || isJoined || hasAttemptedJoinRef.current) {
      console.log('⏸️ [ENHANCED-VIEW] Join attempt prevented:', {
        isReady,
        isJoining,
        isJoined,
        hasAttempted: hasAttemptedJoinRef.current
      });
      return;
    }

    hasAttemptedJoinRef.current = true;

    try {
      console.log('🎯 [ENHANCED-VIEW] Starting enhanced join process (attempt', retryCount + 1, 'of', maxRetries + 1, ')');

      const tokens = await getTokens(meetingNumber, role || 0, retryCount > 0);

      const joinConfig = {
        sdkKey: tokens.sdkKey,
        signature: tokens.signature,
        meetingNumber,
        userName: providedUserName || user?.email || 'Guest',
        userEmail: user?.email || '',
        password: meetingPassword || '',
        role: role || 0,
        zak: tokens.zak || ''
      };

      console.log('🔗 [ENHANCED-VIEW] Calling enhanced joinMeeting()');
      await joinMeeting(joinConfig);
      
      console.log('✅ [ENHANCED-VIEW] Enhanced join completed successfully');
      setRetryCount(0);
      onMeetingJoined?.(client);
    } catch (error: any) {
      console.error('❌ [ENHANCED-VIEW] Enhanced join failed (attempt', retryCount + 1, '):', error);
      hasAttemptedJoinRef.current = false;
      
      // Enhanced retry logic for session conflicts
      if (error.message?.includes('Session conflict') || 
          error.message?.includes('Host join failed') || 
          error.message?.includes('ZAK token') || 
          error.message?.includes('errorCode: 200') ||
          error.message?.includes('Session already active')) {
        
        if (retryCount < maxRetries) {
          console.log('🔄 [ENHANCED-VIEW] Session conflict detected, cleaning up and retrying...');
          await forceLeaveSession();
          setRetryCount(prev => prev + 1);
          
          setTimeout(() => {
            hasAttemptedJoinRef.current = false;
            handleJoinMeeting();
          }, 3000);
          return;
        } else {
          console.error('❌ [ENHANCED-VIEW] Max retries exceeded');
          onMeetingError?.('Failed to join after multiple attempts due to session conflicts. Please refresh the page and try again.');
          return;
        }
      }
      
      onMeetingError?.(error.message);
    }
  }, [isReady, isJoining, isJoined, meetingNumber, role, providedUserName, user, meetingPassword, getTokens, joinMeeting, onMeetingJoined, client, retryCount, maxRetries, onMeetingError, isSessionActive, forceLeaveSession]);

  // Auto-join when ready
  useEffect(() => {
    if (isReady && !hasAttemptedJoinRef.current) {
      console.log('▶️ [ENHANCED-VIEW] SDK ready - starting enhanced auto-join');
      handleJoinMeeting();
    }
  }, [isReady, handleJoinMeeting]);

  // Reset attempt flag when meeting changes
  useEffect(() => {
    hasAttemptedJoinRef.current = false;
    setRetryCount(0);
  }, [meetingNumber]);

  // Enhanced container with session monitoring
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div
        id="meetingSDKElement"
        className="w-[960px] h-[540px] max-w-full max-h-full"
      />
    </div>
  );
}

// Export as default for lazy loading
export default ZoomComponentViewEnhanced;

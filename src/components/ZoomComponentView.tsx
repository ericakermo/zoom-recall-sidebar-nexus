
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
  const { user } = useAuth();
  const hasAttemptedJoinRef = useRef(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;

  const {
    isReady,
    isJoining,
    isJoined,
    joinMeeting,
    client
  } = useZoomSDK({
    onReady: () => {
      console.log('✅ [COMPONENT-VIEW] SDK ready - proceeding to join');
    },
    onError: (error) => {
      console.error('❌ [COMPONENT-VIEW] SDK error:', error);
      onMeetingError?.(error);
    }
  });

  const getTokens = useCallback(async (meetingNumber: string, role: number, forceRefresh: boolean = false) => {
    try {
      console.log('🔐 [COMPONENT-VIEW] Getting authentication tokens', { forceRefresh });
      console.log('🔍 [COMPONENT-VIEW] Token request params:', {
        meetingNumber,
        role,
        expirationSeconds: 7200
      });
      
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
        body: {
          meetingNumber,
          role: role || 0,
          expirationSeconds: 7200
        }
      });

      if (tokenError) {
        console.error('❌ [COMPONENT-VIEW] Token request failed:', tokenError);
        throw new Error(`Token error: ${tokenError.message}`);
      }

      console.log('🔍 [COMPONENT-VIEW] Token response received:', {
        hasAccessToken: !!tokenData?.accessToken,
        hasSDKKey: !!tokenData?.sdkKey,
        hasSignature: !!tokenData?.signature,
        meetingNumber: tokenData?.meetingNumber,
        role: tokenData?.role
      });

      // Get fresh ZAK token for host role - ALWAYS get fresh ZAK for host
      let zakToken = null;
      if (role === 1) {
        console.log('👑 [COMPONENT-VIEW] Getting fresh ZAK token for host (retry:', retryCount, ')');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        
        if (zakError || !zakData?.zak) {
          console.error('❌ [COMPONENT-VIEW] ZAK token request failed:', zakError);
          throw new Error('Host role requires fresh ZAK token - please try again or check your Zoom connection');
        }
        
        zakToken = zakData.zak;
        console.log('✅ [COMPONENT-VIEW] Fresh ZAK token obtained for retry', retryCount);
      }

      console.log('✅ [COMPONENT-VIEW] Authentication tokens obtained successfully');
      return { ...tokenData, zak: zakToken };
    } catch (error) {
      console.error('❌ [COMPONENT-VIEW] Token fetch failed:', error);
      throw error;
    }
  }, [retryCount]);

  const handleJoinMeeting = useCallback(async () => {
    // Prevent multiple join attempts
    if (!isReady || isJoining || isJoined || hasAttemptedJoinRef.current) {
      console.log('⏸️ [COMPONENT-VIEW] Join attempt prevented:', {
        isReady,
        isJoining,
        isJoined,
        hasAttempted: hasAttemptedJoinRef.current
      });
      return;
    }

    hasAttemptedJoinRef.current = true;

    try {
      console.log('🎯 [COMPONENT-VIEW] Starting join process (attempt', retryCount + 1, 'of', maxRetries + 1, ')');
      console.log('🔍 [COMPONENT-VIEW] Join parameters:', {
        meetingNumber,
        providedUserName,
        userEmail: user?.email,
        role,
        hasPassword: !!meetingPassword
      });

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

      console.log('📝 [COMPONENT-VIEW] Join configuration prepared (attempt', retryCount + 1, '):', {
        meetingNumber: joinConfig.meetingNumber,
        userName: joinConfig.userName,
        role: joinConfig.role,
        hasZAK: !!joinConfig.zak,
        hasSDKKey: !!joinConfig.sdkKey,
        hasSignature: !!joinConfig.signature,
        hasPassword: !!joinConfig.password
      });

      console.log('🔗 [COMPONENT-VIEW] Calling joinMeeting()');
      await joinMeeting(joinConfig);
      
      console.log('✅ [COMPONENT-VIEW] Join completed successfully');
      setRetryCount(0); // Reset retry count on success
      onMeetingJoined?.(client);
    } catch (error: any) {
      console.error('❌ [COMPONENT-VIEW] Join failed (attempt', retryCount + 1, '):', error);
      hasAttemptedJoinRef.current = false; // Reset to allow retry
      
      // Handle specific error cases with retry logic
      if (error.message?.includes('Host join failed') || error.message?.includes('ZAK token') || error.message?.includes('errorCode: 200')) {
        if (retryCount < maxRetries) {
          console.log('🔄 [COMPONENT-VIEW] Retrying with fresh ZAK token in 2 seconds...');
          setRetryCount(prev => prev + 1);
          
          // Wait 2 seconds before retry to allow any session conflicts to clear
          setTimeout(() => {
            hasAttemptedJoinRef.current = false;
            handleJoinMeeting();
          }, 2000);
          return;
        } else {
          console.error('❌ [COMPONENT-VIEW] Max retries exceeded for host join');
          onMeetingError?.('Failed to join as host after multiple attempts. The meeting may have an active host session or there may be authentication issues. Please try again later.');
          return;
        }
      }
      
      onMeetingError?.(error.message);
    }
  }, [isReady, isJoining, isJoined, meetingNumber, role, providedUserName, user, meetingPassword, getTokens, joinMeeting, onMeetingJoined, client, retryCount, maxRetries, onMeetingError]);

  // Auto-join when ready - but only once
  useEffect(() => {
    if (isReady && !hasAttemptedJoinRef.current) {
      console.log('▶️ [COMPONENT-VIEW] SDK ready - starting auto-join');
      handleJoinMeeting();
    }
  }, [isReady, handleJoinMeeting]);

  // Reset attempt flag when component unmounts or meeting changes
  useEffect(() => {
    hasAttemptedJoinRef.current = false;
    setRetryCount(0);
  }, [meetingNumber]);

  // Minimal container exactly like Zoom's official sample
  return (
    <div className="w-full h-full">
      <div 
        id="meetingSDKElement"
        className="w-full h-full"
      />
    </div>
  );
}

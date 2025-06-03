
import { useEffect, useState, useCallback } from 'react';
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

  const {
    isReady,
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

  const getTokens = useCallback(async (meetingNumber: string, role: number) => {
    try {
      console.log('🔐 [COMPONENT-VIEW] Getting authentication tokens');
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

      // Get fresh ZAK token for host role
      let zakToken = null;
      if (role === 1) {
        console.log('👑 [COMPONENT-VIEW] Getting ZAK token for host');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        
        if (zakError || !zakData?.zak) {
          console.error('❌ [COMPONENT-VIEW] ZAK token request failed:', zakError);
          throw new Error('Host role requires fresh ZAK token - please try again or check your Zoom connection');
        }
        
        zakToken = zakData.zak;
        console.log('✅ [COMPONENT-VIEW] ZAK token obtained');
      }

      console.log('✅ [COMPONENT-VIEW] Authentication tokens obtained successfully');
      return { ...tokenData, zak: zakToken };
    } catch (error) {
      console.error('❌ [COMPONENT-VIEW] Token fetch failed:', error);
      throw error;
    }
  }, []);

  const handleJoinMeeting = useCallback(async () => {
    if (!isReady) {
      console.log('⏸️ [COMPONENT-VIEW] SDK not ready yet');
      return;
    }

    try {
      console.log('🎯 [COMPONENT-VIEW] Starting join process');
      console.log('🔍 [COMPONENT-VIEW] Join parameters:', {
        meetingNumber,
        providedUserName,
        userEmail: user?.email,
        role,
        hasPassword: !!meetingPassword
      });

      const tokens = await getTokens(meetingNumber, role || 0);

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

      console.log('📝 [COMPONENT-VIEW] Join configuration prepared:', {
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
      onMeetingJoined?.(client);
    } catch (error: any) {
      console.error('❌ [COMPONENT-VIEW] Join failed:', error);
      onMeetingError?.(error.message);
    }
  }, [isReady, meetingNumber, role, providedUserName, user, meetingPassword, getTokens, joinMeeting, onMeetingJoined, client]);

  // Auto-join when ready
  useEffect(() => {
    if (isReady) {
      console.log('▶️ [COMPONENT-VIEW] SDK ready - starting auto-join');
      handleJoinMeeting();
    }
  }, [isReady, handleJoinMeeting]);

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


import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useZoomSDKEnhanced } from '@/hooks/useZoomSDKEnhanced';
import { useZoomSession } from '@/context/ZoomSessionContext';
import { useContainerReadiness } from '@/hooks/useContainerReadiness';
import { preloadZoomAssets } from '@/lib/zoom-config';
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
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const maxRetries = 2;
  const { forceLeaveSession, isSessionActive } = useZoomSession();

  console.log('🔄 [COMPONENT-VIEW] Initializing with enhanced SDK');

  // Container readiness check
  const { isReady: isContainerReady, error: containerError } = useContainerReadiness({
    containerId: 'meetingSDKElement',
    onReady: () => {
      console.log('✅ [COMPONENT-VIEW] Container is ready for SDK initialization');
    },
    onTimeout: () => {
      console.error('❌ [COMPONENT-VIEW] Container readiness timeout');
      onMeetingError?.('Meeting container failed to initialize properly');
    }
  });

  // Preload assets when component mounts
  useEffect(() => {
    const loadAssets = async () => {
      try {
        console.log('🔄 [COMPONENT-VIEW] Starting conditional asset preloading...');
        await preloadZoomAssets();
        setAssetsLoaded(true);
        console.log('✅ [COMPONENT-VIEW] Assets preloaded successfully');
      } catch (error) {
        console.error('❌ [COMPONENT-VIEW] Asset preloading failed:', error);
        onMeetingError?.(`Failed to load meeting assets: ${error.message}`);
      }
    };

    loadAssets();
  }, [onMeetingError]);

  const {
    isReady,
    isJoining,
    isJoined,
    joinMeeting,
    client
  } = useZoomSDKEnhanced({
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

      let zakToken = null;
      if (role === 1) {
        console.log('👑 [COMPONENT-VIEW] Getting fresh ZAK token for host (retry:', retryCount, ')');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        
        if (zakError || !zakData?.zak) {
          console.error('❌ [COMPONENT-VIEW] ZAK token request failed:', zakError);
          throw new Error('Host role requires fresh ZAK token - please try again');
        }
        
        zakToken = zakData.zak;
        console.log('✅ [COMPONENT-VIEW] Fresh ZAK token obtained');
      }

      console.log('✅ [COMPONENT-VIEW] Authentication tokens obtained successfully');
      return { ...tokenData, zak: zakToken };
    } catch (error) {
      console.error('❌ [COMPONENT-VIEW] Token fetch failed:', error);
      throw error;
    }
  }, [retryCount]);

  const handleJoinMeeting = useCallback(async () => {
    // Check all prerequisites
    if (!assetsLoaded) {
      console.log('⏸️ [COMPONENT-VIEW] Waiting for assets to load');
      return;
    }

    if (!isContainerReady) {
      console.log('⏸️ [COMPONENT-VIEW] Waiting for container to be ready');
      return;
    }

    if (containerError) {
      console.error('❌ [COMPONENT-VIEW] Container error:', containerError);
      onMeetingError?.(containerError);
      return;
    }

    // Check for existing sessions first
    if (isSessionActive()) {
      console.log('⚠️ [COMPONENT-VIEW] Active session detected, cleaning up first');
      await forceLeaveSession();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

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

      console.log('🔗 [COMPONENT-VIEW] Calling joinMeeting()');
      await joinMeeting(joinConfig);
      
      console.log('✅ [COMPONENT-VIEW] Join completed successfully');
      setRetryCount(0);
      onMeetingJoined?.(client);
    } catch (error: any) {
      console.error('❌ [COMPONENT-VIEW] Join failed (attempt', retryCount + 1, '):', error);
      hasAttemptedJoinRef.current = false;
      
      // Enhanced retry logic for session conflicts
      if (error.message?.includes('Session conflict') || 
          error.message?.includes('Host join failed') || 
          error.message?.includes('ZAK token') || 
          error.message?.includes('errorCode: 200') ||
          error.message?.includes('Session already active')) {
        
        if (retryCount < maxRetries) {
          console.log('🔄 [COMPONENT-VIEW] Session conflict detected, cleaning up and retrying...');
          await forceLeaveSession();
          setRetryCount(prev => prev + 1);
          
          setTimeout(() => {
            hasAttemptedJoinRef.current = false;
            handleJoinMeeting();
          }, 3000);
          return;
        } else {
          console.error('❌ [COMPONENT-VIEW] Max retries exceeded');
          onMeetingError?.('Failed to join after multiple attempts due to session conflicts. Please refresh the page and try again.');
          return;
        }
      }
      
      onMeetingError?.(error.message);
    }
  }, [assetsLoaded, isContainerReady, containerError, isReady, isJoining, isJoined, meetingNumber, role, providedUserName, user, meetingPassword, getTokens, joinMeeting, onMeetingJoined, client, retryCount, maxRetries, onMeetingError, isSessionActive, forceLeaveSession]);

  // Auto-join when all prerequisites are met
  useEffect(() => {
    if (assetsLoaded && isContainerReady && isReady && !hasAttemptedJoinRef.current && !containerError) {
      console.log('▶️ [COMPONENT-VIEW] All prerequisites met - starting auto-join');
      handleJoinMeeting();
    }
  }, [assetsLoaded, isContainerReady, isReady, handleJoinMeeting, containerError]);

  // Reset attempt flag when meeting changes
  useEffect(() => {
    hasAttemptedJoinRef.current = false;
    setRetryCount(0);
  }, [meetingNumber]);

  return (
    <div className="w-full h-full">
      <div 
        id="meetingSDKElement"
        className="w-full h-full"
        style={{ minHeight: '400px' }} // Ensure immediate dimensions
      />
    </div>
  );
}

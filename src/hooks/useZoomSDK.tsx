
import { useState, useRef, useCallback, useEffect } from 'react';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

interface UseZoomSDKProps {
  onReady?: () => void;
  onError?: (error: string) => void;
}

export function useZoomSDK({ onReady, onError }: UseZoomSDKProps = {}) {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const initializationRef = useRef(false);
  const joinAttemptRef = useRef(false);
  const isJoiningRef = useRef(false);

  const cleanup = useCallback(() => {
    console.log('🧹 Starting Zoom SDK cleanup...');
    
    if (clientRef.current) {
      try {
        if (isJoined && typeof clientRef.current.leave === 'function') {
          clientRef.current.leave();
          console.log('✅ Left meeting during cleanup');
        }
        
        if (typeof clientRef.current.destroy === 'function') {
          clientRef.current.destroy();
          console.log('✅ Destroyed Zoom client');
        }
      } catch (error) {
        console.warn('⚠️ Cleanup warning (non-critical):', error);
      }
      
      clientRef.current = null;
    }
    
    setIsSDKLoaded(false);
    setIsReady(false);
    setIsJoined(false);
    initializationRef.current = false;
    joinAttemptRef.current = false;
    isJoiningRef.current = false;
    
    console.log('✅ Zoom SDK cleanup completed');
  }, [isJoined]);

  const setSpeakerView = useCallback(async () => {
    if (!clientRef.current || !isJoined) return;

    try {
      console.log('🔄 Setting up speaker view for single participant...');
      
      // Try to get attendee list and current user info
      if (typeof clientRef.current.getAttendeeslist === 'function') {
        const attendees = await clientRef.current.getAttendeeslist();
        console.log('👥 Current attendees:', attendees?.length || 0);
        
        // If only one participant (yourself), enable speaker view
        if (attendees && attendees.length <= 1) {
          // Set gallery view to false (speaker view)
          if (typeof clientRef.current.setGalleryView === 'function') {
            await clientRef.current.setGalleryView(false);
            console.log('✅ Speaker view enabled');
          }
          
          // Try to pin own video if media stream is available
          if (typeof clientRef.current.getMediaStream === 'function') {
            const mediaStream = clientRef.current.getMediaStream();
            if (mediaStream && typeof mediaStream.pinVideo === 'function') {
              const currentUser = await clientRef.current.getCurrentUserInfo();
              if (currentUser?.userId) {
                await mediaStream.pinVideo({ userId: currentUser.userId });
                console.log('✅ Own video pinned in speaker view');
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Speaker view setup failed (non-critical):', error);
    }
  }, [isJoined]);

  const initializeSDK = useCallback(async () => {
    if (initializationRef.current || !containerRef.current) {
      console.log('⏸️ SDK initialization skipped - already initialized or container not ready');
      return false;
    }

    initializationRef.current = true;

    try {
      console.log('🔄 Creating new Zoom embedded client instance...');
      console.log('📍 Container element:', containerRef.current);
      
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      console.log('🔄 Initializing Zoom embedded client...');
      
      // Simple SDK configuration without aggressive overrides
      await clientRef.current.init({
        debug: true,
        zoomAppRoot: containerRef.current,
        language: 'en-US',
        patchJsMedia: true,
        leaveOnPageUnload: true
      });

      setIsSDKLoaded(true);
      setIsReady(true);
      onReady?.();
      console.log('✅ Zoom embedded client initialized successfully');
      return true;
    } catch (error: any) {
      console.error('❌ Failed to initialize Zoom embedded client:', error);
      initializationRef.current = false;
      onError?.(error.message || 'Failed to initialize Zoom SDK');
      return false;
    }
  }, [onReady, onError]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    if (!isReady || !clientRef.current) {
      throw new Error('Zoom SDK not ready');
    }

    if (isJoiningRef.current || joinAttemptRef.current) {
      console.log('⏸️ Join attempt already in progress, skipping duplicate');
      return;
    }

    isJoiningRef.current = true;
    joinAttemptRef.current = true;

    console.log('🔄 Joining meeting with fixed container...');
    console.log('📋 Join config details:', {
      meetingNumber: joinConfig.meetingNumber,
      userName: joinConfig.userName,
      role: joinConfig.role,
      sdkKey: joinConfig.sdkKey ? 'present' : 'missing',
      signature: joinConfig.signature ? 'present' : 'missing',
      hasPassword: !!joinConfig.passWord,
      hasZak: !!joinConfig.zak
    });

    // Validate meeting number format
    const meetingNumberStr = String(joinConfig.meetingNumber).replace(/\s+/g, '');
    if (!/^\d{10,11}$/.test(meetingNumberStr)) {
      isJoiningRef.current = false;
      joinAttemptRef.current = false;
      throw new Error(`Invalid meeting number format: ${joinConfig.meetingNumber}`);
    }
    
    try {
      const result = await clientRef.current.join({
        sdkKey: joinConfig.sdkKey,
        signature: joinConfig.signature,
        meetingNumber: meetingNumberStr,
        password: joinConfig.passWord || '',
        userName: joinConfig.userName,
        userEmail: joinConfig.userEmail || '',
        zak: joinConfig.zak || ''
      });
      
      setIsJoined(true);
      console.log('✅ Successfully joined meeting with fixed container');
      
      // Set up speaker view after a short delay to allow SDK to stabilize
      setTimeout(() => {
        setSpeakerView();
      }, 3000);
      
      return result;
    } catch (error: any) {
      console.error('❌ Failed to join meeting:', error);
      
      if (error?.errorCode) {
        console.error(`🔍 Zoom Error Code: ${error.errorCode}`);
      }
      if (error?.reason) {
        console.error(`📝 Zoom Error Reason: ${error.reason}`);
      }
      
      let errorMessage = error.message || 'Failed to join meeting';
      if (error?.errorCode === 200) {
        if (joinConfig.role === 1) {
          errorMessage = 'Host join failed - this usually means there is an active session conflict. Please refresh the page and try again, or the ZAK token may be expired.';
        } else {
          errorMessage = 'Meeting join failed - meeting may not be started or there may be a session conflict. Try refreshing the page.';
        }
      } else if (error?.errorCode === 3712) {
        errorMessage = 'Invalid signature - authentication failed, check SDK key and signature generation';
      } else if (error?.errorCode === 1) {
        errorMessage = 'Meeting not found - verify meeting ID is correct';
      } else if (error?.errorCode === 3000) {
        errorMessage = 'Meeting password required or incorrect';
      }
      
      throw new Error(errorMessage);
    } finally {
      isJoiningRef.current = false;
      joinAttemptRef.current = false;
    }
  }, [isReady, setSpeakerView]);

  const leaveMeeting = useCallback(() => {
    if (clientRef.current && isJoined) {
      console.log('🔄 Leaving meeting...');
      try {
        if (typeof clientRef.current.leave === 'function') {
          clientRef.current.leave();
          setIsJoined(false);
          console.log('✅ Left meeting successfully');
        } else {
          console.warn('⚠️ Leave function not available on Zoom client');
        }
      } catch (error) {
        console.error('❌ Error during meeting leave:', error);
      }
    }
  }, [isJoined]);

  // Monitor attendee changes and adjust view accordingly
  useEffect(() => {
    if (!clientRef.current || !isJoined) return;

    const checkAttendees = async () => {
      try {
        if (typeof clientRef.current.getAttendeeslist === 'function') {
          const attendees = await clientRef.current.getAttendeeslist();
          
          // If more than one person joins, unpin own video
          if (attendees && attendees.length > 1) {
            if (typeof clientRef.current.getMediaStream === 'function') {
              const mediaStream = clientRef.current.getMediaStream();
              if (mediaStream && typeof mediaStream.unpinVideo === 'function') {
                const currentUser = await clientRef.current.getCurrentUserInfo();
                if (currentUser?.userId) {
                  await mediaStream.unpinVideo({ userId: currentUser.userId });
                  console.log('✅ Unpinned own video - others have joined');
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Attendee check failed (non-critical):', error);
      }
    };

    // Check attendees periodically
    const interval = setInterval(checkAttendees, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [isJoined]);

  // Single effect to handle container mounting and initialization
  useEffect(() => {
    console.log('🔍 Container check - current:', !!containerRef.current, 'initialized:', initializationRef.current);
    
    if (containerRef.current && !initializationRef.current) {
      console.log('🎯 Container is ready, initializing SDK...');
      initializeSDK();
    }
  }, [initializeSDK]);

  // Cleanup on unmount and page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log('🔄 Page unload detected, cleaning up Zoom session...');
      cleanup();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('🔄 Page hidden, leaving meeting...');
        if (clientRef.current && isJoined) {
          leaveMeeting();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cleanup();
    };
  }, [isJoined, leaveMeeting, cleanup]);

  return {
    containerRef,
    isSDKLoaded,
    isReady,
    isJoined,
    joinMeeting,
    leaveMeeting,
    cleanup
  };
}


import { useState, useRef, useCallback, useEffect } from 'react';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

interface UseZoomSDKProps {
  onReady?: () => void;
  onError?: (error: string) => void;
}

export function useZoomSDK({ onReady, onError }: UseZoomSDKProps = {}) {
  const [isReady, setIsReady] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);

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
    
    setIsReady(false);
    setIsJoined(false);
    
    console.log('✅ Zoom SDK cleanup completed');
  }, [isJoined]);

  const initializeSDK = useCallback(async () => {
    const meetingSDKElement = document.getElementById('meetingSDKElement');
    if (!meetingSDKElement) {
      console.log('⏸️ SDK initialization waiting for meetingSDKElement');
      return;
    }

    if (clientRef.current) {
      console.log('⏸️ SDK already initialized');
      return;
    }

    try {
      console.log('🔄 Creating Zoom embedded client...');
      
      // Create client - exactly like Zoom's official sample
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      console.log('🔄 Initializing Zoom SDK with CDN assets...');

      // Use Zoom's official CDN for assets - this is the recommended approach
      const assetPath = 'https://source.zoom.us/3.13.2/lib';

      console.log('📁 Asset path configured:', assetPath);

      // Initialize with CDN configuration - matching Zoom's official sample
      await clientRef.current.init({
        debug: true,
        zoomAppRoot: meetingSDKElement,
        assetPath: assetPath,
        language: 'en-US'
      });

      setIsReady(true);
      onReady?.();
      console.log('✅ Zoom SDK initialized successfully with CDN assets');
    } catch (error: any) {
      console.error('❌ Failed to initialize Zoom embedded client:', error);
      console.error('🔍 Asset path was:', 'https://source.zoom.us/3.13.2/lib');
      clientRef.current = null;
      onError?.(error.message || 'Failed to initialize Zoom SDK');
    }
  }, [onReady, onError]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    if (!isReady || !clientRef.current) {
      throw new Error('Zoom SDK not ready');
    }

    console.log('🔄 Joining meeting...');
    console.log('📋 Join config details:', {
      meetingNumber: joinConfig.meetingNumber,
      userName: joinConfig.userName,
      role: joinConfig.role,
      sdkKey: joinConfig.sdkKey ? 'present' : 'missing',
      signature: joinConfig.signature ? 'present' : 'missing',
      hasPassword: !!joinConfig.passWord,
      hasZak: !!joinConfig.zak
    });

    const meetingNumberStr = String(joinConfig.meetingNumber).replace(/\s+/g, '');
    if (!/^\d{10,11}$/.test(meetingNumberStr)) {
      throw new Error(`Invalid meeting number format: ${joinConfig.meetingNumber}`);
    }
    
    try {
      // Join with configuration matching Zoom's official sample
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
      console.log('✅ Successfully joined meeting');
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
    }
  }, [isReady]);

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

  // Initialize when DOM is ready
  useEffect(() => {
    const initWhenReady = () => {
      const meetingSDKElement = document.getElementById('meetingSDKElement');
      if (meetingSDKElement) {
        initializeSDK();
      } else {
        setTimeout(initWhenReady, 50);
      }
    };
    
    initWhenReady();
  }, [initializeSDK]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    containerRef,
    isReady,
    isJoined,
    joinMeeting,
    leaveMeeting,
    cleanup,
    client: clientRef.current
  };
}

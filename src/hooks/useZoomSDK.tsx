
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

  const validateContainer = useCallback(() => {
    const meetingSDKElement = document.getElementById('meetingSDKElement');
    if (!meetingSDKElement) {
      console.error('🚨 [DEBUG] meetingSDKElement not found in DOM');
      return false;
    }

    const computedStyle = window.getComputedStyle(meetingSDKElement);
    console.log('🔍 [DEBUG] Container validation:', {
      element: meetingSDKElement,
      display: computedStyle.display,
      visibility: computedStyle.visibility,
      opacity: computedStyle.opacity,
      zIndex: computedStyle.zIndex,
      width: computedStyle.width,
      height: computedStyle.height,
      position: computedStyle.position,
      overflow: computedStyle.overflow,
      rect: meetingSDKElement.getBoundingClientRect()
    });

    if (computedStyle.display === 'none') {
      console.error('🚨 [DEBUG] Container has display: none');
      return false;
    }

    if (computedStyle.visibility === 'hidden') {
      console.error('🚨 [DEBUG] Container has visibility: hidden');
      return false;
    }

    const rect = meetingSDKElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.error('🚨 [DEBUG] Container has zero dimensions:', rect);
      return false;
    }

    console.log('✅ [DEBUG] Container validation passed');
    return true;
  }, []);

  const cleanup = useCallback(() => {
    console.log('🧹 [DEBUG] Starting Zoom SDK cleanup...');
    
    if (clientRef.current) {
      try {
        if (isJoined && typeof clientRef.current.leave === 'function') {
          console.log('🔄 [DEBUG] Calling client.leave()...');
          clientRef.current.leave();
          console.log('✅ [DEBUG] Left meeting during cleanup');
        }
        
        if (typeof clientRef.current.destroy === 'function') {
          console.log('🔄 [DEBUG] Calling client.destroy()...');
          clientRef.current.destroy();
          console.log('✅ [DEBUG] Destroyed Zoom client');
        }
      } catch (error) {
        console.warn('⚠️ [DEBUG] Cleanup warning (non-critical):', error);
      }
      
      clientRef.current = null;
    }
    
    setIsReady(false);
    setIsJoined(false);
    
    console.log('✅ [DEBUG] Zoom SDK cleanup completed');
  }, [isJoined]);

  const initializeSDK = useCallback(async () => {
    console.log('🔄 [DEBUG] Starting SDK initialization...');
    
    const meetingSDKElement = document.getElementById('meetingSDKElement');
    if (!meetingSDKElement) {
      console.error('🚨 [DEBUG] meetingSDKElement not found - waiting...');
      return;
    }

    // Validate container before proceeding
    if (!validateContainer()) {
      console.error('🚨 [DEBUG] Container validation failed');
      return;
    }

    if (clientRef.current) {
      console.log('⏸️ [DEBUG] SDK already initialized');
      return;
    }

    try {
      console.log('🔄 [DEBUG] Creating Zoom embedded client...');
      
      // Create client - exactly like Zoom's official sample
      clientRef.current = ZoomMtgEmbedded.createClient();
      console.log('✅ [DEBUG] Zoom client created:', clientRef.current);
      
      console.log('🔄 [DEBUG] Initializing Zoom SDK with CDN assets...');

      // CRITICAL: Use Zoom's official CDN for assets - this prevents 404 errors
      const assetPath = 'https://source.zoom.us/3.13.2/lib';
      console.log('📁 [DEBUG] Asset path configured:', assetPath);
      console.log('🔍 [DEBUG] This should prevent local path 404 errors like /lib/js_media.min.js');

      const initConfig = {
        debug: true,
        zoomAppRoot: meetingSDKElement,
        assetPath: assetPath,
        language: 'en-US'
      };

      console.log('🔍 [DEBUG] Full init config:', initConfig);
      console.log('🔄 [DEBUG] Calling client.init() with CDN assets...');

      // Initialize with CDN configuration - matching Zoom's official sample
      const initResult = await clientRef.current.init(initConfig);
      
      console.log('✅ [DEBUG] client.init() completed successfully:', initResult);
      console.log('🔍 [DEBUG] SDK should now be ready for joining');

      // Validate container again after init
      validateContainer();

      setIsReady(true);
      onReady?.();
      console.log('✅ [DEBUG] Zoom SDK initialization complete - ready for join');
    } catch (error: any) {
      console.error('❌ [DEBUG] client.init() failed:', error);
      console.error('🔍 [DEBUG] Init error details:', {
        message: error.message,
        stack: error.stack,
        assetPath: 'https://source.zoom.us/3.13.2/lib'
      });
      clientRef.current = null;
      onError?.(error.message || 'Failed to initialize Zoom SDK');
    }
  }, [onReady, onError, validateContainer]);

  const joinMeeting = useCallback(async (joinConfig: any) => {
    console.log('🔄 [DEBUG] joinMeeting() called');
    
    if (!isReady || !clientRef.current) {
      console.error('🚨 [DEBUG] Cannot join - SDK not ready or client missing');
      throw new Error('Zoom SDK not ready');
    }

    // Validate container before joining
    if (!validateContainer()) {
      console.error('🚨 [DEBUG] Container validation failed before join');
      throw new Error('Meeting container not properly mounted');
    }

    console.log('🔄 [DEBUG] Preparing to join meeting...');
    console.log('🔍 [DEBUG] Full meetingConfig object:', {
      sdkKey: joinConfig.sdkKey ? 'present' : 'missing',
      signature: joinConfig.signature ? 'present' : 'missing',
      meetingNumber: joinConfig.meetingNumber,
      userName: joinConfig.userName,
      userEmail: joinConfig.userEmail,
      password: joinConfig.password ? 'present' : 'none',
      role: joinConfig.role,
      zak: joinConfig.zak ? 'present' : 'none'
    });

    const meetingNumberStr = String(joinConfig.meetingNumber).replace(/\s+/g, '');
    if (!/^\d{10,11}$/.test(meetingNumberStr)) {
      console.error('🚨 [DEBUG] Invalid meeting number format:', joinConfig.meetingNumber);
      throw new Error(`Invalid meeting number format: ${joinConfig.meetingNumber}`);
    }
    
    try {
      console.log('🔄 [DEBUG] Calling client.join()...');
      
      // Join with configuration matching Zoom's official sample
      const joinResult = await clientRef.current.join({
        sdkKey: joinConfig.sdkKey,
        signature: joinConfig.signature,
        meetingNumber: meetingNumberStr,
        password: joinConfig.password || '',
        userName: joinConfig.userName,
        userEmail: joinConfig.userEmail || '',
        zak: joinConfig.zak || ''
      });
      
      console.log('✅ [DEBUG] client.join() completed successfully:', joinResult);
      
      // Final container validation after join
      setTimeout(() => {
        validateContainer();
        console.log('🔍 [DEBUG] Post-join container state validated');
      }, 1000);
      
      setIsJoined(true);
      console.log('✅ [DEBUG] Meeting join process complete');
      return joinResult;
    } catch (error: any) {
      console.error('❌ [DEBUG] client.join() failed:', error);
      console.error('🔍 [DEBUG] Join error details:', {
        message: error.message,
        errorCode: error?.errorCode,
        reason: error?.reason,
        type: error?.type,
        stack: error.stack
      });
      
      if (error?.errorCode) {
        console.error(`🔍 [DEBUG] Zoom Error Code: ${error.errorCode}`);
      }
      if (error?.reason) {
        console.error(`🔍 [DEBUG] Zoom Error Reason: ${error.reason}`);
      }
      if (error?.type) {
        console.error(`🔍 [DEBUG] Zoom Error Type: ${error.type}`);
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
  }, [isReady, validateContainer]);

  const leaveMeeting = useCallback(() => {
    if (clientRef.current && isJoined) {
      console.log('🔄 [DEBUG] Leaving meeting...');
      try {
        if (typeof clientRef.current.leave === 'function') {
          clientRef.current.leave();
          setIsJoined(false);
          console.log('✅ [DEBUG] Left meeting successfully');
        } else {
          console.warn('⚠️ [DEBUG] Leave function not available on Zoom client');
        }
      } catch (error) {
        console.error('❌ [DEBUG] Error during meeting leave:', error);
      }
    }
  }, [isJoined]);

  // Initialize when DOM is ready
  useEffect(() => {
    const initWhenReady = () => {
      const meetingSDKElement = document.getElementById('meetingSDKElement');
      if (meetingSDKElement) {
        console.log('🔍 [DEBUG] meetingSDKElement found, starting initialization');
        initializeSDK();
      } else {
        console.log('⏳ [DEBUG] Waiting for meetingSDKElement...');
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

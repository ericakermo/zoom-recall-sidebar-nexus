
import { ZoomMeetingConfig } from '@/types/zoom';

// Use the client ID directly
const ZOOM_API_KEY = "eFAZ8Vf7RbG5saQVqL1zGA";
const SUPABASE_URL = 'https://qsxlvwwebbakmzpwjfbb.supabase.co';

export const loadZoomSDK = async () => {
  try {
    console.log('Beginning Zoom SDK loading process');
    
    // First make sure React is loaded
    if (!window.React) {
      console.log('Loading React...');
      await new Promise<void>((resolve, reject) => {
        const reactScript = document.createElement('script');
        reactScript.src = 'https://source.zoom.us/2.18.0/lib/vendor/react.min.js';
        reactScript.async = true;
        reactScript.onload = () => {
          console.log('React loaded successfully');
          resolve();
        };
        reactScript.onerror = (e) => {
          console.error('Failed to load React', e);
          reject(new Error('Failed to load React'));
        };
        document.head.appendChild(reactScript);
      });
    } else {
      console.log('React already loaded');
    }
    
    // Then make sure ReactDOM is loaded
    if (!window.ReactDOM) {
      console.log('Loading ReactDOM...');
      await new Promise<void>((resolve, reject) => {
        const reactDOMScript = document.createElement('script');
        reactDOMScript.src = 'https://source.zoom.us/2.18.0/lib/vendor/react-dom.min.js';
        reactDOMScript.async = true;
        reactDOMScript.onload = () => {
          console.log('ReactDOM loaded successfully');
          resolve();
        };
        reactDOMScript.onerror = (e) => {
          console.error('Failed to load ReactDOM', e);
          reject(new Error('Failed to load ReactDOM'));
        };
        document.head.appendChild(reactDOMScript);
      });
    } else {
      console.log('ReactDOM already loaded');
    }
    
    // Finally load Zoom SDK
    console.log('Loading Zoom SDK...');
    return new Promise<boolean>((resolve, reject) => {
      const zoomScript = document.createElement('script');
      zoomScript.src = 'https://source.zoom.us/2.18.0/zoom-meeting-embedded-2.18.0.min.js';
      zoomScript.async = true;
      zoomScript.onload = () => {
        console.log('Zoom SDK loaded successfully');
        resolve(true);
      };
      zoomScript.onerror = (e) => {
        console.error('Failed to load Zoom SDK', e);
        reject(new Error('Failed to load Zoom SDK'));
      };
      document.head.appendChild(zoomScript);
    });
  } catch (error) {
    console.error('Error in loadZoomSDK:', error);
    throw error;
  }
};

export const getSignature = async (meetingNumber: string, role: number) => {
  try {
    // Get the token from localStorage
    const token = localStorage.getItem('sb-qsxlvwwebbakmzpwjfbb-auth-token');
    
    if (!token) {
      throw new Error('No authentication token found');
    }
    
    // Parse the token to get the actual JWT
    const parsedToken = JSON.parse(token);
    const authToken = parsedToken?.access_token;
    
    if (!authToken) {
      throw new Error('Invalid authentication token');
    }
    
    console.log('Requesting signature for meeting:', meetingNumber, 'with role:', role);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-zoom-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        meetingNumber,
        role,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Signature API error:', response.status, errorText);
      throw new Error(`Failed to generate signature: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Signature generated successfully');
    return data.signature;
  } catch (error) {
    console.error('Error getting signature:', error);
    throw error;
  }
};

export const initializeZoomMeeting = async (config: ZoomMeetingConfig) => {
  if (!window.ZoomMtg) {
    throw new Error('Zoom Meeting SDK not loaded');
  }

  console.log('Initializing Zoom meeting with config:', {
    ...config,
    signature: '[REDACTED]' // Don't log the signature
  });

  window.ZoomMtg.setZoomJSLib('https://source.zoom.us/2.18.0/lib', '/av');
  window.ZoomMtg.preLoadWasm();
  window.ZoomMtg.prepareWebSDK();

  await window.ZoomMtg.init({
    leaveUrl: window.location.origin + '/meetings',
    disableCORP: true,
    success: () => {
      console.log('Zoom Meeting SDK initialized');
    },
    error: (error: any) => {
      console.error('Error initializing Zoom Meeting SDK:', error);
    }
  });

  return window.ZoomMtg;
};

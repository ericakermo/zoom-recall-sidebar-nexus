
import { ZoomMeetingConfig } from '@/types/zoom';

// Use the client ID directly
const ZOOM_API_KEY = "eFAZ8Vf7RbG5saQVqL1zGA";
const SUPABASE_URL = 'https://qsxlvwwebbakmzpwjfbb.supabase.co';

export const loadZoomSDK = async () => {
  try {
    console.log('Beginning Zoom SDK loading process');
    
    // First ensure React and ReactDOM are properly loaded in sequence
    // Step 1: Load React
    await new Promise<void>((resolve, reject) => {
      if (window.React) {
        console.log('React already loaded');
        resolve();
        return;
      }
      
      console.log('Loading React...');
      const reactScript = document.createElement('script');
      reactScript.src = 'https://source.zoom.us/2.18.0/lib/vendor/react.min.js';
      reactScript.async = false; // Important: Load in sequence, not async
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
    
    // Step 2: Load ReactDOM only after React is loaded
    await new Promise<void>((resolve, reject) => {
      if (window.ReactDOM) {
        console.log('ReactDOM already loaded');
        resolve();
        return;
      }
      
      console.log('Loading ReactDOM...');
      const reactDOMScript = document.createElement('script');
      reactDOMScript.src = 'https://source.zoom.us/2.18.0/lib/vendor/react-dom.min.js';
      reactDOMScript.async = false; // Important: Load in sequence, not async
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
    
    // Step 3: Only load Zoom SDK after React and ReactDOM are confirmed loaded
    if (!window.React || !window.ReactDOM) {
      throw new Error('React or ReactDOM failed to load properly');
    }
    
    console.log('Loading Zoom SDK...');
    return new Promise<boolean>((resolve, reject) => {
      const zoomScript = document.createElement('script');
      zoomScript.src = 'https://source.zoom.us/2.18.0/zoom-meeting-embedded-2.18.0.min.js';
      zoomScript.async = false; // Important: Load in sequence, not async
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

  return new Promise<any>((resolve, reject) => {
    window.ZoomMtg.init({
      leaveUrl: window.location.origin + '/meetings',
      disableCORP: true, 
      success: () => {
        console.log('Zoom Meeting SDK initialized successfully');
        resolve(window.ZoomMtg);
      },
      error: (error: any) => {
        console.error('Error initializing Zoom Meeting SDK:', error);
        reject(error);
      }
    });
  });
};

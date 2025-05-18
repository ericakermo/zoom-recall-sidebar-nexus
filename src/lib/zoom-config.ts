
import { ZoomMeetingConfig } from '@/types/zoom';

// Use the client ID directly
const ZOOM_API_KEY = "eFAZ8Vf7RbG5saQVqL1zGA";
const SUPABASE_URL = 'https://qsxlvwwebbakmzpwjfbb.supabase.co';

export const loadZoomSDK = async () => {
  // Create a promise to track when React and ReactDOM are loaded
  const reactPromise = new Promise<boolean>((resolve) => {
    // First load React
    const reactScript = document.createElement('script');
    reactScript.src = 'https://source.zoom.us/2.18.0/lib/vendor/react.min.js';
    reactScript.onload = () => {
      console.log('React loaded successfully');
      
      // Then load ReactDOM after React is loaded
      const reactDomScript = document.createElement('script');
      reactDomScript.src = 'https://source.zoom.us/2.18.0/lib/vendor/react-dom.min.js'; 
      reactDomScript.onload = () => {
        console.log('ReactDOM loaded successfully');
        resolve(true);
      };
      document.head.appendChild(reactDomScript);
    };
    document.head.appendChild(reactScript);
  });

  // Wait for React and ReactDOM to load before loading Zoom
  await reactPromise;
  
  // Now load the Zoom SDK
  return new Promise<boolean>((resolve) => {
    const zoomScript = document.createElement('script');
    zoomScript.src = 'https://source.zoom.us/2.18.0/zoom-meeting-embedded-2.18.0.min.js';
    zoomScript.onload = () => {
      console.log('Zoom SDK loaded successfully');
      resolve(true);
    };
    document.head.appendChild(zoomScript);
  });
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

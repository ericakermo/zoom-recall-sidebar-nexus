
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
    
    // Use polling to check for ZoomMtg availability
    return new Promise<boolean>((resolve, reject) => {
      // Track if we've already loaded the script to prevent duplicate loading
      const isScriptLoaded = Array.from(document.getElementsByTagName('script')).some(
        script => script.src.includes('zoom-meeting-embedded-2.18.0.min.js')
      );
      
      if (!isScriptLoaded) {
        const zoomScript = document.createElement('script');
        zoomScript.src = 'https://source.zoom.us/2.18.0/zoom-meeting-embedded-2.18.0.min.js';
        zoomScript.async = false; // Important: Load in sequence, not async
        document.head.appendChild(zoomScript);
      }
      
      // Set up polling mechanism to check for ZoomMtg availability
      const maxAttempts = 20; // Maximum number of polling attempts
      let attempts = 0;
      const pollInterval = 300; // Poll every 300ms
      
      // Function to check if ZoomMtg is available
      const checkZoomMtgAvailability = () => {
        attempts++;
        
        if (window.ZoomMtg) {
          console.log(`ZoomMtg object detected after ${attempts} attempts`);
          resolve(true);
          return;
        }
        
        if (attempts >= maxAttempts) {
          console.error(`ZoomMtg not available after ${attempts} attempts`);
          reject(new Error('Timed out waiting for ZoomMtg to initialize'));
          return;
        }
        
        // Continue polling
        setTimeout(checkZoomMtgAvailability, pollInterval);
      };
      
      // Start checking
      setTimeout(checkZoomMtgAvailability, pollInterval);
      
      // Add initial script load success/failure detection
      if (!isScriptLoaded) {
        const zoomScript = document.querySelector('script[src*="zoom-meeting-embedded-2.18.0.min.js"]');
        if (zoomScript) {
          zoomScript.addEventListener('load', () => {
            console.log('Zoom SDK script loaded, now waiting for initialization...');
          });
          
          zoomScript.addEventListener('error', (e) => {
            console.error('Failed to load Zoom SDK script', e);
            reject(new Error('Failed to load Zoom SDK script'));
          });
        }
      }
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
  // Enhanced check for ZoomMtg object
  if (!window.ZoomMtg) {
    console.error('ZoomMtg object not available. Current window keys:', Object.keys(window));
    throw new Error('Zoom Meeting SDK not loaded');
  }

  console.log('Initializing Zoom meeting with config:', {
    ...config,
    signature: '[REDACTED]' // Don't log the signature
  });

  // Ensure we're setting up the SDK properly
  window.ZoomMtg.setZoomJSLib('https://source.zoom.us/2.18.0/lib', '/av');
  window.ZoomMtg.preLoadWasm();
  window.ZoomMtg.prepareWebSDK();

  return new Promise<any>((resolve, reject) => {
    try {
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
    } catch (error) {
      console.error('Exception during ZoomMtg.init():', error);
      reject(error);
    }
  });
};

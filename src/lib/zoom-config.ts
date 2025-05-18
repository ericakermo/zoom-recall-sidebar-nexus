
import { ZoomMeetingConfig } from '@/types/zoom';

// Now use environment variables or Supabase edge functions
const ZOOM_API_KEY = import.meta.env.VITE_ZOOM_API_KEY || '';
const SUPABASE_URL = 'https://qsxlvwwebbakmzpwjfbb.supabase.co';

export const loadZoomSDK = async () => {
  const script = document.createElement('script');
  script.src = 'https://source.zoom.us/2.18.0/lib/vendor/react.min.js';
  document.head.appendChild(script);

  const zoomScript = document.createElement('script');
  zoomScript.src = 'https://source.zoom.us/2.18.0/zoom-meeting-embedded-2.18.0.min.js';
  document.head.appendChild(zoomScript);

  return new Promise((resolve) => {
    zoomScript.onload = () => resolve(true);
  });
};

export const getSignature = async (meetingNumber: string, role: number) => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-zoom-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
      },
      body: JSON.stringify({
        meetingNumber,
        role,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate signature');
    }
    
    const data = await response.json();
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

  window.ZoomMtg.setZoomJSLib('https://source.zoom.us/2.18.0/lib', '/av');
  window.ZoomMtg.preLoadWasm();
  window.ZoomMtg.prepareWebSDK();

  await window.ZoomMtg.init({
    leaveUrl: window.location.origin,
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

import { ZoomMeetingConfig } from '@/types/zoom';

// These should be environment variables in production
const ZOOM_API_KEY = 'YOUR_ZOOM_API_KEY';
const ZOOM_API_SECRET = 'YOUR_ZOOM_API_SECRET';

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
  // In production, this should be a server endpoint
  // NEVER expose your API secret in the frontend
  try {
    const response = await fetch('YOUR_BACKEND_ENDPOINT/zoom-signature', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meetingNumber,
        role,
      }),
    });
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
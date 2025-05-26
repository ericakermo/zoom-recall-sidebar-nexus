
// Zoom Meeting SDK Component View Configuration
const ZOOM_SDK_KEY = "dkQMavedS2OWM2c73F6pLg";

export interface ZoomComponentConfig {
  sdkKey: string;
  signature: string;
  meetingNumber: string;
  userName: string;
  userEmail?: string;
  password?: string;
  role?: number;
  zak?: string;
}

export const loadZoomComponentSDK = async (): Promise<boolean> => {
  if (window.ZoomMtgEmbedded) {
    return true;
  }

  try {
    // Load CSS files
    const cssFiles = [
      'https://source.zoom.us/3.13.2/css/bootstrap.css',
      'https://source.zoom.us/3.13.2/css/react-select.css'
    ];

    await Promise.all(cssFiles.map(url => {
      return new Promise<void>((resolve) => {
        if (document.querySelector(`link[href="${url}"]`)) {
          resolve();
          return;
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.onload = () => resolve();
        link.onerror = () => resolve();
        document.head.appendChild(link);
      });
    }));

    // Make React available globally
    if (!window.React) {
      window.React = (await import('react')).default;
    }
    if (!window.ReactDOM) {
      window.ReactDOM = (await import('react-dom')).default;
    }

    // Load SDK script
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://source.zoom.us/3.13.2/zoom-meeting-embedded-3.13.2.min.js';
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Zoom SDK'));
      document.head.appendChild(script);
    });

    // Wait for SDK to be available
    let attempts = 0;
    while (!window.ZoomMtgEmbedded && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!window.ZoomMtgEmbedded) {
      throw new Error('Zoom SDK failed to initialize');
    }

    return true;
  } catch (error) {
    console.error('Failed to load Zoom Component SDK:', error);
    throw error;
  }
};

export const createZoomComponentClient = async (container: HTMLElement) => {
  await loadZoomComponentSDK();
  
  const client = window.ZoomMtgEmbedded.createClient();
  
  await client.init({
    zoomAppRoot: container,
    language: 'en-US',
    customize: {
      meetingInfo: ['topic', 'host', 'mn', 'pwd', 'invite', 'participant', 'dc'],
      toolbar: {
        buttons: [
          {
            text: 'Custom Button',
            className: 'CustomButton',
            onClick: () => {
              console.log('Custom button clicked');
            }
          }
        ]
      }
    }
  });

  return client;
};


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

// Simplified configuration focused on Component View
export const loadZoomComponentSDK = async (): Promise<boolean> => {
  if (window.ZoomMtgEmbedded) {
    console.log('✅ Zoom Component SDK already loaded');
    return true;
  }

  try {
    console.log('🔄 Loading Zoom Component SDK...');

    // Make React available globally (required by Zoom SDK)
    if (!window.React) {
      window.React = (await import('react')).default;
    }
    if (!window.ReactDOM) {
      window.ReactDOM = (await import('react-dom')).default;
    }

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
        link.onerror = () => resolve(); // Don't fail on CSS errors
        document.head.appendChild(link);
      });
    }));

    // Load SDK script
    await new Promise<void>((resolve, reject) => {
      if (document.querySelector('script[src*="zoom-meeting-embedded"]')) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://source.zoom.us/3.13.2/zoom-meeting-embedded-3.13.2.min.js';
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Zoom SDK'));
      document.head.appendChild(script);
    });

    // Wait for SDK to be available
    let attempts = 0;
    const maxAttempts = 50;
    
    while (!window.ZoomMtgEmbedded && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!window.ZoomMtgEmbedded) {
      throw new Error('Zoom SDK failed to initialize after timeout');
    }

    console.log('✅ Zoom Component SDK loaded successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to load Zoom Component SDK:', error);
    throw error;
  }
};

export const createZoomComponentClient = async (container: HTMLElement) => {
  if (!window.ZoomMtgEmbedded) {
    await loadZoomComponentSDK();
  }
  
  if (!container) {
    throw new Error('Container element is required');
  }

  const client = window.ZoomMtgEmbedded.createClient();
  
  return new Promise((resolve, reject) => {
    client.init({
      zoomAppRoot: container,
      language: 'en-US',
      patchJsMedia: true,
      isSupportAV: true,
      isSupportChat: true,
      screenShare: true,
      success: () => {
        console.log('✅ Zoom client initialized successfully');
        resolve(client);
      },
      error: (error: any) => {
        console.error('❌ Zoom client initialization error:', error);
        reject(new Error(`Initialization failed: ${error.message || error.reason}`));
      }
    });
  });
};

export { ZOOM_SDK_KEY };

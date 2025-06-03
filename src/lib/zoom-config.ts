
declare global {
  interface Window {
    ZoomMtgEmbedded: any;
    ZoomSDKLoaded: boolean;
  }
}

const ZOOM_SDK_URL = 'https://source.zoom.us/3.13.2/zoom-meeting-embedded-3.13.2.min.js';
const ZOOM_CSS_FILES = [
  'https://source.zoom.us/3.13.2/css/bootstrap.css',
  'https://source.zoom.us/3.13.2/css/react-select.css'
];

let sdkLoadPromise: Promise<void> | null = null;

export const loadZoomSDK = async (): Promise<void> => {
  // Return existing promise if already loading
  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }

  // Return immediately if already loaded
  if (window.ZoomSDKLoaded && window.ZoomMtgEmbedded) {
    console.log('Zoom SDK already loaded');
    return Promise.resolve();
  }

  console.log('Beginning Zoom Component SDK loading sequence');

  sdkLoadPromise = (async () => {
    try {
      // Load CSS files first
      console.log('Loading Zoom CSS files');
      await Promise.all(ZOOM_CSS_FILES.map(loadCSS));
      console.log('All CSS files loaded');

      // Load main SDK script
      console.log(`Loading script: ${ZOOM_SDK_URL}`);
      await loadScript(ZOOM_SDK_URL);
      console.log(`Script loaded successfully: ${ZOOM_SDK_URL}`);

      // Wait for ZoomMtgEmbedded to be available
      await waitForZoomMtgEmbedded();

      // Verify SDK initialization
      if (typeof window.ZoomMtgEmbedded?.createClient === 'function') {
        window.ZoomSDKLoaded = true;
        console.log('SDK initialization verified successfully');
      } else {
        throw new Error('ZoomMtgEmbedded.createClient is not available');
      }
    } catch (error) {
      console.error('Failed to load Zoom SDK:', error);
      sdkLoadPromise = null; // Reset promise to allow retry
      throw error;
    }
  })();

  return sdkLoadPromise;
};

const loadCSS = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if CSS is already loaded
    const existingLink = document.querySelector(`link[href="${url}"]`);
    if (existingLink) {
      console.log(`CSS already loaded: ${url}`);
      resolve();
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load CSS: ${url}`));
    document.head.appendChild(link);
  });
};

const loadScript = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if script is already loaded
    const existingScript = document.querySelector(`script[src="${url}"]`);
    if (existingScript) {
      console.log(`Script already loaded: ${url}`);
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    document.head.appendChild(script);
  });
};

const waitForZoomMtgEmbedded = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 100;
    const checkInterval = 100;

    const checkForZoom = () => {
      attempts++;
      if (window.ZoomMtgEmbedded) {
        console.log(`ZoomMtgEmbedded found after ${attempts} attempts!`);
        console.log('ZoomMtgEmbedded version:', window.ZoomMtgEmbedded.version || 'unknown');
        resolve();
      } else if (attempts >= maxAttempts) {
        reject(new Error(`ZoomMtgEmbedded not found after ${maxAttempts} attempts`));
      } else {
        setTimeout(checkForZoom, checkInterval);
      }
    };

    checkForZoom();
  });
};

// Export for backward compatibility
export const getZoomAccessToken = async () => {
  throw new Error('getZoomAccessToken is deprecated. Use Supabase edge functions instead.');
};

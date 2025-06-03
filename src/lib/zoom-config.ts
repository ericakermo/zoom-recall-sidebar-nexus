
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
let assetsPreloaded = false;

export const preloadZoomAssets = async (): Promise<void> => {
  if (assetsPreloaded) {
    console.log('🔍 [ZOOM-CONFIG] Assets already preloaded');
    return Promise.resolve();
  }

  console.log('🔄 [ZOOM-CONFIG] Starting conditional asset preloading...');
  
  try {
    // Preload main JS files
    await Promise.all([
      preloadScript('/lib/js_media.min.js'),
      preloadScript('/lib/av/zoom-meeting-embedded-3.13.2.min.js')
    ]);
    
    // Preload CSS files
    await Promise.all(ZOOM_CSS_FILES.map(preloadCSS));
    
    assetsPreloaded = true;
    console.log('✅ [ZOOM-CONFIG] All assets preloaded successfully');
  } catch (error) {
    console.error('❌ [ZOOM-CONFIG] Asset preloading failed:', error);
    throw new Error(`Failed to preload Zoom assets: ${error.message}`);
  }
};

const preloadScript = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already preloaded
    const existingLink = document.querySelector(`link[href="${url}"][rel="preload"]`);
    if (existingLink) {
      console.log(`🔍 [ZOOM-CONFIG] Script already preloaded: ${url}`);
      resolve();
      return;
    }

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = 'script';
    link.crossOrigin = 'anonymous';
    
    link.onload = () => {
      console.log(`✅ [ZOOM-CONFIG] Script preloaded: ${url}`);
      resolve();
    };
    
    link.onerror = () => {
      console.error(`❌ [ZOOM-CONFIG] Failed to preload script: ${url}`);
      reject(new Error(`Failed to preload script: ${url}`));
    };
    
    document.head.appendChild(link);
  });
};

const preloadCSS = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already preloaded
    const existingLink = document.querySelector(`link[href="${url}"][rel="preload"]`);
    if (existingLink) {
      console.log(`🔍 [ZOOM-CONFIG] CSS already preloaded: ${url}`);
      resolve();
      return;
    }

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = 'style';
    link.crossOrigin = 'anonymous';
    
    link.onload = () => {
      console.log(`✅ [ZOOM-CONFIG] CSS preloaded: ${url}`);
      resolve();
    };
    
    link.onerror = () => {
      console.error(`❌ [ZOOM-CONFIG] Failed to preload CSS: ${url}`);
      reject(new Error(`Failed to preload CSS: ${url}`));
    };
    
    document.head.appendChild(link);
  });
};

export const loadZoomSDK = async (): Promise<void> => {
  // Return existing promise if already loading
  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }

  // Return immediately if already loaded
  if (window.ZoomSDKLoaded && window.ZoomMtgEmbedded) {
    console.log('✅ [ZOOM-CONFIG] Zoom SDK already loaded');
    return Promise.resolve();
  }

  console.log('🔄 [ZOOM-CONFIG] Beginning Zoom Component SDK loading sequence');

  sdkLoadPromise = (async () => {
    try {
      // Ensure assets are preloaded first
      await preloadZoomAssets();

      // Load CSS files first
      console.log('🔄 [ZOOM-CONFIG] Loading Zoom CSS files');
      await Promise.all(ZOOM_CSS_FILES.map(loadCSS));
      console.log('✅ [ZOOM-CONFIG] All CSS files loaded');

      // Load main SDK script
      console.log(`🔄 [ZOOM-CONFIG] Loading script: ${ZOOM_SDK_URL}`);
      await loadScript(ZOOM_SDK_URL);
      console.log(`✅ [ZOOM-CONFIG] Script loaded successfully: ${ZOOM_SDK_URL}`);

      // Wait for ZoomMtgEmbedded to be available
      await waitForZoomMtgEmbedded();

      // Verify SDK initialization
      if (typeof window.ZoomMtgEmbedded?.createClient === 'function') {
        window.ZoomSDKLoaded = true;
        console.log('✅ [ZOOM-CONFIG] SDK initialization verified successfully');
      } else {
        throw new Error('ZoomMtgEmbedded.createClient is not available');
      }
    } catch (error) {
      console.error('❌ [ZOOM-CONFIG] Failed to load Zoom SDK:', error);
      sdkLoadPromise = null; // Reset promise to allow retry
      throw error;
    }
  })();

  return sdkLoadPromise;
};

// Legacy function for backward compatibility with ZoomMeetingSample
export const getSignature = async (meetingNumber: string, role: number = 0) => {
  console.warn('getSignature is deprecated. Use Supabase edge functions instead.');
  throw new Error('getSignature is deprecated. Use Supabase edge functions instead.');
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

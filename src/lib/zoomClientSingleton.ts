
// Singleton pattern for Zoom client management
let zoomClient: any = null;
let initializationPromise: Promise<any> | null = null;

export const getZoomClient = () => {
  if (!window.ZoomMtgEmbedded) {
    throw new Error('Zoom SDK not loaded');
  }
  
  if (!zoomClient) {
    console.log('Creating new Zoom client instance');
    zoomClient = window.ZoomMtgEmbedded.createClient();
  }
  
  return zoomClient;
};

export const initializeZoomClient = async (container: HTMLElement): Promise<any> => {
  // Return existing promise if initialization is in progress
  if (initializationPromise) {
    console.log('Initialization already in progress, waiting...');
    return initializationPromise;
  }

  const client = getZoomClient();
  
  initializationPromise = new Promise<any>(async (resolve, reject) => {
    try {
      // Wait for DOM to be ready
      await new Promise((res) => requestAnimationFrame(() => setTimeout(res, 100)));

      // Validate container
      if (!container) {
        throw new Error('Zoom container not available');
      }

      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        throw new Error(`Zoom container has no dimensions: ${rect.width}x${rect.height}`);
      }

      console.log('Initializing Zoom client with container:', {
        width: rect.width,
        height: rect.height,
        id: container.id
      });

      // Initialize with simplified config
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
        error: (err: any) => {
          console.error('❌ Zoom init error:', err);
          reject(new Error(`Zoom init failed: ${err.message || err.reason || 'Unknown error'}`));
        }
      });
    } catch (error) {
      console.error('❌ Error during initialization:', error);
      reject(error);
    }
  });

  // Clear promise when done (success or failure)
  initializationPromise.finally(() => {
    initializationPromise = null;
  });

  return initializationPromise;
};

export const cleanupZoomClient = () => {
  if (zoomClient) {
    try {
      console.log('Cleaning up Zoom client');
      if (typeof zoomClient.leave === 'function') {
        zoomClient.leave();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
    zoomClient = null;
  }
  initializationPromise = null;
};

export const isClientInitialized = () => {
  return zoomClient !== null;
};

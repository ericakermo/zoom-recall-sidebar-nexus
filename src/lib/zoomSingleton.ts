
// Simple singleton following Zoom docs exactly
let zoomClient: any = null;
let isInitializing = false;

export const createZoomClient = () => {
  if (!window.ZoomMtgEmbedded) {
    throw new Error('Zoom SDK not loaded');
  }
  
  // Always create a fresh client - no singleton for client instances
  return window.ZoomMtgEmbedded.createClient();
};

export const resetZoomState = () => {
  zoomClient = null;
  isInitializing = false;
};

export const getInitializationState = () => ({
  isInitializing,
  hasClient: !!zoomClient
});

export const setInitializationState = (state: boolean) => {
  isInitializing = state;
};

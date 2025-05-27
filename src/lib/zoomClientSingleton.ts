
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
  
  initializationPromise = new Promise<any>((resolve, reject) => {
    // Validate container first
    if (!container) {
      reject(new Error('Zoom container not available'));
      return;
    }

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      reject(new Error(`Zoom container has no dimensions: ${rect.width}x${rect.height}`));
      return;
    }

    console.log('Initializing Zoom client with container:', {
      width: rect.width,
      height: rect.height,
      id: container.id
    });

    // Use the exact configuration from the working GitHub sample
    client.init({
      zoomAppRoot: container,
      language: 'en-US',
      patchJsMedia: true,
      leaveOnPageUnload: true,
      isSupportAV: true,
      isSupportChat: true,
      isSupportQA: true,
      isSupportPolling: true,
      isSupportBreakout: true,
      screenShare: true,
      rwcBackup: '',
      videoDrag: true,
      sharingMode: 'both',
      videoHeader: true,
      isLockBottom: true,
      isSupportNonverbal: true,
      isShowJoiningErrorDialog: true,
      disablePreview: false,
      disableSetting: false,
      disableInvite: false,
      disableCallOut: false,
      disableRecord: false,
      disableJoinAudio: false,
      audioPanelAlwaysOpen: true,
      showMeetingHeader: true,
      disableVoIP: false,
      disableReport: false,
      meetingInfo: [
        'topic',
        'host',
        'mn',
        'pwd',
        'telPwd',
        'invite',
        'participant',
        'dc',
        'enctype',
        'report'
      ],
      success: () => {
        console.log('✅ Zoom client initialized successfully');
        resolve(client);
      },
      error: (err: any) => {
        console.error('❌ Zoom init error:', err);
        reject(new Error(`Zoom init failed: ${err.message || err.reason || 'Unknown error'}`));
      }
    });
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

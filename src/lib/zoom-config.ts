import { ZoomMeetingConfig } from '@/types/zoom';

// Use the client ID directly for sdkKey
const ZOOM_SDK_KEY = "eFAZ8Vf7RbG5saQVqL1zGA"; // This is your SDK Key (formerly Client ID)
const SUPABASE_URL = 'https://qsxlvwwebbakmzpwjfbb.supabase.co';

// State to manage SDK loading
let zoomSDKLoadingPromise: Promise<boolean> | null = null;
let zoomSDKLoaded = false;

// Load Zoom CSS files
export const loadZoomCss = async (): Promise<void> => {
  const cssFiles = [
    'https://source.zoom.us/3.13.2/css/bootstrap.css',
    'https://source.zoom.us/3.13.2/css/react-select.css'
  ];
  
  console.log('Loading Zoom CSS files');
  
  const loadCss = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`link[href="${url}"]`)) {
        console.log('CSS already loaded:', url);
        resolve();
        return;
      }
      
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = url;
      link.onload = () => {
        console.log('CSS loaded successfully:', url);
        resolve();
      };
      link.onerror = (e) => {
        console.error('Failed to load CSS:', url, e);
        resolve(); // Don't reject, just continue
      };
      document.head.appendChild(link);
    });
  };
  
  await Promise.all(cssFiles.map(loadCss));
  console.log('All CSS files loaded');
};

export const loadZoomSDK = async (): Promise<boolean> => {
  if (window.ZoomMtgEmbedded) {
    console.log('Zoom Component SDK already loaded');
    return Promise.resolve(true);
  }

  if (zoomSDKLoadingPromise) {
    return zoomSDKLoadingPromise;
  }

  zoomSDKLoadingPromise = new Promise<boolean>(async (resolve, reject) => {
    try {
      console.log('Beginning Zoom Component SDK loading sequence');
      
      // Load CSS first
      await loadZoomCss();

      // Make React available globally
      if (!window.React) {
        console.log('Making React available globally');
        window.React = (await import('react')).default;
      }
      if (!window.ReactDOM) {
        console.log('Making ReactDOM available globally');
        window.ReactDOM = (await import('react-dom')).default;
      }

      // Load the SDK script
      const zoomEmbeddedSdkUrl = 'https://source.zoom.us/3.13.2/zoom-meeting-embedded-3.13.2.min.js';
      
      const loadScript = (url: string): Promise<void> => {
        return new Promise((res, rej) => {
          if (document.querySelector(`script[src="${url}"]`)) {
            console.log('Script already exists:', url);
            res();
            return;
          }

          console.log('Loading script:', url);
          const script = document.createElement('script');
          script.src = url;
          script.async = false;
          script.crossOrigin = 'anonymous';
          script.onload = () => {
            console.log('Script loaded successfully:', url);
            res();
          };
          script.onerror = (e) => {
            console.error('Failed to load script:', url, e);
            rej(new Error(`Failed to load ${url}`));
          };
          document.head.appendChild(script);
        });
      };

      await loadScript(zoomEmbeddedSdkUrl);

      // Poll for window.ZoomMtgEmbedded
      const maxAttempts = 60;
      let attempts = 0;
      const pollInterval = 500;

      const checkZoomEmbeddedAvailability = () => {
        attempts++;
        
        if (attempts % 10 === 0) {
          console.log(`Still checking for ZoomMtgEmbedded (attempt ${attempts}/${maxAttempts})`);
        }
        
        if (window.ZoomMtgEmbedded) {
          console.log('ZoomMtgEmbedded found after', attempts, 'attempts!');
          console.log('ZoomMtgEmbedded version:', window.ZoomMtgEmbedded.version || 'unknown');
          
          // Pre-load required assets
          window.ZoomMtgEmbedded.preLoadWasm();
          window.ZoomMtgEmbedded.prepareWebSDK();
          
          // Load language files
          window.ZoomMtgEmbedded.i18n.load('en-US');
          
          zoomSDKLoaded = true;
          resolve(true);
        } else if (attempts >= maxAttempts) {
          console.error('ZoomMtgEmbedded not available after maximum attempts');
          reject(new Error('Timed out waiting for ZoomMtgEmbedded to initialize'));
        } else {
          setTimeout(checkZoomEmbeddedAvailability, pollInterval);
        }
      };

      checkZoomEmbeddedAvailability();
    } catch (error) {
      console.error('Error loading Zoom SDK:', error);
      zoomSDKLoadingPromise = null;
      reject(error);
    }
  });

  return zoomSDKLoadingPromise;
};

export const getSignature = async (meetingNumber: string, role: number): Promise<string> => {
  try {
    const tokenData = localStorage.getItem('sb-qsxlvwwebbakmzpwjfbb-auth-token');
    if (!tokenData) {
      throw new Error('Authentication required to join meetings');
    }
    
    const parsedToken = JSON.parse(tokenData);
    const authToken = parsedToken?.access_token;
    if (!authToken) {
      throw new Error('Invalid authentication token');
    }

    console.log(`Requesting signature for meeting: ${meetingNumber}, role: ${role}`);
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-zoom-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ meetingNumber, role }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get meeting authentication: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.signature) {
      throw new Error('Invalid response from authentication service');
    }
    
    return data.signature;
  } catch (error) {
    console.error('Error getting signature:', error);
    throw error;
  }
};

export const createAndInitializeZoomClient = async (
  zoomAppRoot: HTMLElement,
  initOptions?: any
): Promise<any> => {
  console.log('Beginning client initialization with container:', {
    id: zoomAppRoot.id,
    width: zoomAppRoot.offsetWidth,
    height: zoomAppRoot.offsetHeight,
    classList: Array.from(zoomAppRoot.classList),
    children: zoomAppRoot.childElementCount
  });
  
  if (!window.ZoomMtgEmbedded) {
    console.log('ZoomMtgEmbedded not found, loading SDK first');
    await loadZoomSDK();
    
    if (!window.ZoomMtgEmbedded) {
      throw new Error('Failed to load Zoom SDK after explicit loading attempt');
    }
  }

  // Validate container
  if (!zoomAppRoot) {
    throw new Error('Container element is null or undefined');
  }
  
  if (!zoomAppRoot.id || zoomAppRoot.id !== 'meetingSDKElement') {
    console.error('Container has incorrect or missing ID:', zoomAppRoot.id);
    zoomAppRoot.id = 'meetingSDKElement';
    console.log('Fixed container ID to:', zoomAppRoot.id);
  }
  
  // Check container dimensions and visibility
  const containerStyle = window.getComputedStyle(zoomAppRoot);
  const containerDimensions = {
    width: zoomAppRoot.offsetWidth,
    height: zoomAppRoot.offsetHeight,
    display: containerStyle.display,
    position: containerStyle.position,
    visibility: containerStyle.visibility,
    opacity: containerStyle.opacity
  };
  
  console.log('Container style check:', containerDimensions);
  
  // Validate dimensions
  if (containerDimensions.width <= 0 || containerDimensions.height <= 0) {
    console.error('Container has invalid dimensions:', containerDimensions);
    zoomAppRoot.style.minWidth = '640px';
    zoomAppRoot.style.minHeight = '480px';
    console.log('Applied forced minimum dimensions to container');
  }
  
  // Ensure container is visible
  if (containerDimensions.display === 'none' || containerDimensions.visibility === 'hidden' || containerDimensions.opacity === '0') {
    console.error('Container is not visible:', containerDimensions);
    zoomAppRoot.style.display = 'block';
    zoomAppRoot.style.visibility = 'visible';
    zoomAppRoot.style.opacity = '1';
    console.log('Applied forced visibility to container');
  }

  console.log('Creating Zoom client');
  const client = window.ZoomMtgEmbedded.createClient();
  
  try {
    const initConfig = {
      zoomAppRoot,
      language: 'en-US',
      patchJsMedia: true,
      assetPath: 'https://source.zoom.us/3.13.2/lib',
      showMeetingHeader: true,
      disableInvite: false,
      disableCallOut: false,
      disableRecord: false,
      disableJoinAudio: false,
      audioPanelAlwaysOpen: false,
      showPureSharingContent: false,
      isSupportAV: true,
      isSupportChat: true,
      isSupportQA: true,
      isSupportCC: true,
      isSupportPolling: true,
      isSupportBreakout: true,
      screenShare: true,
      rwcBackup: '',
      videoDrag: true,
      sharingMode: 'both',
      videoHeader: true,
      isLockBottom: true,
      isShowAvatar: true,
      isShowUserStatistics: true,
      meetingInfo: ['topic', 'host', 'mn', 'pwd', 'telPwd', 'invite', 'participant', 'dc', 'enctype'],
      success: (event: any) => {
        console.log('Zoom client initialized successfully', {
          event,
          containerDimensions: {
            width: zoomAppRoot.offsetWidth,
            height: zoomAppRoot.offsetHeight
          }
        });
      },
      error: (event: any) => {
        console.error('Zoom client initialization error', {
          event,
          containerDimensions: {
            width: zoomAppRoot.offsetWidth,
            height: zoomAppRoot.offsetHeight
          }
        });
      },
      ...initOptions
    };

    console.log('Initializing Zoom client with config:', { 
      ...initConfig, 
      zoomAppRoot: 'DOM Element'
    });
    
    await client.init(initConfig);
    console.log('Zoom Embedded SDK client initialized successfully');
    return client;
  } catch (error) {
    console.error('Error initializing Zoom client:', error);
    throw error;
  }
};

export const joinZoomMeeting = async (client: any, params: {
  signature: string;
  meetingNumber: string;
  userName: string;
  password?: string;
  userEmail?: string;
}): Promise<void> => {
  if (!client) {
    throw new Error('Zoom client instance is required to join a meeting');
  }
  
  const joinPayload = {
    sdkKey: ZOOM_SDK_KEY,
    signature: params.signature,
    meetingNumber: params.meetingNumber,
    userName: params.userName,
    password: params.password || '',
    userEmail: params.userEmail || '',
  };
  
  console.log('Attempting to join Zoom meeting with parameters:', { 
    ...joinPayload, 
    signature: '[REDACTED]',
    meetingNumber: joinPayload.meetingNumber,
    userName: joinPayload.userName,
  });
  
  try {
    await client.join(joinPayload);
    console.log('Successfully joined the Zoom meeting');
  } catch (joinError: any) {
    console.error('Error joining Zoom meeting:', joinError);
    
    if (joinError && typeof joinError === 'object') {
      console.error('Join error details:', JSON.stringify(joinError, null, 2));
    }
    
    const errorMessage = joinError.message || 'Unknown join error';
    throw new Error(`Failed to join meeting: ${errorMessage}`);
  }
};

export const leaveZoomMeeting = async (client: any): Promise<void> => {
  if (!client) {
    console.warn('Zoom client not provided for leaveZoomMeeting');
    return;
  }
  
  try {
    await client.leave();
    console.log('Successfully left the Zoom meeting');
  } catch (error) {
    console.error('Error leaving Zoom meeting:', error);
  }
};

export const createZoomMeeting = async (params: {
  topic?: string;
  type?: number;
  settings?: {
    host_video?: boolean;
    participant_video?: boolean;
    join_before_host?: boolean;
    mute_upon_entry?: boolean;
    waiting_room?: boolean;
  };
} = {}): Promise<any> => {
  try {
    const tokenData = localStorage.getItem('sb-qsxlvwwebbakmzpwjfbb-auth-token');
    if (!tokenData) {
      throw new Error('Authentication required to create meetings');
    }
    
    const parsedToken = JSON.parse(tokenData);
    const authToken = parsedToken?.access_token;
    if (!authToken) {
      throw new Error('Invalid authentication token');
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-zoom-meeting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create meeting: ${response.status}. ${errorText}`);
    }

    const meetingData = await response.json();
    if (!meetingData.id) {
      throw new Error('Meeting ID not found in response');
    }

    return meetingData;
  } catch (error) {
    console.error('Error creating Zoom meeting:', error);
    throw error;
  }
};

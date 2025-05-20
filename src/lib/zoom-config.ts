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
  if (window.ZoomMtg) {
    console.log('Zoom SDK already loaded');
    return Promise.resolve(true);
  }

  if (zoomSDKLoadingPromise) {
    return zoomSDKLoadingPromise;
  }

  zoomSDKLoadingPromise = new Promise<boolean>(async (resolve, reject) => {
    try {
      console.log('Beginning Zoom SDK loading sequence');
      
      // Load CSS first
      await loadZoomCss();

      // Load the SDK script
      const zoomSdkUrl = 'https://source.zoom.us/3.13.2/zoom-meeting-3.13.2.min.js';
      
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

      await loadScript(zoomSdkUrl);

      // Initialize Zoom SDK
      if (window.ZoomMtg) {
        await window.ZoomMtg.preLoadWasm();
        await window.ZoomMtg.prepareWebSDK();
        await window.ZoomMtg.i18n.load('en-US');
        zoomSDKLoaded = true;
        resolve(true);
      } else {
        throw new Error('ZoomMtg not available after loading script');
      }
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

export const joinZoomMeeting = async (params: {
  signature: string;
  meetingNumber: string;
  userName: string;
  password?: string;
  userEmail?: string;
}): Promise<void> => {
  if (!window.ZoomMtg) {
    throw new Error('Zoom SDK not loaded');
  }

  try {
    await window.ZoomMtg.init({
      leaveUrl: window.location.origin + '/meetings',
      success: () => {
        console.log('Zoom SDK initialized successfully');
      },
      error: (error: any) => {
        console.error('Error initializing Zoom SDK:', error);
        throw error;
      }
    });

    await window.ZoomMtg.join({
      signature: params.signature,
      meetingNumber: params.meetingNumber,
      userName: params.userName,
      sdkKey: ZOOM_SDK_KEY,
      passWord: params.password || '',
      userEmail: params.userEmail || '',
      success: () => {
        console.log('Successfully joined meeting');
      },
      error: (error: any) => {
        console.error('Error joining meeting:', error);
        throw error;
      }
    });
  } catch (error) {
    console.error('Error in joinZoomMeeting:', error);
    throw error;
  }
};

export const leaveZoomMeeting = async (): Promise<void> => {
  if (!window.ZoomMtg) {
    console.warn('Zoom SDK not loaded');
    return;
  }

  try {
    await window.ZoomMtg.leaveMeeting({
      success: () => {
        console.log('Successfully left meeting');
      },
      error: (error: any) => {
        console.error('Error leaving meeting:', error);
      }
    });
  } catch (error) {
    console.error('Error in leaveZoomMeeting:', error);
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

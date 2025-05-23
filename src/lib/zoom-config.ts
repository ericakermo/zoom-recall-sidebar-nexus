import { ZoomMeetingConfig, ZoomJoinParams, ZoomJoinConfig, ZoomTokenData, MeetingStatus } from '@/types/zoom';
import { createHash } from 'crypto';

// Use the updated client ID as the SDK Key
const ZOOM_SDK_KEY = "dkQMavedS2OWM2c73F6pLg"; // Updated SDK Key (Client ID)
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

      const checkZoomEmbeddedAvailability = async () => {
        attempts++;
        
        if (attempts % 10 === 0) {
          console.log(`Still checking for ZoomMtgEmbedded (attempt ${attempts}/${maxAttempts})`);
        }
        
        if (window.ZoomMtgEmbedded) {
          console.log('ZoomMtgEmbedded found after', attempts, 'attempts!');
          console.log('ZoomMtgEmbedded version:', window.ZoomMtgEmbedded.version || 'unknown');
          
          try {
            // Create a test client to verify SDK is working
            const testClient = window.ZoomMtgEmbedded.createClient();
            if (!testClient) {
              throw new Error('Failed to create test client');
            }
            
            console.log('SDK initialization verified successfully');
            zoomSDKLoaded = true;
            resolve(true);
          } catch (error) {
            console.error('Error during SDK verification:', error);
            reject(error);
          }
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

export const getZoomAccessToken = async (meetingNumber: string, role: number = 0): Promise<ZoomTokenData> => {
  try {
    const tokenData = localStorage.getItem('sb-qsxlvwwebbakmzpwjfbb-auth-token');
    if (!tokenData) {
      throw new Error('Authentication required');
    }
    
    const parsedToken = JSON.parse(tokenData);
    const authToken = parsedToken?.access_token;
    
    // Get OAuth token and signature
    const response = await fetch(`https://qsxlvwwebbakmzpwjfbb.supabase.co/functions/v1/get-zoom-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        meetingNumber,
        role,
        expirationSeconds: 7200 // 2 hours
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get Zoom token');
    }

    const data = await response.json();
    
    // If host role, get ZAK token
    if (role === 1) {
      const zakResponse = await fetch(`https://qsxlvwwebbakmzpwjfbb.supabase.co/functions/v1/get-zoom-zak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        }
      });

      if (!zakResponse.ok) {
        throw new Error('Failed to get ZAK token');
      }

      const zakData = await zakResponse.json();
      data.zak = zakData.zak;
    }

    return {
      accessToken: data.accessToken,
      tokenType: data.tokenType,
      sdkKey: data.sdkKey || ZOOM_SDK_KEY,
      signature: data.signature,
      zak: data.zak
    };
  } catch (error) {
    console.error('Error getting Zoom token:', error);
    throw error;
  }
};

export const checkMeetingStatus = async (meetingNumber: string): Promise<MeetingStatus> => {
  try {
    const tokenData = await getZoomAccessToken(meetingNumber);
    
    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingNumber}`, {
      headers: {
        'Authorization': `Bearer ${tokenData.accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to check meeting status');
    }

    const data = await response.json();
    return {
      status: data.status,
      startTime: data.start_time,
      duration: data.duration,
      joinBeforeHost: data.settings?.join_before_host
    };
  } catch (error) {
    console.error('Error checking meeting status:', error);
    throw error;
  }
};

// Legacy function name for backward compatibility
export const getSignature = getZoomAccessToken;

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

// UPDATED joinMeeting function with ZAK token support for host role
export const joinMeeting = async (client: any, params: ZoomJoinParams) => {
  try {
    // Get OAuth token and check meeting status
    const tokenData = await getZoomAccessToken(params.meetingNumber, params.role || 0);
    const meetingStatus = await checkMeetingStatus(params.meetingNumber);
    
    console.log('Joining meeting with status:', {
      status: meetingStatus.status,
      joinBeforeHost: meetingStatus.joinBeforeHost,
      hasToken: !!tokenData.accessToken,
      tokenType: tokenData.tokenType,
      sdkKey: tokenData.sdkKey,
      role: params.role,
      hasZak: !!params.zak,
      hasSignature: !!tokenData.signature
    });

    // Add delay before joining
    console.log('Waiting before joining meeting...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Validate meeting number format
    if (!/^\d{9,11}$/.test(params.meetingNumber)) {
      throw new Error('Invalid meeting number format. Must be 9-11 digits.');
    }

    const joinConfig: ZoomJoinConfig = {
      sdkKey: tokenData.sdkKey,
      signature: tokenData.signature,
      meetingNumber: params.meetingNumber,
      userName: params.userName,
      userEmail: params.userEmail,
      password: params.password || '',
      role: params.role || 0,
      success: (success: any) => {
        console.log('Join meeting success:', success);
      },
      error: (error: any) => {
        console.error('Join meeting error:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          type: error.type,
          reason: error.reason,
          hasZak: !!params.zak,
          role: params.role,
          hasSignature: !!tokenData.signature,
          meetingNumber: params.meetingNumber,
          userName: params.userName
        });
      }
    };

    // Add role-specific configuration
    if (params.role === 1) { // Host role
      joinConfig.zak = tokenData.zak;
      joinConfig.join_before_host = true;
      console.log('Host configuration applied with ZAK token');
    }

    console.log('Joining with config:', {
      sdkKey: joinConfig.sdkKey,
      hasSignature: !!joinConfig.signature,
      hasZak: !!joinConfig.zak,
      meetingNumber: joinConfig.meetingNumber,
      userName: joinConfig.userName,
      role: joinConfig.role,
      hasPassword: !!joinConfig.password
    });

    await client.join(joinConfig);
  } catch (error) {
    console.error('Error joining meeting:', error);
    throw error;
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

import { ZoomMeetingConfig } from '@/types/zoom';

// Use the client ID directly for sdkKey
const ZOOM_SDK_KEY = "eFAZ8Vf7RbG5saQVqL1zGA"; // This is your SDK Key (formerly Client ID)
const SUPABASE_URL = 'https://qsxlvwwebbakmzpwjfbb.supabase.co';

// State to manage SDK loading to ensure it only happens once
let zoomSDKLoadingPromise: Promise<boolean> | null = null;
let zoomSDKLoaded = false; // Tracks if ZoomMtgEmbedded is confirmed available

// Load Zoom CSS files
export const loadZoomCss = async (): Promise<void> => {
  const cssFiles = [
    'https://source.zoom.us/3.13.2/css/bootstrap.css',
    'https://source.zoom.us/3.13.2/css/react-select.css'
  ];
  
  console.log('Loading Zoom CSS files');
  
  const loadCss = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Skip if already loaded
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
        // Don't reject, just log and continue - CSS failures shouldn't block functionality
        resolve();
      };
      document.head.appendChild(link);
    });
  };
  
  // Load all CSS files in parallel
  await Promise.all(cssFiles.map(loadCss));
  console.log('All CSS files loaded');
};

export const loadZoomSDK = async (): Promise<boolean> => {
  // If SDK is already loaded and ZoomMtgEmbedded is available, resolve immediately
  if (window.ZoomMtgEmbedded) {
    console.log('Zoom Component SDK already loaded and ZoomMtgEmbedded is available.');
    return Promise.resolve(true);
  }

  // If loading is already in progress, return the existing promise
  if (zoomSDKLoadingPromise) {
    console.log('Zoom Component SDK loading is already in progress.');
    return zoomSDKLoadingPromise;
  }

  // Start the loading process
  zoomSDKLoadingPromise = new Promise<boolean>(async (resolve, reject) => {
    try {
      console.log('Beginning Zoom Component SDK loading sequence');
      
      // First, make sure CSS is loaded
      await loadZoomCss();

      // Load the SDK script
      const zoomEmbeddedSdkUrl = 'https://source.zoom.us/3.13.2/zoom-meeting-embedded-3.13.2.min.js';
      
      const loadScript = (url: string): Promise<void> => {
        return new Promise((res, rej) => {
          // Check if script already exists
          if (document.querySelector(`script[src="${url}"]`)) {
            console.log('Script already exists:', url);
            res();
            return;
          }

          console.log('Loading script:', url);
          const script = document.createElement('script');
          script.src = url;
          script.async = false; // Important: keep scripts in order
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

      // Poll for window.ZoomMtgEmbedded with enhanced logging
      const maxAttempts = 60; // 30 seconds with 500ms intervals
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
          zoomSDKLoaded = true;
          resolve(true);
        } else if (attempts >= maxAttempts) {
          console.error('ZoomMtgEmbedded not available after maximum attempts');
          console.log('Current window keys:', Object.keys(window).filter(key => key.includes('Zoom') || key.includes('Meeting')));
          reject(new Error('Timed out waiting for ZoomMtgEmbedded to initialize'));
        } else {
          setTimeout(checkZoomEmbeddedAvailability, pollInterval);
        }
      };

      // Start polling
      checkZoomEmbeddedAvailability();

    } catch (error) {
      console.error('Fatal error during SDK loading sequence:', error);
      zoomSDKLoadingPromise = null; // Reset promise so future attempts can be made
      reject(error);
    }
  });

  return zoomSDKLoadingPromise;
};

export const getSignature = async (meetingNumber: string, role: number): Promise<string> => {
  try {
    const tokenData = localStorage.getItem('sb-qsxlvwwebbakmzpwjfbb-auth-token'); // Make sure this is the correct key for your Supabase session
    if (!tokenData) {
      console.error('Supabase auth token not found in localStorage. User might not be logged in.');
      throw new Error('Authentication required to join meetings');
    }
    
    const parsedToken = JSON.parse(tokenData);
    const authToken = parsedToken?.access_token;
    if (!authToken) {
      console.error('Invalid Supabase auth token structure. Access token missing.');
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
      console.error(`Signature API error: ${response.status} - ${errorText}`);
      throw new Error(`Failed to get meeting authentication: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.signature) {
        console.error('Signature not found in API response:', data);
        throw new Error('Invalid response from authentication service');
    }
    
    console.log('Signature generated successfully');
    return data.signature;
  } catch (error) {
    console.error('Detailed error in getSignature:', error);
    throw error; 
  }
};

// Enhanced initialization with better container validation and logging
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
  
  // Ensure the SDK is loaded
  if (!window.ZoomMtgEmbedded) {
    console.log('ZoomMtgEmbedded not found, loading SDK first');
    await loadZoomSDK();
    
    if (!window.ZoomMtgEmbedded) {
      throw new Error('Failed to load Zoom SDK after explicit loading attempt');
    }
  }

  // Enhanced container validation
  if (!zoomAppRoot) {
    throw new Error('Container element is null or undefined');
  }
  
  if (!zoomAppRoot.id || zoomAppRoot.id !== 'meetingSDKElement') {
    console.error('Container has incorrect or missing ID:', zoomAppRoot.id);
    zoomAppRoot.id = 'meetingSDKElement'; // Force correct ID
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
    
    // Force minimum dimensions
    zoomAppRoot.style.minWidth = '640px';
    zoomAppRoot.style.minHeight = '480px';
    console.log('Applied forced minimum dimensions to container');
    
    // Force layout recalculation and check again
    void zoomAppRoot.offsetHeight; // Trigger reflow
    
    const updatedDimensions = {
      width: zoomAppRoot.offsetWidth,
      height: zoomAppRoot.offsetHeight
    };
    
    console.log('Updated container dimensions:', updatedDimensions);
    
    if (updatedDimensions.width <= 0 || updatedDimensions.height <= 0) {
      throw new Error('Container still has invalid dimensions after correction');
    }
  }
  
  // Ensure container is visible
  if (containerDimensions.display === 'none' || containerDimensions.visibility === 'hidden' || containerDimensions.opacity === '0') {
    console.error('Container is not visible:', containerDimensions);
    
    // Force visibility
    zoomAppRoot.style.display = 'block';
    zoomAppRoot.style.visibility = 'visible';
    zoomAppRoot.style.opacity = '1';
    
    console.log('Applied forced visibility to container');
  }

  console.log('Creating Zoom client');
  const client = window.ZoomMtgEmbedded.createClient();
  
  try {
    // Initialize with enhanced options and logging
    const initConfig = {
      zoomAppRoot,
      language: 'en-US',
      patchJsMedia: true, // Fix common browser compatibility issues
      assetPath: 'https://source.zoom.us/3.13.2/lib',
      
      // Required rendering options
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
      
      // Event handlers with enhanced logging
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
      
      // Merge any user-provided options
      ...initOptions
    };

    console.log('Initializing Zoom client with config:', { 
      ...initConfig, 
      zoomAppRoot: 'DOM Element' // Prevent circular reference in console
    });
    
    try {
      await client.init(initConfig);
      console.log('Zoom Embedded SDK client initialized successfully');
      return client;
    } catch (initError: any) {
      console.error('Error in client.init():', initError);
      
      // Additional details if possible
      if (initError && typeof initError === 'object') {
        console.error('Error details:', JSON.stringify(initError, null, 2));
      }
      
      throw initError;
    }
  } catch (error) {
    console.error('Error initializing Zoom client:', error);
    
    // Log more details about the container
    console.error('Container state at error:', {
      container: zoomAppRoot.id,
      width: zoomAppRoot.offsetWidth,
      height: zoomAppRoot.offsetHeight,
      display: window.getComputedStyle(zoomAppRoot).display,
      visibility: window.getComputedStyle(zoomAppRoot).visibility,
      parentDisplay: zoomAppRoot.parentElement ? window.getComputedStyle(zoomAppRoot.parentElement).display : 'none',
      parentSize: {
        width: zoomAppRoot.parentElement?.offsetWidth, 
        height: zoomAppRoot.parentElement?.offsetHeight
      },
      childrenCount: zoomAppRoot.childElementCount
    });
    
    throw error;
  }
};

// Interface for join parameters, helps with type safety
interface JoinMeetingParams {
  signature: string;
  meetingNumber: string;
  userName: string;
  password?: string; 
  userEmail?: string;
  tk?: string; // Registrant token
}

export const joinZoomMeeting = async (client: any, params: JoinMeetingParams): Promise<void> => {
  if (!client) {
    console.error('Zoom client instance not provided for joinZoomMeeting');
    throw new Error('Zoom client instance is required to join a meeting');
  }
  
  const joinPayload = {
    sdkKey: ZOOM_SDK_KEY,
    signature: params.signature,
    meetingNumber: params.meetingNumber,
    userName: params.userName,
    password: params.password || '',
    userEmail: params.userEmail || '',
    tk: params.tk || '',
  };
  
  console.log('Attempting to join Zoom meeting with parameters:', { 
    ...joinPayload, 
    signature: '[REDACTED]',
    meetingNumber: joinPayload.meetingNumber,
    userName: joinPayload.userName,
  });
  
  try {
    // Add timeout protection
    const joinPromise = client.join(joinPayload);
    
    // Wait for join with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Join meeting timed out after 20 seconds')), 20000);
    });
    
    await Promise.race([joinPromise, timeoutPromise]);
    console.log('Successfully joined the Zoom meeting');
  } catch (joinError: any) {
    console.error('Error joining Zoom meeting:', joinError);
    
    // Try to get more details if available
    if (joinError && typeof joinError === 'object') {
      console.error('Join error details:', JSON.stringify(joinError, null, 2));
    }
    
    // Check for specific error types
    const errorMessage = joinError.message || 'Unknown join error';
    
    if (errorMessage.includes('timeout')) {
      throw new Error('Connection to meeting timed out. Please check your network connection.');
    } else if (errorMessage.includes('password') || errorMessage.includes('passcode')) {
      throw new Error('Incorrect meeting password or passcode.');
    } else {
      throw new Error(`Failed to join meeting: ${errorMessage}`);
    }
  }
};

// Improved leave meeting function with better error handling
export const leaveZoomMeeting = async (client: any): Promise<void> => {
  if (!client) {
    console.warn('Zoom client not provided for leaveZoomMeeting, or meeting not joined');
    return;
  }
  
  try {
    console.log('Attempting to leave Zoom meeting...');
    
    // Add timeout protection
    const leavePromise = client.leave();
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        console.warn('Leave meeting timed out, forcing cleanup');
        resolve(undefined);
      }, 5000);
    });
    
    await Promise.race([leavePromise, timeoutPromise]);
    console.log('Successfully left the Zoom meeting');
  } catch (leaveError) {
    console.error('Error leaving Zoom meeting:', leaveError);
    
    // Don't throw, as this is likely called during cleanup
    console.log('Continuing despite leave error - meeting resources may not be fully cleaned up');
  }
};

// Add this interface for meeting creation parameters
interface CreateMeetingParams {
  topic?: string;
  type?: number; // 1 for instant meeting, 2 for scheduled meeting
  settings?: {
    host_video?: boolean;
    participant_video?: boolean;
    join_before_host?: boolean;
    mute_upon_entry?: boolean;
    waiting_room?: boolean;
  };
}

// Add this function to create a meeting
export const createZoomMeeting = async (params: CreateMeetingParams = {}): Promise<any> => {
  try {
    const tokenData = localStorage.getItem('sb-qsxlvwwebbakmzpwjfbb-auth-token');
    if (!tokenData) {
      throw new Error('Supabase auth token not found.');
    }
    
    const parsedToken = JSON.parse(tokenData);
    const authToken = parsedToken?.access_token;
    if (!authToken) {
      throw new Error('Invalid Supabase auth token structure.');
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

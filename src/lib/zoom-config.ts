import { ZoomMeetingConfig } from '@/types/zoom';

// Use the client ID directly for sdkKey
const ZOOM_SDK_KEY = "eFAZ8Vf7RbG5saQVqL1zGA"; // This is your SDK Key (formerly Client ID)
const SUPABASE_URL = 'https://qsxlvwwebbakmzpwjfbb.supabase.co';

// State to manage SDK loading to ensure it only happens once
let zoomSDKLoadingPromise: Promise<boolean> | null = null;
let zoomSDKLoaded = false; // Tracks if ZoomMtgEmbedded is confirmed available

export const loadZoomSDK = (): Promise<boolean> => {
  // If SDK is already loaded and ZoomMtgEmbedded is available, resolve immediately
  if (zoomSDKLoaded && window.ZoomMtgEmbedded) {
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
      console.log('Beginning Zoom Component SDK loading process');

      const reactScriptUrl = 'https://source.zoom.us/2.18.0/lib/vendor/react.min.js';
      const reactDOMScriptUrl = 'https://source.zoom.us/2.18.0/lib/vendor/react-dom.min.js';
      const zoomEmbeddedSdkUrl = 'https://source.zoom.us/2.18.0/zoom-meeting-embedded-2.18.0.min.js';

      const loadScriptSequentially = async (url: string, name: string, globalToCheck?: string) => {
        if (globalToCheck && (window as any)[globalToCheck]) {
          console.log(`${name} (${globalToCheck}) already available globally.`);
          return;
        }
        if (document.querySelector(`script[src="${url}"]`)) {
          console.log(`${name} script tag already exists. Will proceed to poll if necessary.`);
          // If script tag exists but global isn't set (for ZoomMtgEmbedded), polling will handle it.
          // For React/ReactDOM, if tag exists, we assume they'll load or are part of app bundle.
          return;
        }
        return new Promise<void>((res, rej) => {
          console.log(`Loading ${name}...`);
          const script = document.createElement('script');
          script.src = url;
          script.async = false; // Ensure sequential loading
          script.onload = () => {
            console.log(`${name} loaded successfully via script tag.`);
            res();
          };
          script.onerror = (e) => {
            console.error(`Failed to load ${name}`, e);
            rej(new Error(`Failed to load ${name}`));
          };
          document.head.appendChild(script);
        });
      };

      // It's generally better if your app (e.g., Vite/React) provides React/ReactDOM.
      // Loading them from Zoom's CDN can lead to conflicts if versions mismatch or if your app already includes them.
      // However, if you must load them this way:
      if (!window.React) {
        await loadScriptSequentially(reactScriptUrl, 'React from Zoom CDN');
      } else {
        console.log('React is already available globally (likely from app bundle).');
      }
      if (!window.ReactDOM) {
        await loadScriptSequentially(reactDOMScriptUrl, 'ReactDOM from Zoom CDN');
      } else {
        console.log('ReactDOM is already available globally (likely from app bundle).');
      }

      // Load Zoom Embedded SDK script if not already present
      if (!window.ZoomMtgEmbedded && !document.querySelector(`script[src="${zoomEmbeddedSdkUrl}"]`)) {
        await loadScriptSequentially(zoomEmbeddedSdkUrl, 'Zoom Embedded SDK');
      } else if (window.ZoomMtgEmbedded) {
        console.log('ZoomMtgEmbedded was already available globally.');
      } else {
        console.log('Zoom Embedded SDK script tag exists or was just added. Proceeding to poll for ZoomMtgEmbedded.');
      }

      // Poll for window.ZoomMtgEmbedded
      const maxAttempts = 40; // Increased attempts for slower networks/initialization
      let attempts = 0;
      const pollInterval = 300; // Poll every 300ms

      const checkZoomEmbeddedAvailability = () => {
        attempts++;
        if (window.ZoomMtgEmbedded) {
          console.log(`ZoomMtgEmbedded object detected after ${attempts} attempts.`);
          zoomSDKLoaded = true; // Set our flag
          resolve(true);
        } else if (attempts >= maxAttempts) {
          console.error(`ZoomMtgEmbedded not available after ${attempts} attempts. Check console for script loading errors or conflicts.`);
          console.log('Current window keys (searching for "zoom"):', Object.keys(window).filter(k => k.toLowerCase().includes('zoom')));
          reject(new Error('Timed out waiting for ZoomMtgEmbedded to initialize'));
        } else {
          setTimeout(checkZoomEmbeddedAvailability, pollInterval);
        }
      };
      // Start polling
      checkZoomEmbeddedAvailability();

    } catch (error) {
      console.error('Error during SDK loading sequence:', error);
      zoomSDKLoadingPromise = null; // Reset promise on critical error to allow retry
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
      throw new Error('Supabase auth token not found.');
    }
    
    const parsedToken = JSON.parse(tokenData);
    const authToken = parsedToken?.access_token;
    if (!authToken) {
      console.error('Invalid Supabase auth token structure. Access token missing.');
      throw new Error('Invalid Supabase auth token structure.');
    }

    console.log(`Requesting signature for meeting: ${meetingNumber}, role: ${role}`);
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-zoom-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        // Supabase Edge Functions might require the 'apikey' if not using a service role key for authenticated calls.
        // This depends on your function's security settings.
        // 'apikey': YOUR_SUPABASE_ANON_KEY_IF_NEEDED 
      },
      body: JSON.stringify({ meetingNumber, role }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Signature API error: ${response.status} - ${errorText}`);
      throw new Error(`Failed to generate signature: ${response.status}. ${errorText}`);
    }
    const data = await response.json();
    if (!data.signature) {
        console.error('Signature not found in API response object:', data);
        throw new Error('Signature was not found in the API response.');
    }
    console.log('Signature generated successfully from backend.');
    return data.signature;
  } catch (error) {
    console.error('Detailed error in getSignature:', error);
    throw error; 
  }
};

export const createAndInitializeZoomClient = async (zoomAppRootElement: HTMLElement): Promise<any> => {
  if (!zoomSDKLoaded || !window.ZoomMtgEmbedded) {
    console.error('Zoom Component SDK is not loaded. Ensure loadZoomSDK() was called and succeeded.');
    throw new Error('Zoom Component SDK not loaded. Cannot create client.');
  }

  console.log('Creating Zoom Embedded SDK client...');
  const client = window.ZoomMtgEmbedded.createClient();
  console.log('Zoom Embedded SDK client created.');

  if (!zoomAppRootElement || !document.body.contains(zoomAppRootElement)) {
    console.error('The zoomAppRootElement provided is invalid or not in the DOM.');
    throw new Error('Invalid zoomAppRootElement for Zoom client initialization.');
  }
  console.log('Initializing Zoom Embedded SDK client with root element:', zoomAppRootElement);
  
  try {
    // Note: Component View .init() is synchronous or returns a Promise that resolves quickly
    // according to some docs, but it's safer to await if it returns a promise.
    // The official GH repo example uses .then() for client.init()
    await client.init({
      zoomAppRoot: zoomAppRootElement,
      language: 'en-US',
      patchJsMedia: true, // Recommended for better compatibility
      // Customize other options as needed, e.g., webEndpoint, assetPath for ZFG
    });
    console.log('Zoom Embedded SDK client initialized successfully.');
    return client; // Return the initialized client instance
  } catch (initError) {
    console.error('Error initializing Zoom Embedded SDK client:', initError);
    // Log more details if available
    if (initError && typeof initError === 'object') {
        console.error('Initialization error details:', JSON.stringify(initError));
    }
    throw initError;
  }
};

// Interface for join parameters, helps with type safety
interface JoinMeetingParams {
  // sdkKey: string; // sdkKey is now globally defined as ZOOM_SDK_KEY
  signature: string; // This is the SDK JWT
  meetingNumber: string;
  userName: string;
  password?: string; 
  userEmail?: string;
  tk?: string; // Registrant token
  // zak?: string; // Only if starting a meeting as host and using ZAK token
}

export const joinZoomMeeting = async (client: any, params: JoinMeetingParams): Promise<void> => {
  if (!client) {
    console.error('Zoom client instance not provided for joinZoomMeeting.');
    throw new Error('Zoom client instance is required to join a meeting.');
  }
  // Use the global ZOOM_SDK_KEY
  const joinPayload = {
    ...params,
    sdkKey: ZOOM_SDK_KEY, 
    password: params.password || '',
    userEmail: params.userEmail || '',
    tk: params.tk || '',
  };
  console.log('Attempting to join Zoom meeting with parameters:', { ...joinPayload, signature: '[REDACTED]' });
  
  try {
    await client.join(joinPayload);
    console.log('Successfully joined the Zoom meeting.');
  } catch (joinError) {
    console.error('Error joining Zoom meeting:', joinError);
    if (joinError && typeof joinError === 'object') {
        console.error('Join error details:', JSON.stringify(joinError));
    }
    throw joinError;
  }
};

// It's good practice to also provide a way to handle leaving/ending meetings
export const leaveZoomMeeting = async (client: any): Promise<void> => {
    if (!client) {
        console.warn('Zoom client not provided for leaveZoomMeeting, or meeting not joined.');
        return;
    }
    try {
        console.log('Attempting to leave Zoom meeting...');
        await client.leave(); // Or client.end() if host and wanting to end for all
        console.log('Successfully left the Zoom meeting.');
    } catch (leaveError) {
        console.error('Error leaving Zoom meeting:', leaveError);
        if (leaveError && typeof leaveError === 'object') {
            console.error('Leave error details:', JSON.stringify(leaveError));
        }
        // Don't necessarily throw, as user might be trying to clean up an already ended session
    }
};

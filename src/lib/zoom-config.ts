
import { ZoomMeetingConfig, ZoomJoinParams, ZoomJoinConfig, ZoomTokenData, MeetingStatus } from '@/types/zoom';

// Use the updated client ID as the SDK Key
const ZOOM_SDK_KEY = "dkQMavedS2OWM2c73F6pLg"; // Updated SDK Key (Client ID)
const SUPABASE_URL = 'https://qsxlvwwebbakmzpwjfbb.supabase.co';

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

// Legacy function name for backward compatibility
export const getSignature = getZoomAccessToken;

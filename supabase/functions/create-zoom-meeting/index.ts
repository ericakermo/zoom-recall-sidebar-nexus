import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import ZoomMtgEmbedded from "@zoom/meetingsdk/embedded";

const ZOOM_API_URL = 'https://api.zoom.us/v2'
const ZOOM_SDK_KEY = "eFAZ8Vf7RbG5saQVqL1zGA";
const SUPABASE_URL = 'https://qsxlvwwebbakmzpwjfbb.supabase.co';

// Configure CORS headers to allow requests from any origin
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the user's Zoom access token from your database
    const { data: { user } } = await supabaseClient.auth.getUser(req.headers.get('Authorization')?.split(' ')[1] ?? '')
    
    const { data: zoomConnection } = await supabaseClient
      .from('zoom_connections')
      .select('access_token')
      .eq('user_id', user.id)
      .single()

    if (!zoomConnection?.access_token) {
      return new Response(JSON.stringify({ error: 'No Zoom connection found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create a new meeting via Zoom API
    const response = await fetch(`${ZOOM_API_URL}/users/me/meetings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${zoomConnection.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        topic: 'Instant Meeting',
        type: 1, // Instant meeting
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          waiting_room: true
        }
      })
    })

    const meetingData = await response.json()
    
    return new Response(JSON.stringify(meetingData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}) 

export const initializeZoomClient = async (zoomAppRoot: HTMLElement) => {
  const client = ZoomMtgEmbedded.createClient();
  
  await client.init({
    debug: true,
    zoomAppRoot: zoomAppRoot,
    language: 'en-US',
    customize: {
      meetingInfo: ['topic', 'host', 'mn', 'pwd', 'tel', 'participant', 'dc', 'enctype'],
      toolbar: {
        buttons: [
          {
            text: 'Custom Button',
            className: 'CustomButton',
            onClick: () => {
              console.log('custom button');
            }
          }
        ]
      }
    }
  });

  return client;
};

export const joinMeeting = async (client: any, params: {
  meetingNumber: string;
  userName: string;
  userEmail?: string;
  password?: string;
}) => {
  try {
    const tokenData = localStorage.getItem('sb-qsxlvwwebbakmzpwjfbb-auth-token');
    if (!tokenData) {
      throw new Error('Authentication required');
    }
    
    const parsedToken = JSON.parse(tokenData);
    const authToken = parsedToken?.access_token;
    
    // Get signature from your edge function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-zoom-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ 
        meetingNumber: params.meetingNumber, 
        role: 0 // 0 for attendee, 1 for host
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get signature');
    }

    const { signature } = await response.json();

    await client.join({
      sdkKey: ZOOM_SDK_KEY,
      signature: signature,
      meetingNumber: params.meetingNumber,
      userName: params.userName,
      userEmail: params.userEmail,
      password: params.password
    });

  } catch (error) {
    console.error('Error joining meeting:', error);
    throw error;
  }
};

export const createMeeting = async (params: {
  topic?: string;
  type?: number;
  settings?: {
    host_video?: boolean;
    participant_video?: boolean;
    join_before_host?: boolean;
    mute_upon_entry?: boolean;
    waiting_room?: boolean;
  };
} = {}) => {
  const tokenData = localStorage.getItem('sb-qsxlvwwebbakmzpwjfbb-auth-token');
  if (!tokenData) {
    throw new Error('Authentication required');
  }
  
  const parsedToken = JSON.parse(tokenData);
  const authToken = parsedToken?.access_token;

  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-zoom-meeting`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error('Failed to create meeting');
  }

  return response.json();
};

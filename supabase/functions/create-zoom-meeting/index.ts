
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ZOOM_API_URL = 'https://api.zoom.us/v2'

// Configure CORS headers to allow requests from any origin
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  console.log("Create Zoom meeting function called with method:", req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS preflight request");
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Get the JWT from the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the JWT from the authorization header
    const token = authHeader.replace('Bearer ', '');
    
    // Verify the JWT to get the user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error("Invalid token or user not found:", userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("User authenticated:", user.id);

    // Get the user's Zoom connection from the database
    const { data: zoomConnection, error: connectionError } = await supabaseClient
      .from('zoom_connections')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .single();

    if (connectionError || !zoomConnection) {
      console.error("No Zoom connection found for user:", connectionError);
      return new Response(
        JSON.stringify({ error: 'No Zoom connection found. Please connect your Zoom account first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Zoom connection found for user");

    // Check if token has expired and refresh if needed
    const now = new Date();
    const expiresAt = new Date(zoomConnection.expires_at);
    let accessToken = zoomConnection.access_token;

    if (now >= expiresAt) {
      console.log("Access token expired, refreshing...");
      
      // Get Zoom OAuth credentials from environment
      const zoomClientId = Deno.env.get('ZOOM_CLIENT_ID');
      const zoomClientSecret = Deno.env.get('ZOOM_CLIENT_SECRET');
      
      if (!zoomClientId || !zoomClientSecret) {
        console.error("Missing Zoom OAuth credentials");
        return new Response(
          JSON.stringify({ error: 'Zoom OAuth not configured properly' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Refresh the access token
      const refreshResponse = await fetch('https://zoom.us/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${zoomClientId}:${zoomClientSecret}`)}`
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: zoomConnection.refresh_token
        })
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        console.error("Failed to refresh token:", errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to refresh Zoom token. Please reconnect your Zoom account.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenData = await refreshResponse.json();
      accessToken = tokenData.access_token;

      // Update the stored tokens
      const newExpiresAt = new Date(now.getTime() + (tokenData.expires_in * 1000));
      await supabaseClient
        .from('zoom_connections')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || zoomConnection.refresh_token,
          expires_at: newExpiresAt.toISOString()
        })
        .eq('user_id', user.id);

      console.log("Token refreshed successfully");
    }

    // Parse request body for meeting settings
    let meetingSettings = {};
    try {
      if (req.headers.get('content-type')?.includes('application/json')) {
        meetingSettings = await req.json();
        console.log("Received meeting settings:", meetingSettings);
      }
    } catch (e) {
      console.log("No JSON body provided, using default settings");
    }

    // Create a new meeting via Zoom API using the user's access token
    console.log("Creating new Zoom meeting with settings:", meetingSettings);
    const meetingPayload = {
      topic: meetingSettings.topic || 'Instant Meeting',
      type: meetingSettings.type || 2, // Scheduled meeting
      start_time: meetingSettings.start_time,
      duration: meetingSettings.duration || 30,
      timezone: meetingSettings.timezone || 'UTC',
      settings: {
        host_video: meetingSettings.settings?.host_video ?? true,
        participant_video: meetingSettings.settings?.participant_video ?? true,
        join_before_host: meetingSettings.settings?.join_before_host ?? false,
        mute_upon_entry: meetingSettings.settings?.mute_upon_entry ?? true,
        waiting_room: meetingSettings.settings?.waiting_room ?? true,
        ...meetingSettings.settings
      }
    };

    console.log("Final meeting payload:", JSON.stringify(meetingPayload, null, 2));

    const meetingResponse = await fetch(`${ZOOM_API_URL}/users/me/meetings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(meetingPayload)
    });

    if (!meetingResponse.ok) {
      const errorText = await meetingResponse.text();
      console.error("Failed to create meeting:", meetingResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `Failed to create Zoom meeting: ${errorText}` }),
        { status: meetingResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const meetingData = await meetingResponse.json();
    console.log("Meeting created successfully:", meetingData.id);

    // Store the meeting in our database
    try {
      const { data: storedMeeting, error: storeError } = await supabaseClient
        .from('zoom_meetings')
        .insert({
          user_id: user.id,
          meeting_id: meetingData.id.toString(),
          title: meetingData.topic,
          start_time: meetingData.start_time,
          duration: meetingData.duration,
          join_url: meetingData.join_url,
        })
        .select()
        .single();

      if (storeError) {
        console.error("Failed to store meeting in database:", storeError);
        // Don't fail the entire request if we can't store it
      } else {
        console.log("Meeting stored in database:", storedMeeting.id);
      }
    } catch (dbError) {
      console.error("Database error:", dbError);
      // Continue even if database storage fails
    }
    
    return new Response(JSON.stringify({
      id: meetingData.id,
      topic: meetingData.topic,
      join_url: meetingData.join_url,
      start_url: meetingData.start_url,
      password: meetingData.password,
      start_time: meetingData.start_time,
      duration: meetingData.duration,
      meetingNumber: meetingData.id.toString(),
      success: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating meeting:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      details: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

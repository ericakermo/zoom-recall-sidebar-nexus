
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  console.log("Create Zoom meeting function called with method:", req.method);
  
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error("Invalid token or user not found:", userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("User authenticated:", user.id);

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
      
      const refreshResponse = await fetch('https://zoom.us/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${base64Encode(`${Deno.env.get('ZOOM_CLIENT_ID')}:${Deno.env.get('ZOOM_CLIENT_SECRET')}`)}`
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

      await supabaseClient
        .from('zoom_connections')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || zoomConnection.refresh_token,
          expires_at: new Date(now.getTime() + (tokenData.expires_in * 1000)).toISOString()
        })
        .eq('user_id', user.id);

      console.log("Token refreshed successfully");
    }
    
    const requestBody = await req.json();
    console.log("Received meeting settings:", requestBody);

    // Use the exact start time from the request for scheduled meetings
    const startTime = new Date(requestBody.start_time);
    const duration = requestBody.duration || 30; // Ensure duration is always set
    
    console.log("Meeting start time set to:", startTime.toISOString());
    console.log("Meeting duration set to:", duration, "minutes");
    
    const meetingPayload = {
      topic: requestBody.topic || 'Meeting',
      type: requestBody.type || 2, // Use the type from request (2 for scheduled)
      start_time: startTime.toISOString(),
      duration: duration,
      timezone: requestBody.timezone || 'UTC',
      settings: {
        host_video: requestBody.settings?.host_video ?? true,
        participant_video: requestBody.settings?.participant_video ?? true,
        join_before_host: requestBody.settings?.join_before_host ?? false,
        mute_upon_entry: requestBody.settings?.mute_upon_entry ?? true,
        waiting_room: requestBody.settings?.waiting_room ?? true,
        approval_type: 0,
        auto_recording: 'none',
        enforce_login: false,
        enforce_login_domains: '',
        alternative_hosts: '',
        close_registration: false,
        show_share_button: false,
        allow_multiple_devices: true,
        registrants_confirmation_email: false,
        registrants_email_notification: false
      }
    };

    console.log("Final meeting payload:", JSON.stringify(meetingPayload, null, 2));

    const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(meetingPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Zoom API error:", errorText);
      return new Response(
        JSON.stringify({ error: `Failed to create meeting: ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const meetingData = await response.json();
    console.log("Meeting created successfully:", {
      id: meetingData.id,
      topic: meetingData.topic,
      startTime: meetingData.start_time,
      duration: meetingData.duration,
      joinUrl: meetingData.join_url
    });

    // Store meeting in database with proper duration
    const { error: insertError } = await supabaseClient
      .from('zoom_meetings')
      .insert({
        user_id: user.id,
        meeting_id: meetingData.id.toString(),
        title: meetingData.topic,
        start_time: startTime.toISOString(),
        duration: meetingData.duration || duration, // Ensure duration is saved
        join_url: meetingData.join_url
      });

    if (insertError) {
      console.error("Failed to store meeting in database:", insertError);
    } else {
      console.log("Meeting stored in database successfully");
    }

    return new Response(
      JSON.stringify({
        meetingNumber: meetingData.id.toString(),
        meetingId: meetingData.id,
        topic: meetingData.topic,
        startTime: startTime.toISOString(),
        joinUrl: meetingData.join_url,
        password: meetingData.password || '',
        duration: meetingData.duration || duration,
        status: 'created',
        useComponentView: true
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('Error in create-zoom-meeting function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});

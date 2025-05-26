
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  console.log("Validate meeting status function called with method:", req.method);
  
  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS preflight request");
    return new Response(null, { headers: corsHeaders });
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

    const { meetingId } = await req.json();
    
    if (!meetingId) {
      return new Response(
        JSON.stringify({ error: 'Meeting ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Validating meeting status for:", meetingId);

    // Get Zoom connection for the user
    const { data: zoomConnection, error: connectionError } = await supabaseClient
      .from('zoom_connections')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .single();

    if (connectionError || !zoomConnection) {
      console.error("No Zoom connection found for user:", connectionError);
      return new Response(
        JSON.stringify({ 
          canJoin: false, 
          reason: 'No Zoom connection found. Please connect your Zoom account first.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
          'Authorization': `Basic ${btoa(`${Deno.env.get('ZOOM_CLIENT_ID')}:${Deno.env.get('ZOOM_CLIENT_SECRET')}`)}`
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: zoomConnection.refresh_token
        })
      });

      if (!refreshResponse.ok) {
        console.error("Failed to refresh token");
        return new Response(
          JSON.stringify({ 
            canJoin: false, 
            reason: 'Failed to refresh Zoom token. Please reconnect your Zoom account.' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    }

    // Get meeting details from Zoom
    console.log("Fetching meeting details from Zoom API");
    const meetingResponse = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!meetingResponse.ok) {
      if (meetingResponse.status === 404) {
        return new Response(
          JSON.stringify({ 
            canJoin: false, 
            reason: 'Meeting not found or has been deleted' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const errorText = await meetingResponse.text();
      console.error("Failed to get meeting details:", errorText);
      return new Response(
        JSON.stringify({ 
          canJoin: false, 
          reason: 'Failed to validate meeting status' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const meetingData = await meetingResponse.json();
    console.log("Meeting data retrieved:", {
      status: meetingData.status,
      type: meetingData.type,
      start_time: meetingData.start_time
    });

    // Validate meeting status
    const currentTime = new Date();
    const startTime = new Date(meetingData.start_time);
    const endTime = new Date(startTime.getTime() + (meetingData.duration * 60000));

    let canJoin = true;
    let reason = '';

    // Check if meeting has ended
    if (currentTime > endTime) {
      canJoin = false;
      reason = 'Meeting has already ended';
    }
    // Check if it's an instant meeting (type 1) or scheduled meeting (type 2)
    else if (meetingData.type === 2) {
      // For scheduled meetings, check if it's too early
      const allowedEarlyJoin = 10 * 60 * 1000; // 10 minutes before start time
      if (currentTime < new Date(startTime.getTime() - allowedEarlyJoin)) {
        canJoin = false;
        reason = 'Meeting has not started yet. You can join 10 minutes before the scheduled start time.';
      }
    }

    return new Response(
      JSON.stringify({ 
        canJoin, 
        reason,
        meetingStatus: meetingData.status,
        startTime: meetingData.start_time,
        duration: meetingData.duration,
        joinBeforeHost: meetingData.settings?.join_before_host || false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error validating meeting status:', error);
    return new Response(
      JSON.stringify({ 
        canJoin: false, 
        reason: 'Internal server error while validating meeting status' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

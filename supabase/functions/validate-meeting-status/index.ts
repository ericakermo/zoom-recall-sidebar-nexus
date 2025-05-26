
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId } = await req.json();
    console.log('Validating meeting status for:', meetingId);

    if (!meetingId) {
      throw new Error('Meeting ID is required');
    }

    // Get Zoom access token from secrets
    const zoomClientId = Deno.env.get('ZOOM_CLIENT_ID');
    const zoomClientSecret = Deno.env.get('ZOOM_CLIENT_SECRET');

    if (!zoomClientId || !zoomClientSecret) {
      throw new Error('Zoom credentials not configured');
    }

    // Get Zoom OAuth token
    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${zoomClientId}:${zoomClientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get Zoom access token');
    }

    const tokenData = await tokenResponse.json();

    // Get meeting details from Zoom API
    const meetingResponse = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      }
    });

    if (!meetingResponse.ok) {
      if (meetingResponse.status === 404) {
        return new Response(
          JSON.stringify({
            canJoin: false,
            reason: 'Meeting not found or has been deleted',
            status: 'not_found'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      }
      throw new Error(`Zoom API error: ${meetingResponse.statusText}`);
    }

    const meetingData = await meetingResponse.json();
    console.log('Meeting data from Zoom:', meetingData);

    // Validate meeting status and timing
    const now = new Date();
    const startTime = new Date(meetingData.start_time);
    const duration = meetingData.duration || 60; // Default 60 minutes
    const endTime = new Date(startTime.getTime() + duration * 60000);

    let canJoin = true;
    let reason = '';
    let status = 'ready';

    // Check if meeting has ended
    if (now > endTime) {
      canJoin = false;
      reason = 'Meeting has ended';
      status = 'ended';
    }
    // Check if meeting hasn't started yet (allow 10 minutes early)
    else if (now < new Date(startTime.getTime() - 10 * 60000)) {
      canJoin = false;
      reason = 'Meeting has not started yet';
      status = 'not_started';
    }
    // Check meeting status from Zoom
    else if (meetingData.status === 'waiting') {
      canJoin = true;
      reason = 'Meeting is in waiting room';
      status = 'waiting';
    }
    else if (meetingData.status === 'started') {
      canJoin = true;
      reason = 'Meeting is in progress';
      status = 'started';
    }

    return new Response(
      JSON.stringify({
        canJoin,
        reason,
        status,
        meetingData: {
          id: meetingData.id,
          topic: meetingData.topic,
          start_time: meetingData.start_time,
          duration: meetingData.duration,
          status: meetingData.status,
          settings: {
            waiting_room: meetingData.settings?.waiting_room,
            join_before_host: meetingData.settings?.join_before_host,
            password: meetingData.settings?.password
          }
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error validating meeting status:', error);
    return new Response(
      JSON.stringify({
        canJoin: false,
        reason: error.message || 'Failed to validate meeting status',
        status: 'error'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  }
});

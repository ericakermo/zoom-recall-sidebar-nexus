
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

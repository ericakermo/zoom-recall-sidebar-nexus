
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Supabase URL and service role key from environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase configuration')
    }

    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { user_id } = await req.json()

    if (!user_id) {
      throw new Error('User ID is required')
    }

    // Get user's Zoom token from Supabase
    const { data: zoomConnection, error: connectionError } = await supabaseAdmin
      .from('zoom_connections')
      .select('access_token')
      .eq('user_id', user_id)
      .single()

    if (connectionError || !zoomConnection) {
      throw new Error('No Zoom connection found for this user')
    }

    // Fetch meetings from Zoom API
    const zoomResponse = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      headers: {
        'Authorization': `Bearer ${zoomConnection.access_token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!zoomResponse.ok) {
      const errorData = await zoomResponse.json()
      throw new Error(`Zoom API error: ${errorData.message || 'Unknown error'}`)
    }

    const meetingsData = await zoomResponse.json()
    const meetings = meetingsData.meetings || []

    console.log(`Found ${meetings.length} meetings for user ${user_id}`)

    // Store meetings in Supabase
    for (const meeting of meetings) {
      const { error: upsertError } = await supabaseAdmin
        .from('zoom_meetings')
        .upsert({
          user_id,
          meeting_id: meeting.id.toString(),
          title: meeting.topic || 'Untitled Meeting',
          start_time: meeting.start_time,
          duration: meeting.duration || 60,
          join_url: meeting.join_url || '',
        }, {
          onConflict: 'user_id,meeting_id',
        })

      if (upsertError) {
        console.error('Error upserting meeting:', upsertError)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced_meetings: meetings.length 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in sync-zoom-meetings:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

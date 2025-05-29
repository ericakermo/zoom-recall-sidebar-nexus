
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts'

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

    console.log(`Starting meeting sync for user: ${user_id}`)

    // Get user's Zoom token from Supabase
    const { data: zoomConnection, error: connectionError } = await supabaseAdmin
      .from('zoom_connections')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user_id)
      .single()

    if (connectionError || !zoomConnection) {
      console.error('No Zoom connection found for user:', connectionError)
      throw new Error('No Zoom connection found for this user')
    }

    console.log('Zoom connection found, checking token validity...')

    // Check if token has expired and refresh if needed
    const now = new Date()
    const expiresAt = new Date(zoomConnection.expires_at)
    let accessToken = zoomConnection.access_token

    if (now >= expiresAt) {
      console.log('Access token expired, refreshing...')
      
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
      })

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text()
        console.error('Failed to refresh token:', errorText)
        throw new Error('Failed to refresh Zoom token. Please reconnect your Zoom account.')
      }

      const tokenData = await refreshResponse.json()
      accessToken = tokenData.access_token

      // Update the stored tokens
      const newExpiresAt = new Date(now.getTime() + (tokenData.expires_in * 1000))
      const { error: updateError } = await supabaseAdmin
        .from('zoom_connections')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || zoomConnection.refresh_token,
          expires_at: newExpiresAt.toISOString()
        })
        .eq('user_id', user_id)

      if (updateError) {
        console.error('Failed to update refreshed tokens:', updateError)
      } else {
        console.log('Token refreshed and updated successfully')
      }
    } else {
      console.log('Access token is still valid')
    }

    // Fetch meetings from Zoom API with refreshed/valid token
    console.log('Fetching meetings from Zoom API...')
    const zoomResponse = await fetch('https://api.zoom.us/v2/users/me/meetings?type=scheduled&page_size=300', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!zoomResponse.ok) {
      const errorData = await zoomResponse.json()
      console.error('Zoom API error:', errorData)
      throw new Error(`Zoom API error: ${errorData.message || 'Unknown error'}`)
    }

    const meetingsData = await zoomResponse.json()
    const meetings = meetingsData.meetings || []

    console.log(`Found ${meetings.length} meetings for user ${user_id}`)

    // Store meetings in Supabase
    let syncedCount = 0
    for (const meeting of meetings) {
      try {
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
          console.error('Error upserting meeting:', meeting.id, upsertError)
        } else {
          syncedCount++
        }
      } catch (error) {
        console.error('Error processing meeting:', meeting.id, error)
      }
    }

    console.log(`Successfully synced ${syncedCount} meetings`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced_meetings: syncedCount,
        total_found: meetings.length
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

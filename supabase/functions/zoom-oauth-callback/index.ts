
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Set the Zoom OAuth credentials
const ZOOM_CLIENT_ID = "eFAZ8Vf7RbG5saQVqL1zGA";
const ZOOM_CLIENT_SECRET = "iopNR5wnxdK3mEIVE1llzQqAWbxXEB1l";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Parse the URL to get the code and state
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') // This should be the user ID
    const error = url.searchParams.get('error')

    if (error) {
      console.error('OAuth error:', error)
      return Response.redirect(`${Deno.env.get('CLIENT_URL') || ''}/settings?error=${encodeURIComponent(error)}`)
    }

    if (!code || !state) {
      console.error('Missing code or state')
      return Response.redirect(`${Deno.env.get('CLIENT_URL') || ''}/settings?error=missing_params`)
    }

    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Exchange the code for an access token
    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${Deno.env.get('SUPABASE_URL') || ''}/functions/v1/zoom-oauth-callback`,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('Zoom token error:', errorData)
      return Response.redirect(`${Deno.env.get('CLIENT_URL') || ''}/settings?error=${encodeURIComponent(errorData.error)}`)
    }

    const tokenData = await tokenResponse.json()
    
    // Save the tokens in the database
    const { error: dbError } = await supabaseAdmin
      .from('zoom_connections')
      .upsert({
        user_id: state,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return Response.redirect(`${Deno.env.get('CLIENT_URL') || ''}/settings?error=database_error`)
    }

    // Redirect back to the app
    return Response.redirect(`${Deno.env.get('CLIENT_URL') || ''}/settings?success=true`)
  } catch (error) {
    console.error('Error:', error)
    return Response.redirect(`${Deno.env.get('CLIENT_URL') || ''}/settings?error=${encodeURIComponent(error.message)}`)
  }
})

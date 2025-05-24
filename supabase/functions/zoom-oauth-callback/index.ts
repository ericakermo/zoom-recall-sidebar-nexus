

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Set the Zoom OAuth credentials
const ZOOM_CLIENT_ID = "dkQMavedS2OWM2c73F6pLg";
const ZOOM_CLIENT_SECRET = "CFDxugjp3CkE3G07z4eC1qcGjukmYVdt";

// Define default client URL for redirects - use this if environment variable is not set
const DEFAULT_CLIENT_URL = "https://qsxlvwwebbakmzpwjfbb.supabase.co";

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

    // Get the client URL for redirects
    const clientUrl = Deno.env.get('CLIENT_URL') || DEFAULT_CLIENT_URL;

    if (error) {
      console.error('OAuth error:', error)
      return Response.redirect(`${clientUrl}/settings?error=${encodeURIComponent(error)}`)
    }

    if (!code || !state) {
      console.error('Missing code or state')
      return Response.redirect(`${clientUrl}/settings?error=missing_params`)
    }

    // Get Supabase URL and service role key from environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://qsxlvwwebbakmzpwjfbb.supabase.co';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseServiceRoleKey) {
      console.error('Missing Supabase service role key');
      return Response.redirect(`${clientUrl}/settings?error=server_configuration`);
    }

    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
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
        redirect_uri: `${supabaseUrl}/functions/v1/zoom-oauth-callback`,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('Zoom token error:', errorData)
      return Response.redirect(`${clientUrl}/settings?error=${encodeURIComponent(errorData.error)}`)
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
      return Response.redirect(`${clientUrl}/settings?error=database_error`)
    }

    // Redirect back to the app
    return Response.redirect(`${clientUrl}/settings?success=true`)
  } catch (error) {
    console.error('Error:', error)
    const clientUrl = Deno.env.get('CLIENT_URL') || DEFAULT_CLIENT_URL;
    return Response.redirect(`${clientUrl}/settings?error=${encodeURIComponent(error.message)}`)
  }
})


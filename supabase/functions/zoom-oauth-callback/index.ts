
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  
  try {
    // Parse the URL to get the authorization code
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    if (!code) {
      return new Response(
        JSON.stringify({ error: 'No authorization code provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    // Get Zoom OAuth credentials
    const clientId = Deno.env.get('ZOOM_CLIENT_ID');
    const clientSecret = Deno.env.get('ZOOM_CLIENT_SECRET');
    const redirectUri = `${url.origin}/api/zoom-oauth-callback`;
    
    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Zoom OAuth credentials not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    // Exchange the code for an access token
    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      console.error('Error exchanging code for token:', tokenData);
      return Response.redirect(`${url.origin}/settings?error=oauth_failed`, 302);
    }
    
    const { access_token, refresh_token, expires_in } = tokenData;
    
    // Calculate expiry timestamp
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);
    
    // Parse the user ID from the state parameter
    const userId = state;
    if (!userId) {
      return Response.redirect(`${url.origin}/settings?error=invalid_state`, 302);
    }
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return Response.redirect(`${url.origin}/settings?error=server_config`, 302);
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Store the tokens in the database
    const { error: upsertError } = await supabase
      .from('zoom_connections')
      .upsert({
        user_id: userId,
        access_token,
        refresh_token,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (upsertError) {
      console.error('Error storing Zoom tokens:', upsertError);
      return Response.redirect(`${url.origin}/settings?error=db_error`, 302);
    }
    
    // Redirect back to the app
    return Response.redirect(`${url.origin}/settings?success=zoom_connected`, 302);
    
  } catch (error) {
    console.error('Error in Zoom OAuth callback:', error);
    return Response.redirect(`${url.origin}/settings?error=server_error`, 302);
  }
});

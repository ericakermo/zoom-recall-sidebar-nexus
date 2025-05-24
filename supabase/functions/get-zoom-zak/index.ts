
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  console.log("Get Zoom ZAK function called with method:", req.method);
  
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

    console.log("User authenticated for ZAK token:", user.id);

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

    console.log("Zoom connection found, requesting ZAK token");

    // Check if token has expired and refresh if needed
    const now = new Date();
    const expiresAt = new Date(zoomConnection.expires_at);
    let accessToken = zoomConnection.access_token;

    if (now >= expiresAt) {
      console.log("Access token expired, refreshing before getting ZAK...");
      
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

      console.log("Token refreshed successfully before ZAK request");
    }

    // Get ZAK token from Zoom
    console.log("Requesting ZAK token from Zoom API");
    const zakResponse = await fetch('https://api.zoom.us/v2/users/me/token?type=zak', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!zakResponse.ok) {
      const errorText = await zakResponse.text();
      console.error("Failed to get ZAK token:", errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to get ZAK token from Zoom API' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const zakData = await zakResponse.json();
    console.log("ZAK token retrieved successfully");
    
    return new Response(
      JSON.stringify({ zak: zakData.token }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error getting ZAK token:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

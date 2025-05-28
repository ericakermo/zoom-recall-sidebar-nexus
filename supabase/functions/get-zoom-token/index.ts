
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  console.log("Get Zoom token function called with method:", req.method);
  
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
    
    const { meetingNumber, role, expirationSeconds } = await req.json();
    
    console.log("Generating token for:", {
      meetingNumber,
      role: role === 1 ? 'host' : 'participant',
      expirationSeconds: expirationSeconds || 7200
    });
    
    // Generate enhanced JWT signature with correct parameters
    const iat = Math.floor(Date.now() / 1000);
    const exp = expirationSeconds ? iat + expirationSeconds : iat + 7200;
    
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      sdkKey: Deno.env.get('ZOOM_CLIENT_ID'),
      appKey: Deno.env.get('ZOOM_CLIENT_ID'), // Required field
      mn: meetingNumber,
      role,
      iat,
      exp,
      tokenExp: exp, // Required field
      alg: 'HS256'
    };

    console.log("Enhanced JWT payload created:", {
      meetingNumber: payload.mn,
      role: payload.role,
      sdkKey: payload.sdkKey ? 'present' : 'missing',
      appKey: payload.appKey ? 'present' : 'missing',
      tokenExpiration: new Date(payload.exp * 1000).toISOString(),
      issuedAt: new Date(payload.iat * 1000).toISOString()
    });

    const encodedHeader = base64Encode(JSON.stringify(header));
    const encodedPayload = base64Encode(JSON.stringify(payload));
    
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(Deno.env.get('ZOOM_CLIENT_SECRET')),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ).then(key => crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signatureInput)))
      .then(signature => base64Encode(new Uint8Array(signature)));
    
    const jwt = `${encodedHeader}.${encodedPayload}.${signature}`;
    
    console.log("Enhanced JWT signature generated successfully");
    
    return new Response(
      JSON.stringify({ 
        accessToken,
        tokenType: 'Bearer',
        sdkKey: Deno.env.get('ZOOM_CLIENT_ID'),
        signature: jwt,
        meetingNumber: String(meetingNumber),
        role: Number(role) || 0
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
    console.error('Error in get-zoom-token function:', error);
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

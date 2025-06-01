
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.4/mod.ts'

// Configure CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// Zoom OAuth credentials
const ZOOM_ACCOUNT_ID = Deno.env.get('ZOOM_ACCOUNT_ID') || '';
const ZOOM_CLIENT_ID = Deno.env.get('ZOOM_CLIENT_ID') || '';
const ZOOM_CLIENT_SECRET = Deno.env.get('ZOOM_CLIENT_SECRET') || '';

if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
  console.error("Missing required Zoom environment variables");
  throw new Error("Missing required Zoom environment variables");
}

serve(async (req) => {
  console.log("Function called with method:", req.method);
  
  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS preflight request");
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') || 'https://qsxlvwwebbakmzpwjfbb.supabase.co',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
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

    let requestData;
    try {
      requestData = await req.json();
      console.log("Request data:", requestData);
    } catch (e) {
      console.error("Error parsing request body:", e);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { meetingNumber, role = 0 } = requestData;
    
    if (!meetingNumber) {
      console.error("Missing meeting number:", requestData);
      return new Response(
        JSON.stringify({ error: 'Missing meeting number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Getting OAuth access token for Zoom");
    
    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: ZOOM_ACCOUNT_ID
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Failed to get OAuth token:", errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate with Zoom' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    console.log("Successfully obtained OAuth access token");

    // Generate JWT signature for SDK authentication
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: ZOOM_CLIENT_ID,
      aud: 'zoom',
      iat: now,
      exp: now + (60 * 60), // 1 hour expiration
      alg: 'HS256',
      appKey: ZOOM_CLIENT_ID,
      tokenExp: now + (60 * 60),
      meetingNumber: String(meetingNumber),
      role: Number(role)
    };

    const signature = await create(
      { alg: 'HS256', typ: 'JWT' },
      payload,
      ZOOM_CLIENT_SECRET
    );

    console.log("Generated signature for meeting:", meetingNumber);
    
    return new Response(
      JSON.stringify({ 
        accessToken: tokenData.access_token,
        tokenType: tokenData.token_type || 'Bearer',
        sdkKey: ZOOM_CLIENT_ID,
        signature: signature,
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
    console.error('Error:', error);
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

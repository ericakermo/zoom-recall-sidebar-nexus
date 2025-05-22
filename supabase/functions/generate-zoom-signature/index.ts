import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as encodeBase64 } from 'https://deno.land/std@0.168.0/encoding/base64.ts'
import { hmac } from "https://deno.land/x/crypto@v0.10.0/hmac.ts";

// Configure CORS headers to allow requests from any origin
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// Set the Zoom SDK credentials
const ZOOM_API_KEY = "eFAZ8Vf7RbG5saQVqL1zGA";
const ZOOM_API_SECRET = "iopNR5wnxdK3mEIVE1llzQqAWbxXEB1l";

serve(async (req) => {
  console.log("Function called with method:", req.method);
  
  // Handle CORS preflight requests
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

    // Get the JWT from the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the JWT from the authorization header
    const token = authHeader.replace('Bearer ', '');
    
    // Verify the JWT to get the user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error("Invalid token or user not found:", userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the request body
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

    // Current timestamp in milliseconds, subtract 30 seconds
    const timestamp = new Date().getTime() - 30000;
    
    // Format meeting number as string
    const formattedMeetingNumber = String(meetingNumber);
    
    // Format role as number
    const numericRole = Number(role) || 0;
    
    // Create the message string exactly as required by Zoom
    const msg = `${ZOOM_API_KEY}${formattedMeetingNumber}${timestamp}${numericRole}`;
    
    // Sign the message using HMAC SHA256
    const msgUint8 = new TextEncoder().encode(msg);
    const keyUint8 = new TextEncoder().encode(ZOOM_API_SECRET);
    const hmacSignature = hmac("sha256", keyUint8, msgUint8);
    
    // Base64 encode the signature
    const signature = encodeBase64(hmacSignature);
    
    console.log(`Generated signature for meeting ${meetingNumber} with role ${numericRole}`);
    console.log(`Message used for signing: ${msg}`);
    
    return new Response(
      JSON.stringify({ 
        signature,
        sdkKey: ZOOM_API_KEY,
        timestamp,
        meetingNumber: formattedMeetingNumber,
        role: numericRole
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

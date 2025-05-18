
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hmac } from "https://deno.land/x/crypto@v0.10.0/hmac.ts";
import { encode as encodeBase64 } from 'https://deno.land/std@0.168.0/encoding/base64.ts'

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
    } catch (e) {
      console.error("Error parsing request body:", e);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { meetingNumber, role } = requestData;

    if (!meetingNumber || role === undefined) {
      console.error("Missing parameters:", { meetingNumber, role });
      return new Response(
        JSON.stringify({ error: 'Missing parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate the signature
    const timestamp = new Date().getTime() - 30000;
    const msg = Buffer.from(ZOOM_API_KEY + meetingNumber + timestamp + role).toString();
    
    // Using hmac instead of createHmac
    const hmacSignature = hmac("sha256", ZOOM_API_SECRET, msg);
    const signature = encodeBase64(hmacSignature);

    console.log("Signature generated successfully");
    return new Response(
      JSON.stringify({ signature }),
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

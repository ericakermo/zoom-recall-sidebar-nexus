
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://qsxlvwwebbakmzpwjfbb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzeGx2d3dlYmJha216cHdqZmJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1Nzk5MTEsImV4cCI6MjA2MzE1NTkxMX0.KVICB5llAG7xKB-2ZpskvvF78ekJ0Hkd8ZEHubsi7g8";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

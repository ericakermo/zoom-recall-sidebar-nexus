
// This is a helper file to define types for tables not present in the auto-generated types
// These types can be used with Supabase client when the auto-generated types don't include them

export interface ZoomConnection {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface ZoomMeeting {
  id: string;
  user_id: string;
  meeting_id: string;
  title: string;
  start_time: string;
  duration: number;
  join_url: string;
  created_at: string;
  updated_at: string;
}

// Add this declaration to extend the Supabase Database types
declare module '@supabase/supabase-js' {
  interface Database {
    public: {
      Tables: {
        zoom_connections: {
          Row: ZoomConnection;
          Insert: Omit<ZoomConnection, 'id' | 'created_at' | 'updated_at'>;
          Update: Partial<Omit<ZoomConnection, 'id' | 'created_at' | 'updated_at'>>;
        };
        zoom_meetings: {
          Row: ZoomMeeting;
          Insert: Omit<ZoomMeeting, 'id' | 'created_at' | 'updated_at'>;
          Update: Partial<Omit<ZoomMeeting, 'id' | 'created_at' | 'updated_at'>>;
        };
      };
    };
  }
}

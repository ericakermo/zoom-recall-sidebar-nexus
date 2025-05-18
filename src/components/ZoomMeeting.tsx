
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { loadZoomSDK, initializeZoomMeeting, getSignature } from '@/lib/zoom-config';
import { ZoomMeetingConfig } from '@/types/zoom';
import { useAuth } from '@/context/AuthContext';

interface ZoomMeetingProps {
  meetingNumber: string;
  userName?: string;
  role?: number;
  onMeetingEnd?: () => void;
}

export function ZoomMeeting({
  meetingNumber,
  userName: providedUserName,
  role = 0,
  onMeetingEnd
}: ZoomMeetingProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const initializeZoom = async () => {
      try {
        setIsLoading(true);
        
        // Load Zoom SDK
        await loadZoomSDK();

        // Get user's Zoom connection from Supabase
        // Use type assertion to work around TypeScript issue with the zoom_connections table
        const { data: zoomConnection, error: dbError } = await supabase
          .from('zoom_connections' as any)
          .select('*')
          .eq('user_id', user?.id)
          .single();

        if (dbError || !zoomConnection) {
          throw new Error('No Zoom connection found. Please connect your Zoom account first.');
        }

        // Get meeting signature from your backend
        const signature = await getSignature(meetingNumber, role);

        const meetingConfig: ZoomMeetingConfig = {
          signature,
          meetingNumber,
          userName: providedUserName || user?.email || 'Guest',
          apiKey: import.meta.env.VITE_ZOOM_API_KEY!,
          role,
        };

        // Initialize Zoom Meeting
        const zoomClient = await initializeZoomMeeting(meetingConfig);

        // Join the meeting
        await zoomClient.join({
          ...meetingConfig,
          success: () => {
            console.log('Successfully joined the meeting');
            setIsLoading(false);
          },
          error: (error: any) => {
            console.error('Failed to join meeting:', error);
            setError('Failed to join the meeting. Please try again.');
            setIsLoading(false);
          }
        });

      } catch (err: any) {
        console.error('Error initializing Zoom:', err);
        setError(err.message || 'Failed to initialize Zoom meeting');
        setIsLoading(false);
      }
    };

    initializeZoom();

    // Cleanup function
    return () => {
      if (window.ZoomMtg) {
        window.ZoomMtg.leaveMeeting({
          success: () => {
            console.log('Left the meeting');
            onMeetingEnd?.();
          },
          error: (error: any) => {
            console.error('Error leaving meeting:', error);
          }
        });
      }
    };
  }, [meetingNumber, providedUserName, role, user, onMeetingEnd]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => navigate('/settings')}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Connect Zoom Account
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div id="zmmtg-root" className="w-full h-full" />
  );
}

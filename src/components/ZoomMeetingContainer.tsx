
import { useEffect, useRef, useState } from 'react';
import { getZoomAccessToken } from '@/lib/zoom-config';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

const ZOOM_SDK_KEY = "eFAZ8Vf7RbG5saQVqL1zGA";

interface ZoomMeetingContainerProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  client: any;
  onMeetingJoined: () => void;
  onMeetingError: (error: string) => void;
}

export function ZoomMeetingContainer({
  meetingNumber,
  meetingPassword,
  userName: providedUserName,
  role = 0,
  client,
  onMeetingJoined,
  onMeetingError
}: ZoomMeetingContainerProps) {
  const [containerReady, setContainerReady] = useState(false);
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Container setup
  useEffect(() => {
    if (!zoomContainerRef.current) return;
    
    const container = zoomContainerRef.current;
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.minHeight = '500px';
    container.id = 'meetingSDKElement';
    
    setTimeout(() => {
      if (container.offsetWidth > 0 && container.offsetHeight > 0) {
        setContainerReady(true);
      }
    }, 300);
  }, []);

  // Initialize and join meeting
  useEffect(() => {
    if (!containerReady || !client || !meetingNumber) return;

    const initializeAndJoin = async () => {
      try {
        // Get OAuth access token
        const tokenData = await getZoomAccessToken(meetingNumber, role || 0);
        console.log("Token data received:", {
          hasToken: !!tokenData.accessToken,
          sdkKey: tokenData.sdkKey
        });

        // Ensure sdkKey is never empty
        const sdkKey = tokenData.sdkKey || ZOOM_SDK_KEY;
        if (!sdkKey) {
          throw new Error('SDK Key is required and cannot be empty');
        }

        console.log("Initializing with sdkKey:", sdkKey);

        // Initialize client with Component SDK pattern
        await client.init({
          zoomAppRoot: zoomContainerRef.current,
          language: 'en-US',
          sdkKey: sdkKey,
          debug: true,
          isSupportAV: true,
          isSupportChat: true,
          screenShare: true,
          success: () => {
            console.log('Zoom client initialized successfully');
          },
          error: (error: any) => {
            console.error('Zoom client initialization failed:', error);
            onMeetingError(`Initialization failed: ${error.message || 'Unknown error'}`);
          }
        });

        // Join meeting - Component SDK pattern
        await client.join({
          sdkKey: sdkKey,
          signature: tokenData.accessToken, // In Component SDK, use signature field for OAuth token
          meetingNumber: meetingNumber,
          userName: providedUserName || user?.email || 'Guest',
          userEmail: user?.email || '',
          passWord: meetingPassword || '',
          success: () => {
            console.log('Successfully joined meeting');
            onMeetingJoined();
            toast({
              title: "Meeting Joined",
              description: "You have successfully joined the Zoom meeting"
            });
          },
          error: (error: any) => {
            console.error('Failed to join meeting:', error);
            onMeetingError(`Failed to join: ${error.message || 'Unknown error'}`);
          }
        });

      } catch (err: any) {
        console.error('Error during meeting setup:', err);
        onMeetingError(err.message || 'Failed to setup meeting');
      }
    };

    initializeAndJoin();
  }, [containerReady, client, meetingNumber, meetingPassword, providedUserName, role, user, onMeetingJoined, onMeetingError, toast]);

  return (
    <div 
      ref={zoomContainerRef} 
      className="w-full h-full min-h-[500px]"
      style={{ position: 'relative', height: '100%', width: '100%' }}
    />
  );
}

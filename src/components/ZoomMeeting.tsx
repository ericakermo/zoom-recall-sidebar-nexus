import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadZoomSDK, createAndInitializeZoomClient, getSignature, joinZoomMeeting, leaveZoomMeeting } from '@/lib/zoom-config';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

interface ZoomMeetingProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingEnd?: () => void;
}

const ZOOM_SDK_KEY = "eFAZ8Vf7RbG5saQVqL1zGA";
const SUPABASE_URL = 'https://qsxlvwwebbakmzpwjfbb.supabase.co';

export function ZoomMeeting({
  meetingNumber,
  meetingPassword,
  userName: providedUserName,
  role = 0,
  onMeetingEnd
}: ZoomMeetingProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [containerReady, setContainerReady] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const zoomClientRef = useRef<any>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // Handle meeting controls
  const toggleMute = () => {
    if (!window.ZoomMtgEmbedded) return;
    
    if (isMuted) {
      window.ZoomMtgEmbedded.unmuteAudio();
      setIsMuted(false);
    } else {
      window.ZoomMtgEmbedded.muteAudio();
      setIsMuted(true);
    }
  };

  const toggleVideo = () => {
    if (!window.ZoomMtgEmbedded) return;
    
    if (isVideoOff) {
      window.ZoomMtgEmbedded.startVideo();
      setIsVideoOff(false);
    } else {
      window.ZoomMtgEmbedded.stopVideo();
      setIsVideoOff(true);
    }
  };

  const leaveMeeting = () => {
    if (zoomClientRef.current) {
      leaveZoomMeeting(zoomClientRef.current)
        .then(() => {
          console.log('Left the meeting');
          setIsConnected(false);
          onMeetingEnd?.();
        })
        .catch((error: any) => {
          console.error('Error leaving meeting:', error);
        });
    }
  };

  // Container setup check
  useEffect(() => {
    if (!zoomContainerRef.current) return;
    
    console.log('Starting container setup check');
    
    const container = zoomContainerRef.current;
    const parentElement = container.parentElement;
    
    console.log('Container parent dimensions:', {
      width: parentElement?.offsetWidth,
      height: parentElement?.offsetHeight,
      display: parentElement ? window.getComputedStyle(parentElement).display : 'none'
    });
    
    // Ensure container has explicit dimensions and ID
    if (container) {
      console.log('Setting container dimensions and ID');
      container.style.width = parentElement?.offsetWidth ? `${parentElement.offsetWidth}px` : '100%';
      container.style.height = '500px';
      container.id = 'meetingSDKElement';
    }
    
    // Check after a short delay to ensure styles are applied
    const checkContainer = () => {
      if (!zoomContainerRef.current) return;
      
      const dimensions = {
        width: container.offsetWidth,
        height: container.offsetHeight,
        id: container.id,
        display: window.getComputedStyle(container).display,
        position: window.getComputedStyle(container).position
      };
      
      console.log('Container dimensions check:', dimensions);
      
      if (dimensions.width > 0 && dimensions.height > 0) {
        console.log('Container dimensions verified:', dimensions);
        setContainerReady(true);
      } else {
        console.log('Container dimensions not ready, retrying...');
        setTimeout(checkContainer, 200);
      }
    };
    
    // Initial delay to ensure DOM is settled
    setTimeout(checkContainer, 300);
    
    return () => {
      setContainerReady(false);
    };
  }, []);
  
  // Load Zoom SDK
  useEffect(() => {
    console.log('Loading Zoom SDK separately');
    
    const loadSdk = async () => {
      try {
        await loadZoomSDK();
        console.log('SDK loaded successfully');
        setSdkLoaded(true);
      } catch (err) {
        console.error('Failed to load Zoom SDK:', err);
        setError('Failed to load Zoom meetings SDK. Please try refreshing the page.');
      }
    };
    
    loadSdk();
  }, []);

  // Main initialization useEffect
  useEffect(() => {
    if (!containerReady || !sdkLoaded) {
      console.log('Waiting for container and SDK to be ready:', { containerReady, sdkLoaded });
      return;
    }
    
    if (!meetingNumber) {
      console.error('Meeting number not provided');
      setError('Meeting ID is required to join a meeting');
      setIsLoading(false);
      return;
    }
    
    console.log('Container and SDK ready, proceeding with initialization');
    let isMounted = true;

    const initializeZoom = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Create Zoom client
        const client = ZoomMtgEmbedded.createClient();

        // Initialize with required parameters
        await client.init({
          debug: true,
          zoomAppRoot: zoomContainerRef.current,
          language: 'en-US',
          customize: {
            meetingInfo: ['topic', 'host', 'mn', 'pwd', 'tel', 'participant', 'dc', 'enctype'],
            toolbar: {
              buttons: [
                {
                  text: 'Custom Button',
                  className: 'CustomButton',
                  onClick: () => {
                    console.log('custom button');
                  }
                }
              ]
            }
          }
        });

        // Get signature
        const tokenData = localStorage.getItem('sb-qsxlvwwebbakmzpwjfbb-auth-token');
        if (!tokenData) {
          throw new Error('Authentication required');
        }

        const parsedToken = JSON.parse(tokenData);
        const authToken = parsedToken?.access_token;

        const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-zoom-signature`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            meetingNumber,
            role: 1 // 1 for host
          })
        });

        if (!response.ok) {
          throw new Error('Failed to get signature');
        }

        const { signature } = await response.json();

        // Join meeting with all required parameters
        await client.join({
          sdkKey: ZOOM_SDK_KEY,
          signature: signature,
          meetingNumber: meetingNumber,
          userName: providedUserName || user?.email || 'Guest',
          userEmail: user?.email,
          passWord: '', // Required, even if empty
          success: (success) => {
            console.log('Join meeting success:', success);
            setIsLoading(false);
            setIsConnected(true);
            toast({
              title: "Meeting Joined",
              description: "You have successfully joined the Zoom meeting"
            });
          },
          error: (error) => {
            console.error('Join meeting error:', error);
            setError(error);
            setIsLoading(false);
            toast({
              title: "Meeting Error",
              description: error,
              variant: "destructive"
            });
          }
        });

      } catch (err: any) {
        console.error('Error during Zoom initialization:', err);
        
        if (isMounted) {
          const errorMessage = err.message || 'Failed to initialize Zoom meeting';
          setError(errorMessage);
          setIsLoading(false);
          
          toast({
            title: "Meeting Error",
            description: errorMessage,
            variant: "destructive"
          });
        }
      }
    };

    initializeZoom();

    return () => {
      isMounted = false;
      if (zoomClientRef.current) {
        leaveZoomMeeting(zoomClientRef.current).catch(console.error);
      }
    };
  }, [containerReady, sdkLoaded, meetingNumber, meetingPassword, providedUserName, role, user, toast]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isConnected) return;
      
      if (e.key === 'm') {
        toggleMute();
      } else if (e.key === 'v') {
        toggleVideo();
      } else if (e.key === 'l' && e.ctrlKey) {
        leaveMeeting();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConnected, isMuted, isVideoOff]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
        <p className="text-red-500 mb-4">{error}</p>
        <div className="text-sm text-gray-500 mb-6 max-w-md text-center">
          <p>Troubleshooting tips:</p>
          <ul className="list-disc list-inside mt-2 text-left">
            <li>Check your internet connection</li>
            <li>Verify that Zoom is not blocked by your network</li>
            <li>Allow camera and microphone access in your browser</li>
            <li>Try using a different browser (Chrome recommended)</li>
          </ul>
        </div>
        <div className="flex gap-4">
          <Button
            onClick={() => {
              setError(null);
              setIsLoading(true);
              setSdkLoaded(false);
              loadZoomSDK().then(() => setSdkLoaded(true)).catch(e => setError(e.message));
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Retry Connection
          </Button>
          <Button
            onClick={() => navigate('/meetings')}
            variant="outline"
            className="px-4 py-2 rounded-md"
          >
            Back to Meetings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div 
        ref={zoomContainerRef} 
        className="w-full h-full min-h-[500px]"
        style={{ position: 'relative', height: '100%', width: '100%' }}
      >
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full w-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p>Loading Zoom meeting...</p>
          </div>
        )}
      </div>
      
      {isConnected && (
        <div className="flex items-center justify-center gap-4 p-4 bg-background border-t">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className={isMuted ? 'bg-destructive/10 text-destructive' : ''}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleVideo}
            className={isVideoOff ? 'bg-destructive/10 text-destructive' : ''}
          >
            {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={leaveMeeting}
            className="bg-destructive/10 text-destructive"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  );
}

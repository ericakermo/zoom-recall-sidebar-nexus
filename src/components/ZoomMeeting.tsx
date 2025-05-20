import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { loadZoomSDK, createAndInitializeZoomClient, getSignature, joinZoomMeeting, leaveZoomMeeting } from '@/lib/zoom-config';
import { ZoomMeetingConfig } from '@/types/zoom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Settings, Users, MessageSquare, Share2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface ZoomMeetingProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingEnd?: () => void;
}

export function ZoomMeeting({
  meetingNumber,
  meetingPassword,
  userName: providedUserName,
  role = 0, // 0 for attendee, 1 for host
  onMeetingEnd
}: ZoomMeetingProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const zoomClientRef = useRef<any>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const zoomInitializedRef = useRef(false);
  const [containerReady, setContainerReady] = useState(false);
  const [storedPassword, setStoredPassword] = useState('');
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [joinAttempts, setJoinAttempts] = useState(0);

  // Handle meeting controls
  const toggleMute = () => {
    if (!window.ZoomMtg) return;
    
    if (isMuted) {
      window.ZoomMtg.unmuteAudio();
      setIsMuted(false);
    } else {
      window.ZoomMtg.muteAudio();
      setIsMuted(true);
    }
  };

  const toggleVideo = () => {
    if (!window.ZoomMtg) return;
    
    if (isVideoOff) {
      window.ZoomMtg.startVideo();
      setIsVideoOff(false);
    } else {
      window.ZoomMtg.stopVideo();
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
    } else if (window.ZoomMtg) {
      window.ZoomMtg.leaveMeeting({
        success: () => {
          console.log('Left the meeting');
          setIsConnected(false);
          onMeetingEnd?.();
        },
        error: (error: any) => {
          console.error('Error leaving meeting:', error);
        }
      });
    }
  };

  // Suppress the chrome message port error
  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = function(message, ...args) {
      if (typeof message === 'string' && message.includes('message port closed')) {
        // Ignore the message port closed error
        return;
      }
      originalConsoleError.apply(console, [message, ...args]);
    };
    
    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  // Enhanced container mounting check
  useEffect(() => {
    if (!zoomContainerRef.current) return;
    
    console.log('Starting container setup check');
    
    // Force layout calculation
    const container = zoomContainerRef.current;
    const parentElement = container.parentElement;
    
    console.log('Container parent dimensions:', {
      width: parentElement?.offsetWidth,
      height: parentElement?.offsetHeight,
      display: parentElement ? window.getComputedStyle(parentElement).display : 'none'
    });
    
    // Ensure container has explicit dimensions
    if (container && (!container.offsetWidth || !container.offsetHeight)) {
      console.log('Container has no dimensions, forcing layout');
      
      // Force explicit dimensions if needed
      container.style.width = parentElement?.offsetWidth ? `${parentElement.offsetWidth}px` : '100%';
      container.style.height = '500px';
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
      // Cleanup if component unmounts during check
      setContainerReady(false);
    };
  }, []);
  
  // Load Zoom SDK separately
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
    
    return () => {
      // No cleanup needed for SDK loading
    };
  }, []);

  // Main initialization useEffect - now depends on containerReady and sdkLoaded
  useEffect(() => {
    if (!containerReady || !sdkLoaded) {
      console.log('Waiting for container and SDK to be ready:', { containerReady, sdkLoaded });
      return;
    }
    
    console.log('Container and SDK ready, proceeding with initialization');
    let isMounted = true;

    const initializeZoom = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Get signature with retry
        console.log('Getting signature for meeting:', meetingNumber);
        let signature;
        try {
          signature = await getSignature(meetingNumber, role);
          console.log('Received signature successfully');
        } catch (sigError) {
          console.error('Failed to get meeting signature:', sigError);
          throw new Error('Could not authenticate with Zoom. Please check your connection.');
        }

        // Verify container before proceeding
        if (!zoomContainerRef.current) {
          console.error('Container ref is null after earlier checks');
          throw new Error('Meeting container disappeared. Please refresh the page.');
        }
        
        // Force check container dimensions one more time
        const container = zoomContainerRef.current;
        console.log('Final container check before client init:', {
          width: container.offsetWidth,
          height: container.offsetHeight,
          id: container.id
        });
        
        // Initialize client with explicit options
        console.log('Creating and initializing Zoom client');
        const client = await createAndInitializeZoomClient(zoomContainerRef.current);
        
        if (!isMounted) {
          console.log('Component unmounted during initialization, aborting');
          return;
        }
        
        console.log('Client initialization successful, storing reference');
        zoomClientRef.current = client;
        
        // Join meeting with comprehensive error handling
        console.log('Joining meeting:', meetingNumber);
        try {
          await joinZoomMeeting(client, {
            signature,
            meetingNumber,
            userName: providedUserName || user?.email || 'Guest',
            password: meetingPassword || ''
          });
          
          console.log('Successfully joined meeting!');
          
          if (!isMounted) {
            console.log('Component unmounted after joining, aborting');
            return;
          }
          
          setIsLoading(false);
          setIsConnected(true);
          
          toast({
            title: "Meeting Joined",
            description: "You have successfully joined the Zoom meeting"
          });
        } catch (joinError: any) {
          console.error('Error joining meeting:', joinError);
          throw new Error(`Failed to join meeting: ${joinError.message || 'Unknown error'}`);
        }
      } catch (err: any) {
        console.error('Error during Zoom initialization sequence:', err);
        
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
        console.log('Cleanup: Leaving meeting');
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

  // Show more detailed error states
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
              // Restart the SDK loading process
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
        id="meetingSDKElement"
        className="w-full h-full min-h-[500px]"
        style={{ position: 'relative', height: '100%', width: '100%' }}
      >
        {isLoading && <div>Loading Zoom meeting...</div>}
        {error && <div>Error: {error}</div>}
      </div>
      
      {isConnected && (
        <div 
          ref={controlsRef}
          className="flex items-center justify-center gap-4 p-4 bg-background border-t"
        >
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

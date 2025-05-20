import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadZoomSDK, getSignature, joinZoomMeeting, leaveZoomMeeting } from '@/lib/zoom-config';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
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
  role = 0,
  onMeetingEnd
}: ZoomMeetingProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

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
    leaveZoomMeeting()
      .then(() => {
        console.log('Left the meeting');
        setIsConnected(false);
        onMeetingEnd?.();
      })
      .catch((error: any) => {
        console.error('Error leaving meeting:', error);
      });
  };

  // Main initialization useEffect
  useEffect(() => {
    let isMounted = true;

    const initializeZoom = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Load SDK
        await loadZoomSDK();
        
        // Get signature
        const signature = await getSignature(meetingNumber, role);
        
        // Join meeting
        await joinZoomMeeting({
          signature,
          meetingNumber,
          userName: providedUserName || user?.email || 'Guest',
          password: meetingPassword || ''
        });
        
        if (!isMounted) return;
        
        setIsLoading(false);
        setIsConnected(true);
        
        toast({
          title: "Meeting Joined",
          description: "You have successfully joined the Zoom meeting"
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
      leaveZoomMeeting().catch(console.error);
    };
  }, [meetingNumber, meetingPassword, providedUserName, role, user, toast]);

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
              loadZoomSDK().catch(e => setError(e.message));
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
      <div id="zmmtg-root" className="w-full h-full min-h-[500px]" />
      
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

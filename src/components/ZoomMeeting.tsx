
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { loadZoomSDK, initializeZoomMeeting, getSignature } from '@/lib/zoom-config';
import { ZoomMeetingConfig } from '@/types/zoom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Settings, Users, MessageSquare, Share2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface ZoomMeetingProps {
  meetingNumber: string;
  userName?: string;
  role?: number;
  onMeetingEnd?: () => void;
}

export function ZoomMeeting({
  meetingNumber,
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
    if (!window.ZoomMtg) return;
    
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
  };

  useEffect(() => {
    const initializeZoom = async () => {
      try {
        setIsLoading(true);
        
        // Load Zoom SDK
        await loadZoomSDK();

        // Get user's Zoom connection from Supabase
        const { data: zoomConnection, error: dbError } = await supabase
          .from('zoom_connections')
          .select('*')
          .eq('user_id', user?.id)
          .single();

        if (dbError && dbError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
          throw new Error('Error fetching Zoom connection');
        }

        if (!zoomConnection && role === 1) {
          throw new Error('No Zoom connection found. Please connect your Zoom account first to host meetings.');
        }

        // Get meeting signature from your backend
        const signature = await getSignature(meetingNumber, role);

        const meetingConfig: ZoomMeetingConfig = {
          signature,
          meetingNumber,
          userName: providedUserName || user?.email || 'Guest',
          apiKey: "eFAZ8Vf7RbG5saQVqL1zGA", // Use the API key directly
          role,
        };

        // Initialize Zoom Meeting
        const zoomClient = await initializeZoomMeeting(meetingConfig);

        // Register event listeners
        zoomClient.inMeetingServiceListener('onUserJoin', (data: any) => {
          console.log('User joined:', data);
          setParticipantCount(prev => prev + 1);
        });

        zoomClient.inMeetingServiceListener('onUserLeave', (data: any) => {
          console.log('User left:', data);
          setParticipantCount(prev => Math.max(0, prev - 1));
        });

        zoomClient.inMeetingServiceListener('onMeetingStatus', (data: any) => {
          console.log('Meeting status changed:', data);
          if (data.meetingStatus === 3) { // Meeting ended
            onMeetingEnd?.();
            setIsConnected(false);
          }
        });

        // Join the meeting
        await zoomClient.join({
          ...meetingConfig,
          success: () => {
            console.log('Successfully joined the meeting');
            setIsLoading(false);
            setIsConnected(true);
            setParticipantCount(1); // Start with at least one participant (yourself)
            
            toast({
              title: "Meeting Joined",
              description: "You have successfully joined the Zoom meeting"
            });
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

    return () => {
      if (window.ZoomMtg && isConnected) {
        window.ZoomMtg.leaveMeeting({
          success: () => {
            console.log('Left the meeting during cleanup');
            onMeetingEnd?.();
          }
        });
      }
    };
  }, [meetingNumber, providedUserName, role, user, onMeetingEnd]);

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
        <Button
          onClick={() => navigate('/settings')}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Connect Zoom Account
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p>Connecting to Zoom meeting...</p>
      </div>
    );
  }

  return (
    <>
      <div id="zmmtg-root" className="w-full h-full relative" />
      
      {isConnected && (
        <div 
          ref={controlsRef}
          className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 rounded-lg py-2 px-4 flex items-center space-x-4"
          style={{ pointerEvents: 'auto' }}
        >
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleMute}
            className="text-white hover:bg-gray-700 rounded-full"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleVideo}
            className="text-white hover:bg-gray-700 rounded-full"
            title={isVideoOff ? "Start Video" : "Stop Video"}
          >
            {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-gray-700 rounded-full"
            title="Participants"
          >
            <div className="relative">
              <Users className="h-5 w-5" />
              <span className="absolute -top-2 -right-2 bg-primary text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {participantCount}
              </span>
            </div>
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-gray-700 rounded-full"
            title="Chat"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-gray-700 rounded-full"
            title="Share Screen"
          >
            <Share2 className="h-5 w-5" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-gray-700 rounded-full"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </Button>
          
          <Button 
            variant="destructive" 
            onClick={leaveMeeting}
            className="rounded-full"
            title="Leave Meeting"
          >
            <PhoneOff className="h-5 w-5 mr-1" />
            Leave
          </Button>
        </div>
      )}
    </>
  );
}

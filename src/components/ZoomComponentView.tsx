
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { createZoomComponentClient, ZoomComponentConfig } from '@/lib/zoom-component-config';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, MicOff, Video, VideoOff, Phone } from 'lucide-react';

interface ZoomComponentViewProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingJoined?: () => void;
  onMeetingError?: (error: string) => void;
  onMeetingLeft?: () => void;
}

export function ZoomComponentView({
  meetingNumber,
  meetingPassword,
  userName: providedUserName,
  role = 0,
  onMeetingJoined,
  onMeetingError,
  onMeetingLeft
}: ZoomComponentViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initializationAttempted, setInitializationAttempted] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const isJoiningRef = useRef(false);
  
  const { user } = useAuth();
  const { toast } = useToast();

  const handleError = useCallback((errorMessage: string) => {
    console.error('❌ Zoom error:', errorMessage);
    setError(errorMessage);
    setIsLoading(false);
    onMeetingError?.(errorMessage);
  }, [onMeetingError]);

  const handleJoinSuccess = useCallback(() => {
    console.log('✅ Meeting joined successfully');
    setIsJoined(true);
    setIsLoading(false);
    isJoiningRef.current = false;
    onMeetingJoined?.();
    toast({
      title: "Meeting Joined",
      description: "Successfully joined the Zoom meeting"
    });
  }, [onMeetingJoined, toast]);

  const initializeAndJoin = useCallback(async () => {
    if (!containerRef.current || !meetingNumber || initializationAttempted || isJoiningRef.current) {
      return;
    }

    setInitializationAttempted(true);
    isJoiningRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      console.log('🔄 Starting Zoom initialization...');

      // Get tokens and meeting details
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
        body: {
          meetingNumber,
          role: role || 0,
          expirationSeconds: 7200
        }
      });

      if (tokenError) {
        throw new Error(`Token error: ${tokenError.message}`);
      }

      // Get ZAK token if host
      let zakToken = null;
      if (role === 1) {
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        if (!zakError && zakData) {
          zakToken = zakData.zak;
        }
      }

      console.log('✅ Tokens retrieved successfully');

      // Ensure container is ready
      if (!containerRef.current) {
        throw new Error('Container element not available');
      }

      // Create and initialize client
      console.log('🔄 Creating Zoom client...');
      const client = await createZoomComponentClient(containerRef.current);
      clientRef.current = client;

      console.log('✅ Client initialized successfully');

      // Join configuration
      const joinConfig: any = {
        sdkKey: tokenData.sdkKey,
        signature: tokenData.signature,
        meetingNumber,
        userName: providedUserName || user?.email || 'Guest',
        userEmail: user?.email || '',
        passWord: meetingPassword || '',
        role: role || 0,
        success: (result: any) => {
          console.log('✅ Join success callback:', result);
          handleJoinSuccess();
        },
        error: (error: any) => {
          console.error('❌ Join error callback:', error);
          const errorMessage = error.message || error.reason || 'Failed to join meeting';
          handleError(errorMessage);
        }
      };

      if (role === 1 && zakToken) {
        joinConfig.zak = zakToken;
      }

      console.log('🔄 Joining meeting with config:', {
        meetingNumber: joinConfig.meetingNumber,
        userName: joinConfig.userName,
        hasSignature: !!joinConfig.signature,
        role: joinConfig.role,
        hasZak: !!joinConfig.zak
      });

      // Join meeting
      await client.join(joinConfig);

    } catch (err: any) {
      console.error('❌ Initialization error:', err);
      const errorMessage = err.message || 'Failed to initialize meeting';
      handleError(errorMessage);
      isJoiningRef.current = false;
    }
  }, [
    meetingNumber, 
    role, 
    providedUserName, 
    user, 
    meetingPassword, 
    initializationAttempted,
    handleError,
    handleJoinSuccess
  ]);

  const handleLeaveMeeting = useCallback(async () => {
    try {
      if (clientRef.current && typeof clientRef.current.leave === 'function') {
        console.log('🔄 Leaving meeting...');
        await clientRef.current.leave();
      }
      setIsJoined(false);
      onMeetingLeft?.();
    } catch (error) {
      console.error('❌ Error leaving meeting:', error);
    }
  }, [onMeetingLeft]);

  const toggleMute = useCallback(() => {
    if (clientRef.current && isJoined) {
      try {
        if (isMuted) {
          clientRef.current.unmuteAudio();
        } else {
          clientRef.current.muteAudio();
        }
        setIsMuted(!isMuted);
      } catch (error) {
        console.error('Error toggling mute:', error);
      }
    }
  }, [isMuted, isJoined]);

  const toggleVideo = useCallback(() => {
    if (clientRef.current && isJoined) {
      try {
        if (isVideoOff) {
          clientRef.current.startVideo();
        } else {
          clientRef.current.stopVideo();
        }
        setIsVideoOff(!isVideoOff);
      } catch (error) {
        console.error('Error toggling video:', error);
      }
    }
  }, [isVideoOff, isJoined]);

  // Initialize when component mounts and dependencies are ready
  useEffect(() => {
    if (containerRef.current && meetingNumber && !initializationAttempted) {
      // Small delay to ensure DOM is fully ready
      const timer = setTimeout(() => {
        initializeAndJoin();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [initializeAndJoin, meetingNumber, initializationAttempted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        try {
          if (typeof clientRef.current.leave === 'function') {
            clientRef.current.leave();
          }
        } catch (error) {
          console.error('Cleanup error:', error);
        }
      }
    };
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 font-medium">Meeting Error</p>
          <p className="text-red-500 text-sm mt-1">{error}</p>
        </div>
        <Button 
          onClick={() => {
            setError(null);
            setInitializationAttempted(false);
            setIsLoading(true);
            isJoiningRef.current = false;
            initializeAndJoin();
          }}
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-50">
          <div className="text-center text-white">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-lg">Joining meeting...</p>
            <p className="text-sm text-gray-400 mt-2">Meeting ID: {meetingNumber}</p>
          </div>
        </div>
      )}

      {/* Zoom meeting container */}
      <div 
        ref={containerRef}
        id="zoomComponentContainer"
        className="w-full h-full"
        style={{ minHeight: '500px' }}
      />

      {/* Custom meeting controls overlay */}
      {isJoined && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40">
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2">
            <Button
              size="sm"
              variant={isMuted ? "destructive" : "secondary"}
              onClick={toggleMute}
              className="rounded-full w-10 h-10 p-0"
            >
              {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            
            <Button
              size="sm"
              variant={isVideoOff ? "destructive" : "secondary"}
              onClick={toggleVideo}
              className="rounded-full w-10 h-10 p-0"
            >
              {isVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            </Button>
            
            <Button
              size="sm"
              variant="destructive"
              onClick={handleLeaveMeeting}
              className="rounded-full w-10 h-10 p-0 ml-2"
            >
              <Phone className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

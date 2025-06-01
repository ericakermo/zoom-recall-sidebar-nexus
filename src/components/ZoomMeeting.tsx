import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import ZoomMtgEmbedded from "@zoom/meetingsdk/embedded";
import { ZoomMeetingDebugger } from "@zoom/meetingsdk/embedded";

interface ZoomMeetingProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingEnd?: () => void;
  zak?: string;
}

export function ZoomMeeting({
  meetingNumber,
  meetingPassword,
  userName,
  role = 0,
  onMeetingEnd,
  zak
}: ZoomMeetingProps) {
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const zoomContainerRef = useRef(null);
  const clientRef = useRef(null);

  useEffect(() => {
    if (!zoomContainerRef.current) return;

    // Create client only once
    if (!clientRef.current) {
      clientRef.current = ZoomMtgEmbedded.createClient();
    }

    // Ensure container is visible and has size
    const container = zoomContainerRef.current;
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.minHeight = "600px"; // or whatever is appropriate

    // Initialize SDK
    clientRef.current.init({
      zoomAppRoot: container,
      language: "en-US",
      patchJsMedia: true,
      leaveOnPageUnload: true,
    });

    // Join meeting
    clientRef.current.join({
      zak,
      meetingNumber,
      password: meetingPassword,
      userName,
    });

    // Cleanup on unmount
    return () => {
      try {
        clientRef.current.leave();
        clientRef.current.destroy();
      } catch {}
      container.innerHTML = "";
    };
  }, [zak, meetingNumber, meetingPassword, userName]);

  const handleMeetingJoined = () => {
    setIsConnected(true);
    console.log('✅ Meeting joined successfully');
    toast({
      title: "Connected",
      description: "You have joined the meeting"
    });
  };

  const handleMeetingError = (errorMessage: string) => {
    setError(errorMessage);
    setIsConnected(false);
    console.error('❌ Meeting error:', errorMessage);
  };

  const handleMeetingLeft = () => {
    setIsConnected(false);
    onMeetingEnd?.();
    toast({
      title: "Meeting Ended",
      description: "You have left the meeting"
    });
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
        <div className="text-center max-w-md">
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 font-medium">Unable to Join Meeting</p>
            <p className="text-red-500 text-sm mt-1">{error}</p>
          </div>
          
          <div className="text-sm text-gray-600 mb-6">
            <p className="font-medium mb-2">Troubleshooting tips:</p>
            <ul className="list-disc list-inside text-left space-y-1">
              <li>Check your internet connection</li>
              <li>Verify the meeting ID is correct</li>
              <li>Allow camera and microphone access</li>
              <li>Try using Chrome browser</li>
              <li>Ensure meeting hasn't ended</li>
            </ul>
          </div>
          
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => {
                setError(null);
                window.location.reload();
              }}
            >
              Retry Connection
            </Button>
            <Button
              onClick={() => navigate('/calendar')}
              variant="outline"
            >
              Back to Calendar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Meeting header */}
      <div className="flex items-center justify-between p-4 bg-white border-b flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold">Zoom Meeting</h2>
          <p className="text-sm text-gray-600">Meeting ID: {meetingNumber}</p>
        </div>
        {isConnected && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-600 font-medium">Connected</span>
          </div>
        )}
      </div>
      
      {/* Meeting content - fixed positioned container */}
      <div className="relative flex-1 min-h-[400px]">
        <div
          ref={zoomContainerRef}
          style={{ width: "100%", height: "100%", minHeight: "600px", background: "#000" }}
        />
      </div>
    </div>
  );
}

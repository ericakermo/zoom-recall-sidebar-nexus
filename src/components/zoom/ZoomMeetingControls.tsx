
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, Phone } from 'lucide-react';

interface ZoomMeetingControlsProps {
  isJoined: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onLeaveMeeting: () => void;
}

export function ZoomMeetingControls({
  isJoined,
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onLeaveMeeting
}: ZoomMeetingControlsProps) {
  if (!isJoined) return null;

  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40">
      <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2">
        <Button
          size="sm"
          variant={isMuted ? "destructive" : "secondary"}
          onClick={onToggleMute}
          className="rounded-full w-10 h-10 p-0"
        >
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        
        <Button
          size="sm"
          variant={isVideoOff ? "destructive" : "secondary"}
          onClick={onToggleVideo}
          className="rounded-full w-10 h-10 p-0"
        >
          {isVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
        </Button>
        
        <Button
          size="sm"
          variant="destructive"
          onClick={onLeaveMeeting}
          className="rounded-full w-10 h-10 p-0 ml-2"
        >
          <Phone className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}


import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

interface ZoomMeetingControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onLeaveMeeting: () => void;
  isConnected: boolean;
}

export function ZoomMeetingControls({
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onLeaveMeeting,
  isConnected
}: ZoomMeetingControlsProps) {
  if (!isConnected) return null;

  return (
    <div className="flex items-center justify-center gap-4 p-4 bg-background border-t">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleMute}
        className={isMuted ? 'bg-destructive/10 text-destructive' : ''}
      >
        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleVideo}
        className={isVideoOff ? 'bg-destructive/10 text-destructive' : ''}
      >
        {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={onLeaveMeeting}
        className="bg-destructive/10 text-destructive"
      >
        <PhoneOff className="h-5 w-5" />
      </Button>
    </div>
  );
}

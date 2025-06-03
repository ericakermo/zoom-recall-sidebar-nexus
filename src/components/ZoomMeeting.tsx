
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ZoomComponentView } from './ZoomComponentView';

interface ZoomMeetingProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingEnd?: () => void;
  onMeetingJoined?: (client: any) => void;
  zak?: string;
}

export function ZoomMeeting({
  meetingNumber,
  meetingPassword,
  userName,
  role = 0,
  onMeetingEnd,
  onMeetingJoined,
  zak
}: ZoomMeetingProps) {
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  const handleMeetingJoined = (client: any) => {
    setIsConnected(true);
    console.log('✅ [ZOOM-MEETING] Meeting joined successfully');
    onMeetingJoined?.(client);
    toast({
      title: "Connected",
      description: "You have joined the meeting",
      duration: 3000
    });
  };

  const handleMeetingError = (errorMessage: string) => {
    setIsConnected(false);
    console.error('❌ [ZOOM-MEETING] Meeting error:', errorMessage);
    toast({
      title: "Connection Failed",
      description: errorMessage,
      variant: "destructive",
      duration: 5000
    });
  };

  const handleMeetingLeft = () => {
    setIsConnected(false);
    onMeetingEnd?.();
    toast({
      title: "Meeting Ended",
      description: "You have left the meeting",
      duration: 3000
    });
  };

  return (
    <div className="h-full w-full flex flex-col relative">
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
      
      {/* Meeting content */}
      <div className="relative flex-1">
        <ZoomComponentView
          meetingNumber={meetingNumber}
          meetingPassword={meetingPassword}
          userName={userName}
          role={role}
          onMeetingJoined={handleMeetingJoined}
          onMeetingError={handleMeetingError}
          onMeetingLeft={handleMeetingLeft}
        />
      </div>
    </div>
  );
}

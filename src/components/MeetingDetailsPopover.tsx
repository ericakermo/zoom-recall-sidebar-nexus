
import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface MeetingDetailsPopoverProps {
  children: React.ReactNode;
  meeting: {
    id: string;
    title: string;
    start_time: string;
    duration: number;
    join_url: string;
    description?: string;
  };
}

const ZoomIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#2D8CFF"/>
    <path d="M12 6.5c-3.03 0-5.5 2.47-5.5 5.5s2.47 5.5 5.5 5.5 5.5-2.47 5.5-5.5-2.47-5.5-5.5-5.5zm0 9c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" fill="#2D8CFF"/>
  </svg>
);

export const MeetingDetailsPopover: React.FC<MeetingDetailsPopoverProps> = ({ children, meeting }) => {
  const { toast } = useToast();

  const formatMeetingDateTime = (startTime: string, duration: number) => {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60000);
    
    return {
      date: format(start, 'EEEE, MMMM d, yyyy'),
      time: `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`
    };
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(meeting.join_url);
      toast({
        title: "Copied!",
        description: "Meeting URL copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy URL",
        variant: "destructive"
      });
    }
  };

  const handleJoinMeeting = () => {
    if (meeting.join_url) {
      window.open(meeting.join_url, '_blank');
    }
  };

  const { date, time } = formatMeetingDateTime(meeting.start_time, meeting.duration);

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start" side="right">
        <div className="space-y-4">
          {/* Title */}
          <h3 className="text-lg font-semibold leading-tight">{meeting.title}</h3>
          
          {/* Date and Time */}
          <div className="space-y-1">
            <p className="text-sm text-gray-600">{date}</p>
            <p className="text-sm text-gray-600">{time}</p>
          </div>
          
          {/* Join Zoom Button */}
          <Button 
            onClick={handleJoinMeeting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <ZoomIcon />
            <span className="ml-2">Join Zoom Meeting</span>
          </Button>
          
          {/* Meeting URL with Copy */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyUrl}
                className="flex-shrink-0"
              >
                <Copy className="h-3 w-3" />
              </Button>
              <p className="text-sm text-gray-500 opacity-60 truncate flex-1">
                {meeting.join_url}
              </p>
            </div>
          </div>
          
          {/* Description */}
          {meeting.description && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Description</h4>
              <p className="text-sm text-gray-600">{meeting.description}</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default MeetingDetailsPopover;

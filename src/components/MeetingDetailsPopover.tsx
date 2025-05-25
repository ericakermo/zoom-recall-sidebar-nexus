
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
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="6" width="20" height="12" rx="4" fill="#2D8CFF"/>
    <path d="M8 10v4l4-2-4-2z" fill="white"/>
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
      <PopoverContent className="w-80 p-6 h-96" align="start" side="right" sideOffset={10}>
        <div className="space-y-6">
          {/* Title */}
          <h3 className="text-xl font-medium leading-tight">{meeting.title}</h3>
          
          {/* Date and Time */}
          <div className="space-y-1">
            <p className="text-sm text-gray-600">{date}</p>
            <p className="text-sm text-gray-600">{time}</p>
          </div>
          
          {/* Action Buttons Row */}
          <div className="flex items-center gap-6">
            {/* Join Zoom Button with SVG on the left */}
            <div className="flex items-center gap-3">
              <ZoomIcon />
              <Button 
                onClick={handleJoinMeeting}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-2"
              >
                Join Zoom Meeting
              </Button>
            </div>
            
            {/* Copy Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyUrl}
              className="ml-4 h-8 w-8 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          
          {/* Meeting URL */}
          <div className="space-y-2">
            <p className="text-sm text-gray-500 opacity-20 break-all">
              {meeting.join_url}
            </p>
          </div>
          
          {/* Description */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Description</h4>
            <p className="text-sm text-gray-600">{meeting.description || 'No description available'}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default MeetingDetailsPopover;

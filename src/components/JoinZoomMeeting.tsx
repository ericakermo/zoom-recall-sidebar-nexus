
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface JoinZoomMeetingProps {
  meetingNumber?: string;
  passcode?: string;
  userName?: string;
}

const JoinZoomMeeting = ({ meetingNumber = '', passcode = '', userName = 'Guest' }: JoinZoomMeetingProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const joinMeeting = async () => {
    try {
      setIsLoading(true);
      
      // For now, just show a toast message since this component isn't fully integrated
      toast({
        title: "Feature Coming Soon",
        description: "Zoom meeting integration is being updated. Please use the Meetings page instead.",
      });
      
    } catch (error) {
      console.error('Failed to join Zoom meeting', error);
      toast({
        title: "Error",
        description: "Failed to join meeting",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <Button
        onClick={joinMeeting}
        disabled={isLoading}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        {isLoading ? 'Joining...' : 'Join Zoom Meeting'}
      </Button>
      <div id="zmmtg-root"></div>
    </div>
  );
};

export default JoinZoomMeeting;


import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { createAndInitializeZoomClient, joinMeeting, leaveZoomMeeting } from '@/lib/zoom-config';

const Meeting = () => {
  const { id } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const clientRef = useRef<any>(null);
  const meetingContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initializeMeeting = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get user session
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Get meeting details from Supabase
        const { data: meeting, error: meetingError } = await supabase
          .from('zoom_meetings')
          .select('*')
          .eq('id', id)
          .single();

        if (meetingError) throw meetingError;
        if (!meeting) throw new Error('Meeting not found');

        // Initialize Zoom client
        if (!meetingContainerRef.current) {
          throw new Error('Meeting container not found');
        }

        const client = await createAndInitializeZoomClient(meetingContainerRef.current);
        clientRef.current = client;

        // Join the meeting
        await joinMeeting(client, {
          meetingNumber: meeting.meeting_id,
          userName: user.email || 'Anonymous',
          userEmail: user.email,
          password: meeting.password || '',
          role: meeting.user_id === user.id ? 1 : 0, // 1 for host, 0 for participant
        });

        setIsLoading(false);
      } catch (err: any) {
        console.error('Meeting initialization error:', err);
        setError(err.message);
        setIsLoading(false);
        toast({
          title: "Error",
          description: err.message,
          variant: "destructive",
        });
      }
    };

    initializeMeeting();

    // Cleanup function
    return () => {
      if (clientRef.current) {
        leaveZoomMeeting(clientRef.current);
      }
    };
  }, [id, toast]);

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
            <div className="text-center">
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </div>
        )}
        <div 
          ref={meetingContainerRef} 
          id="meetingSDKElement"
          className="w-full h-full"
        />
      </div>
    </div>
  );
};

export default Meeting;

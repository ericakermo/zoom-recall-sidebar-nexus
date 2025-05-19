
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { loadZoomSDK, getSignature, createAndInitializeZoomClient, joinZoomMeeting, leaveZoomMeeting } from '@/lib/zoom-config';

export function JoinZoomMeeting() {
  const [searchParams] = useSearchParams();
  const meetingId = searchParams.get('meetingId') || '';
  const password = searchParams.get('password') || '';
  const [isJoining, setIsJoining] = useState(false);
  const [isInMeeting, setIsInMeeting] = useState(false);
  const [loadingState, setLoadingState] = useState<'idle' | 'loading-sdk' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const zoomClientRef = useRef<any>(null);

  // Load the Zoom SDK when the component mounts
  useEffect(() => {
    const initializeZoomSDK = async () => {
      try {
        setLoadingState('loading-sdk');
        await loadZoomSDK();
        setLoadingState('ready');
      } catch (error) {
        console.error('Failed to load Zoom SDK:', error);
        setErrorMessage('Failed to load Zoom Meeting SDK. Please try again later.');
        setLoadingState('error');
        toast({
          title: 'Error',
          description: 'Failed to load Zoom Meeting SDK',
          variant: 'destructive',
        });
      }
    };

    initializeZoomSDK();

    // Cleanup function to leave meeting when component unmounts
    return () => {
      if (zoomClientRef.current && isInMeeting) {
        leaveZoomMeeting(zoomClientRef.current).catch(console.error);
      }
    };
  }, [toast]);

  const handleJoinMeeting = async () => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'You need to be logged in to join meetings',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    if (!meetingId) {
      toast({
        title: 'Meeting ID Required',
        description: 'Please provide a valid meeting ID',
        variant: 'destructive',
      });
      return;
    }

    if (!zoomContainerRef.current) {
      toast({
        title: 'Error',
        description: 'Zoom container not found',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsJoining(true);

      // Get the signature for joining the meeting
      const signature = await getSignature(meetingId, 0); // 0 for attendee role

      // Create and initialize the Zoom client
      const client = await createAndInitializeZoomClient(zoomContainerRef.current);
      zoomClientRef.current = client;

      // Join the Zoom meeting
      await joinZoomMeeting(client, {
        signature,
        meetingNumber: meetingId,
        userName: user.email || 'User',
        password,
        userEmail: user.email,
      });

      setIsInMeeting(true);
      toast({
        title: 'Success',
        description: 'Joined the meeting successfully',
      });
    } catch (error) {
      console.error('Error joining meeting:', error);
      setErrorMessage(`Failed to join meeting: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast({
        title: 'Error Joining Meeting',
        description: error instanceof Error ? error.message : 'Failed to join meeting',
        variant: 'destructive',
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveMeeting = async () => {
    if (zoomClientRef.current) {
      try {
        await leaveZoomMeeting(zoomClientRef.current);
        setIsInMeeting(false);
        toast({
          title: 'Left Meeting',
          description: 'You have left the meeting',
        });
        navigate('/meetings');
      } catch (error) {
        console.error('Error leaving meeting:', error);
        toast({
          title: 'Error',
          description: 'Failed to leave meeting properly',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Zoom Meeting: {meetingId}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingState === 'loading-sdk' && (
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <span className="ml-4">Loading Zoom Meeting SDK...</span>
            </div>
          )}

          {loadingState === 'error' && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-md">
              <p>{errorMessage || 'An error occurred while loading the Zoom SDK'}</p>
            </div>
          )}

          {loadingState === 'ready' && !isInMeeting && (
            <div className="flex justify-center p-4">
              <Button 
                onClick={handleJoinMeeting} 
                disabled={isJoining}
                className="w-full md:w-auto"
              >
                {isJoining ? 'Joining...' : 'Join Meeting'}
              </Button>
            </div>
          )}

          <div 
            ref={zoomContainerRef} 
            className="zoom-component-view w-full"
            style={{ 
              height: isInMeeting ? '75vh' : '0',
              overflow: 'hidden',
              backgroundColor: '#fff',
              transition: 'height 0.3s ease',
              border: isInMeeting ? '1px solid #e2e8f0' : 'none',
              borderRadius: '0.375rem'
            }}
          ></div>
        </CardContent>
        {isInMeeting && (
          <CardFooter className="flex justify-end">
            <Button variant="destructive" onClick={handleLeaveMeeting}>
              Leave Meeting
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}


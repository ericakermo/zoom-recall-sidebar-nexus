
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { loadZoomSDK, getSignature, createAndInitializeZoomClient, joinMeeting, leaveZoomMeeting } from '@/lib/zoom-config';
import { Video, VideoOff, X } from 'lucide-react';

export function JoinZoomMeeting() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  // Get meeting info from URL params if available
  const meetingIdFromURL = searchParams.get('meetingId');
  const passwordFromURL = searchParams.get('password') || '';

  const [meetingId, setMeetingId] = useState(meetingIdFromURL || '');
  const [password, setPassword] = useState(passwordFromURL || '');
  const [isJoining, setIsJoining] = useState(false);
  const [isInMeeting, setIsInMeeting] = useState(false);
  const [isLoadingSDK, setIsLoadingSDK] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const zoomClientRef = useRef<any>(null);
  const zoomRootRef = useRef<HTMLDivElement>(null);

  // Load the Zoom SDK on component mount
  useEffect(() => {
    let isMounted = true;
    
    const initializeZoomSDK = async () => {
      try {
        setIsLoadingSDK(true);
        setError(null);
        
        const isLoaded = await loadZoomSDK();
        if (!isMounted) return;
        
        if (isLoaded) {
          console.log('Zoom SDK loaded successfully');
          setIsLoadingSDK(false);
        }
      } catch (err: any) {
        console.error('Failed to load Zoom SDK:', err);
        if (isMounted) {
          setIsLoadingSDK(false);
          setError('Failed to load Zoom SDK. Please try refreshing the page.');
          toast({
            title: "Error",
            description: err.message || 'Failed to load Zoom SDK',
            variant: "destructive"
          });
        }
      }
    };

    initializeZoomSDK();
    
    return () => {
      isMounted = false;
      // Clean up meeting if component unmounts while in a meeting
      if (zoomClientRef.current && isInMeeting) {
        leaveZoomMeeting(zoomClientRef.current).catch(console.error);
      }
    };
  }, [toast]);

  const handleJoinMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to join a meeting",
        variant: "destructive"
      });
      return;
    }
    
    // Validate meeting ID format
    const formattedMeetingId = meetingId.replace(/\s+/g, '');
    if (!/^\d{9,11}$/.test(formattedMeetingId)) {
      toast({
        title: "Invalid Meeting ID",
        description: "Please enter a valid Zoom meeting ID (9-11 digits)",
        variant: "destructive"
      });
      return;
    }
    
    if (!zoomRootRef.current) {
      toast({
        title: "Error",
        description: "Zoom container not found. Please try refreshing the page.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsJoining(true);
      setError(null);
      
      // Create and initialize Zoom client
      const client = await createAndInitializeZoomClient(zoomRootRef.current);
      zoomClientRef.current = client;
      
      // Get signature for the meeting
      const signature = await getSignature(formattedMeetingId, 0);
      
      // Join the meeting with all required parameters
      await joinMeeting(client, {
        signature,
        sdkKey: process.env.VITE_ZOOM_SDK_KEY || '',
        meetingNumber: formattedMeetingId,
        userName: user.email || 'Zoom User',
        password: password,
        userEmail: user.email,
        role: 0 // 0 = attendee role
      });
      
      setIsInMeeting(true);
      toast({
        title: "Success",
        description: "You have joined the meeting"
      });
    } catch (err: any) {
      console.error('Failed to join meeting:', err);
      setError(err.message || 'Failed to join the meeting');
      toast({
        title: "Error Joining Meeting",
        description: err.message || 'An unexpected error occurred',
        variant: "destructive"
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveMeeting = async () => {
    if (zoomClientRef.current) {
      try {
        await leaveZoomMeeting(zoomClientRef.current);
        zoomClientRef.current = null;
        setIsInMeeting(false);
        toast({
          title: "Meeting Left",
          description: "You have left the Zoom meeting"
        });
      } catch (err: any) {
        console.error('Error leaving meeting:', err);
        toast({
          title: "Error",
          description: err.message || 'Failed to leave the meeting properly',
          variant: "destructive"
        });
      }
    }
  };

  return (
    <div className="w-full">
      {isInMeeting ? (
        <div className="relative h-[80vh] border rounded-lg overflow-hidden">
          <div className="absolute top-4 right-4 z-10">
            <Button 
              variant="outline" 
              size="sm"
              className="bg-white/80 hover:bg-white/90 text-black"
              onClick={handleLeaveMeeting}
            >
              <X className="h-4 w-4 mr-1" />
              Leave Meeting
            </Button>
          </div>
          
          <div ref={zoomRootRef} className="w-full h-full"></div>
        </div>
      ) : (
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Join a Zoom Meeting</CardTitle>
            <CardDescription>
              Enter the meeting ID and password to join
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleJoinMeeting}>
            <CardContent className="space-y-4">
              {isLoadingSDK ? (
                <div className="flex flex-col items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                  <p>Loading Zoom SDK...</p>
                </div>
              ) : error ? (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                  <p className="font-medium">Error</p>
                  <p className="text-sm">{error}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => window.location.reload()}
                  >
                    Reload Page
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="meetingId">Meeting ID</Label>
                    <Input
                      id="meetingId"
                      placeholder="Enter 9-11 digit meeting ID"
                      value={meetingId}
                      onChange={(e) => setMeetingId(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password (if required)</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Meeting password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </>
              )}
            </CardContent>
            
            <CardFooter>
              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoadingSDK || isJoining || !!error}
              >
                {isJoining ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Joining...
                  </>
                ) : (
                  <>
                    <Video className="mr-2 h-4 w-4" />
                    Join Meeting
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}
    </div>
  );
}

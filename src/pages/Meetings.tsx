import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ZoomMeeting } from '@/components/ZoomMeeting';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Video, VideoOff, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { createZoomMeeting } from '@/lib/zoom-config';

interface MeetingFormData {
  meetingId: string;
}

const Meetings = () => {
  const [activeMeeting, setActiveMeeting] = useState<string | null>(null);
  const [isHosting, setIsHosting] = useState(false);
  const [isConnectingToZoom, setIsConnectingToZoom] = useState(false);
  const { register, handleSubmit, formState: { errors }, reset } = useForm<MeetingFormData>();
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentMeeting, setCurrentMeeting] = useState<any>(null);
  const [isStartingMeeting, setIsStartingMeeting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joinMeeting = (data: MeetingFormData) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to join a meeting",
        variant: "destructive"
      });
      return;
    }

    // Validate meeting ID format
    const meetingId = data.meetingId.replace(/\s+/g, ''); // Remove any spaces
    if (!/^\d{10,11}$/.test(meetingId)) {
      toast({
        title: "Invalid Meeting ID",
        description: "Please enter a valid Zoom meeting ID (10-11 digits)",
        variant: "destructive"
      });
      return;
    }

    setActiveMeeting(meetingId);
    setIsHosting(false);
    reset(); // Reset form
  };

  const hostMeeting = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to host a meeting",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsConnectingToZoom(true);

      // Check if user has connected their Zoom account
      const { data: zoomConnection, error: connectionError } = await supabase
        .from('zoom_connections')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (connectionError || !zoomConnection) {
        toast({
          title: "Zoom Account Not Connected",
          description: "Please connect your Zoom account in Settings first",
          variant: "destructive"
        });
        setIsConnectingToZoom(false);
        return;
      }

      // Create a new meeting using the zoom-config function
      const meetingData = await createZoomMeeting({
        topic: 'Instant Meeting',
        type: 1,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          waiting_room: true
        }
      });
      
      setCurrentMeeting(meetingData);
      setIsHosting(true);
      
      toast({
        title: "Meeting Created",
        description: `You are now hosting meeting ${meetingData.id}`,
      });
    } catch (error: any) {
      console.error("Error hosting meeting:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to host meeting",
        variant: "destructive"
      });
    } finally {
      setIsConnectingToZoom(false);
    }
  };

  const handleMeetingEnd = () => {
    setActiveMeeting(null);
    setIsHosting(false);
    toast({
      title: "Meeting Ended",
      description: "You have left the Zoom meeting"
    });
  };

  const handleStartMeeting = async () => {
    setIsStartingMeeting(true);
    setError(null);
    try {
      const tokenData = localStorage.getItem('sb-qsxlvwwebbakmzpwjfbb-auth-token');
      if (!tokenData) {
        throw new Error('Authentication required');
      }

      const parsedToken = JSON.parse(tokenData);
      const authToken = parsedToken?.access_token;

      const response = await fetch('https://qsxlvwwebbakmzpwjfbb.supabase.co/functions/v1/create-zoom-meeting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          topic: 'Instant Meeting',
          type: 1,
          settings: {
            host_video: true,
            participant_video: true,
            join_before_host: false,
            mute_upon_entry: true,
            waiting_room: true
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create meeting');
      }

      const meeting = await response.json();
      console.log("Created meeting:", meeting);
      setCurrentMeeting(meeting);
    } catch (error) {
      console.error('Failed to start meeting:', error);
      setError(error.message);
    } finally {
      setIsStartingMeeting(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 flex items-center">
        <Video className="mr-2" />
        Zoom Meetings
      </h1>

      {activeMeeting ? (
        <div className="h-[80vh] relative border rounded-lg overflow-hidden">
          <div className="absolute top-4 right-4 z-10">
            <Button 
              variant="outline" 
              size="sm"
              className="bg-white/80 hover:bg-white/90 text-black"
              onClick={() => setActiveMeeting(null)}
            >
              <X className="h-4 w-4 mr-1" />
              Exit
            </Button>
          </div>
          
          <div className="absolute top-4 left-4 z-10 bg-black/50 text-white px-3 py-1 rounded-full text-sm flex items-center">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
            Meeting ID: {activeMeeting}
          </div>
          
          <ZoomMeeting 
            meetingNumber={String(activeMeeting)}
            role={isHosting ? 1 : 0} // 1 for host, 0 for attendee
            onMeetingEnd={handleMeetingEnd}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Join a Meeting</CardTitle>
              <CardDescription>Enter a Zoom meeting ID to join as a participant</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(joinMeeting)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="meetingId">Meeting ID</Label>
                  <Input 
                    id="meetingId"
                    placeholder="Enter 10-11 digit meeting ID"
                    {...register("meetingId", { 
                      required: "Meeting ID is required",
                      pattern: {
                        value: /^\d{10,11}$/,
                        message: "Please enter a valid meeting ID"
                      }
                    })} 
                  />
                  {errors.meetingId && (
                    <p className="text-sm text-red-500">{errors.meetingId.message}</p>
                  )}
                </div>
                <Button type="submit" className="w-full">
                  <Video className="mr-2 h-4 w-4" />
                  Join Meeting
                </Button>
              </form>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Host a Meeting</CardTitle>
              <CardDescription>Start your own Zoom meeting as a host</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                To host a meeting, you need to connect your Zoom account first in the Settings page.
              </p>
              <div className="space-x-3">
                {error && (
                  <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
                    {error}
                  </div>
                )}
                {!currentMeeting ? (
                  <Button 
                    onClick={handleStartMeeting}
                    disabled={isStartingMeeting}
                    className="w-full"
                  >
                    {isStartingMeeting ? 'Starting Meeting...' : 'Start Instant Meeting'}
                  </Button>
                ) : (
                  <div className="mt-4">
                    <ZoomMeeting
                      meetingNumber={String(currentMeeting.id)}
                      userName={user?.email || 'Guest'} 
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Meetings;

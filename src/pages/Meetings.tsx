
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

interface MeetingFormData {
  meetingId: string;
}

const Meetings = () => {
  const [activeMeeting, setActiveMeeting] = useState<string | null>(null);
  const [isHosting, setIsHosting] = useState(false);
  const { register, handleSubmit, formState: { errors }, reset } = useForm<MeetingFormData>();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isStartingMeeting, setIsStartingMeeting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomCredentials, setZoomCredentials] = useState<any>(null);

  const joinMeeting = (data: MeetingFormData) => {
    if (!user) {
      toast({
        title: "Authentication Required",
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

  const handleStartMeeting = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to host a meeting",
        variant: "destructive"
      });
      return;
    }

    setIsStartingMeeting(true);
    setError(null);
    
    try {
      console.log("Creating new Zoom meeting...");
      
      const tokenData = localStorage.getItem('sb-qsxlvwwebbakmzpwjfbb-auth-token');
      if (!tokenData) {
        throw new Error('Authentication required');
      }
      
      const parsedToken = JSON.parse(tokenData);
      const authToken = parsedToken?.access_token;
      
      // Create meeting first
      const meetingResponse = await fetch(`https://qsxlvwwebbakmzpwjfbb.supabase.co/functions/v1/create-zoom-meeting`, {
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
            join_before_host: true, // Changed to true for host role
            mute_upon_entry: true,
            waiting_room: false
          }
        }),
      });

      if (!meetingResponse.ok) {
        const errorData = await meetingResponse.json();
        throw new Error(errorData.error || 'Failed to create meeting');
      }

      const meetingData = await meetingResponse.json();
      console.log("Meeting created successfully:", meetingData);

      // Get ZAK token for host role
      console.log("Getting ZAK token for host...");
      const zakResponse = await fetch(`https://qsxlvwwebbakmzpwjfbb.supabase.co/functions/v1/get-zoom-zak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        }
      });

      if (!zakResponse.ok) {
        const zakError = await zakResponse.json();
        throw new Error(`Failed to get ZAK token: ${zakError.error}`);
      }

      const zakData = await zakResponse.json();
      console.log("ZAK token retrieved successfully");
      
      setZoomCredentials({
        meetingNumber: meetingData.meetingNumber,
        accessToken: meetingData.accessToken,
        tokenType: 'Bearer',
        sdkKey: 'dkQMavedS2OWM2c73F6pLg', // Updated SDK Key
        userName: user?.email || 'Host',
        userEmail: user?.email,
        role: 1, // Host role
        password: meetingData.password || '',
        zak: zakData.zak // Add ZAK token for host authentication
      });
      
      setActiveMeeting(meetingData.meetingNumber);
      setIsHosting(true);
      
      toast({
        title: "Meeting Created",
        description: `Meeting ${meetingData.meetingNumber} created successfully`,
      });
    } catch (error: any) {
      console.error('Failed to create meeting:', error);
      setError(error.message || 'Failed to create meeting');
      toast({
        title: "Error",
        description: error.message || "Failed to create meeting",
        variant: "destructive"
      });
    } finally {
      setIsStartingMeeting(false);
    }
  };

  const handleMeetingEnd = () => {
    setActiveMeeting(null);
    setIsHosting(false);
    setZoomCredentials(null);
    toast({
      title: "Meeting Ended",
      description: "You have left the Zoom meeting"
    });
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
              onClick={() => handleMeetingEnd()}
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
            meetingNumber={activeMeeting}
            userName={user?.email || 'Guest'} 
            role={isHosting ? 1 : 0} // 1 for host, 0 for attendee
            onMeetingEnd={handleMeetingEnd}
            zak={zoomCredentials?.zak} // Pass ZAK token to ZoomMeeting component
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
                Start an instant meeting with proper ZAK token authentication for host role.
              </p>
              {error && (
                <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
                  {error}
                </div>
              )}
              <Button 
                onClick={handleStartMeeting}
                disabled={isStartingMeeting}
                className="w-full"
              >
                {isStartingMeeting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Starting Meeting...
                  </>
                ) : (
                  <>Start Test Meeting</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Meetings;

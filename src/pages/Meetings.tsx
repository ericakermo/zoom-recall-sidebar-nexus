import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, SubmitHandler } from 'react-hook-form';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ZoomMeeting } from '@/components/ZoomMeeting';

interface MeetingFormData {
  meetingId: string;
}

interface ZoomCredentials {
  meetingNumber: string;
  accessToken: string;
  tokenType: string;
  sdkKey: string;
  userName?: string;
  userEmail?: string;
  role: number;
  password?: string;
  zak?: string;
}

const Meetings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors } } = useForm<MeetingFormData>();

  const [activeMeeting, setActiveMeeting] = useState<string | null>(null);
  const [isHosting, setIsHosting] = useState(false);
  const [isStartingMeeting, setIsStartingMeeting] = useState(false);
  const [zoomCredentials, setZoomCredentials] = useState<ZoomCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);

  const joinMeeting: SubmitHandler<MeetingFormData> = (data) => {
    console.log('🎯 [Calendar] Starting meeting join process for meeting ID:', data.meetingId);
    setActiveMeeting(data.meetingId);
    setIsHosting(false);
    setZoomCredentials({
        meetingNumber: data.meetingId,
        accessToken: '',
        tokenType: '',
        sdkKey: '',
        userName: user?.email || 'Guest',
        userEmail: user?.email,
        role: 0,
        password: '',
        zak: ''
    });

    toast({
        title: "Joining Meeting",
        description: `Attempting to join meeting ${data.meetingId}`,
    });
  };

  const handleStartMeeting = async () => {
    setIsStartingMeeting(true);
    setError(null);
    console.log('🎯 [Calendar] Attempting to start a new meeting...');

    try {
      if (!user?.email) {
        throw new Error('Authentication required');
      }
      
      const { data: tokenData, error: tokenError } = await supabase.auth.getSession();
      if (tokenError || !tokenData.session) {
         throw new Error('Authentication required to create meeting');
      }
      const authToken = tokenData.session.access_token;

      console.log("Creating meeting via backend function...");
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
            join_before_host: true,
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

      setZoomCredentials({
        meetingNumber: meetingData.meetingNumber,
        accessToken: meetingData.accessToken,
        tokenType: 'Bearer',
        sdkKey: 'dkQMavedS2OWM2c73F6pLg',
        userName: user?.email || 'Host',
        userEmail: user?.email,
        role: 1,
        password: meetingData.password || '',
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

      {zoomCredentials ? (
        <div className="h-[80vh] relative border rounded-lg overflow-hidden">
          <div className="absolute top-4 right-4 z-10">
            <Button 
              variant="outline" 
              size="sm"
              className="bg-white/80 hover:bg-white/90 text-black"
              onClick={handleMeetingEnd}
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
            meetingNumber={zoomCredentials.meetingNumber}
            userName={zoomCredentials.userName}
            role={zoomCredentials.role}
            password={zoomCredentials.password}
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

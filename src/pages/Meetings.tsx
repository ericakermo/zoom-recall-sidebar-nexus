
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ZoomMeeting } from '@/components/ZoomMeeting';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Video } from 'lucide-react';

interface MeetingFormData {
  meetingId: string;
}

const Meetings = () => {
  const [activeMeeting, setActiveMeeting] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<MeetingFormData>();
  const { toast } = useToast();
  const { user } = useAuth();

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
  };

  const handleMeetingEnd = () => {
    setActiveMeeting(null);
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
        <div className="h-[80vh] relative">
          <Button 
            variant="outline" 
            className="absolute top-2 right-2 z-10"
            onClick={() => setActiveMeeting(null)}
          >
            Leave Meeting
          </Button>
          <ZoomMeeting 
            meetingNumber={activeMeeting}
            onMeetingEnd={handleMeetingEnd}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Join a Meeting</CardTitle>
              <CardDescription>Enter a Zoom meeting ID to join</CardDescription>
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
                <Button type="submit">Join Meeting</Button>
              </form>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Host a Meeting</CardTitle>
              <CardDescription>Start your own Zoom meeting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                To host a meeting, you need to connect your Zoom account first in the Settings page.
              </p>
              <Button onClick={() => window.location.href = '/settings'}>
                Go to Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Meetings;

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ZoomMeetingSample } from '@/components/ZoomMeetingSample';
import { useToast } from '@/hooks/use-toast';
import { Video } from 'lucide-react';

interface MeetingFormData {
  meetingId: string;
  userName: string;
  password: string;
}

export default function ZoomSample() {
  const [activeMeeting, setActiveMeeting] = useState<string | null>(null);
  const [meetingDetails, setMeetingDetails] = useState<{
    userName: string;
    password: string;
  } | null>(null);
  
  const { register, handleSubmit, formState: { errors } } = useForm<MeetingFormData>();
  const { toast } = useToast();

  const joinMeeting = (data: MeetingFormData) => {
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
    setMeetingDetails({
      userName: data.userName,
      password: data.password
    });
  };

  const handleMeetingEnd = () => {
    setActiveMeeting(null);
    setMeetingDetails(null);
    toast({
      title: "Meeting Ended",
      description: "You have left the Zoom meeting"
    });
  };

  if (activeMeeting && meetingDetails) {
    return (
      <div className="p-6">
        <Button 
          onClick={handleMeetingEnd} 
          variant="outline" 
          className="mb-4"
        >
          Back to Form
        </Button>
        
        <ZoomMeetingSample 
          meetingNumber={activeMeeting}
          userName={meetingDetails.userName}
          passWord={meetingDetails.password}
          onMeetingEnd={handleMeetingEnd}
          leaveUrl={window.location.href}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 flex items-center">
        <Video className="mr-2" />
        Zoom Meeting Sample
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Join a Zoom Meeting</CardTitle>
          <CardDescription>Enter the meeting details to join a Zoom meeting</CardDescription>
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
            
            <div className="space-y-2">
              <Label htmlFor="userName">Your Name</Label>
              <Input 
                id="userName"
                placeholder="Enter your name"
                {...register("userName", { 
                  required: "Your name is required"
                })} 
              />
              {errors.userName && (
                <p className="text-sm text-red-500">{errors.userName.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Meeting Password (if required)</Label>
              <Input 
                id="password"
                type="password"
                placeholder="Meeting password (optional)"
                {...register("password")} 
              />
            </div>
            
            <Button type="submit" className="w-full">
              <Video className="mr-2 h-4 w-4" />
              Join Meeting
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

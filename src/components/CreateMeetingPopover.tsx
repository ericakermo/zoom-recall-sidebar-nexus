import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { X, Plus, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface CreateMeetingPopoverProps {
  children: React.ReactNode;
}

const CreateMeetingPopover = ({ children }: CreateMeetingPopoverProps) => {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(new Date()); // Set to today by default
  const [startTime, setStartTime] = useState('22:00'); // Default to 22:00 as requested
  const [endDate, setEndDate] = useState<Date | undefined>(new Date()); // Set to today by default
  const [endTime, setEndTime] = useState('22:30'); // Default to 30 minutes later
  const [attendees, setAttendees] = useState<string[]>(['']);
  const [meetingType, setMeetingType] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Set default times when component mounts
  useEffect(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // If it's past 22:00, set for tomorrow
    if (currentHour >= 22) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      setStartDate(tomorrow);
      setEndDate(tomorrow);
    }
  }, []);

  // Generate time options with 15-minute intervals
  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        times.push(timeString);
      }
    }
    return times;
  };

  const timeOptions = generateTimeOptions();

  const addAttendee = () => {
    setAttendees([...attendees, '']);
  };

  const updateAttendee = (index: number, value: string) => {
    const newAttendees = [...attendees];
    newAttendees[index] = value;
    setAttendees(newAttendees);
  };

  const removeAttendee = (index: number) => {
    if (attendees.length > 1) {
      const newAttendees = attendees.filter((_, i) => i !== index);
      setAttendees(newAttendees);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to create meetings.",
        variant: "destructive",
      });
      return;
    }

    if (!title || !startDate || !endDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      // Calculate duration in minutes
      const startDateTime = new Date(startDate);
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      startDateTime.setHours(startHours, startMinutes, 0, 0);

      const endDateTime = new Date(endDate);
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      endDateTime.setHours(endHours, endMinutes, 0, 0);

      const duration = Math.round((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60));

      if (duration <= 0) {
        toast({
          title: "Invalid Duration",
          description: "End time must be after start time.",
          variant: "destructive",
        });
        setIsCreating(false);
        return;
      }

      console.log("Creating meeting with:", {
        topic: title,
        start_time: startDateTime.toISOString(),
        duration: duration,
        type: 2 // Scheduled meeting
      });

      const meetingSettings = {
        topic: title,
        type: 2, // Scheduled meeting
        start_time: startDateTime.toISOString(),
        duration: duration,
        timezone: 'UTC',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          waiting_room: true,
        }
      };

      const { data, error } = await supabase.functions.invoke('create-zoom-meeting', {
        body: meetingSettings
      });

      if (error) {
        console.error("Supabase function error:", error);
        throw new Error(error.message || 'Failed to create meeting');
      }

      if (!data || data.error) {
        console.error("Meeting creation failed:", data);
        throw new Error(data?.error || 'Failed to create meeting');
      }

      console.log("Meeting created successfully:", data);

      toast({
        title: "Meeting Created",
        description: `Meeting "${title}" has been created successfully for ${format(startDateTime, 'MMM do, yyyy')} at ${startTime}.`,
      });

      // Reset form but keep today's date
      setTitle('');
      setStartTime('22:00');
      setEndTime('22:30');
      setAttendees(['']);
      setMeetingType('');
      setOpen(false);

      // Trigger a refresh of meetings by dispatching a custom event
      window.dispatchEvent(new CustomEvent('meetingCreated'));

    } catch (error: any) {
      console.error('Error creating meeting:', error);
      toast({
        title: "Error Creating Meeting",
        description: error.message || "Failed to create Zoom meeting. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const formatDisplayDate = (date: Date | undefined) => {
    if (!date) return '';
    return format(date, 'MMM do, yy');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        className="w-96 p-6 bg-white border-[0.5px] border-black border-opacity-10 z-[100]" 
        align="start"
        side="right"
        sideOffset={8}
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-black">Create Meeting</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="h-6 w-6 p-0 hover:bg-black hover:bg-opacity-10"
            >
              <X className="h-4 w-4 text-black opacity-60" />
            </Button>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-black">Meeting Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter meeting title"
              className="border-[0.5px] border-black border-opacity-10 focus:border-black focus:border-opacity-20 placeholder:text-black placeholder:opacity-20"
            />
          </div>

          {/* Start Date and Time */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-black">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal border-[0.5px] border-black border-opacity-10 hover:bg-black hover:bg-opacity-5"
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    <span className={startDate ? "text-black" : "text-black opacity-20"}>
                      {startDate ? formatDisplayDate(startDate) : "Pick date"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-[0.5px] border-black border-opacity-10 z-[110]" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-black">Start Time</label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger className="border-[0.5px] border-black border-opacity-10 focus:border-black focus:border-opacity-20">
                  <SelectValue placeholder="Select time" className="text-black opacity-20" />
                </SelectTrigger>
                <SelectContent className="bg-white border-[0.5px] border-black border-opacity-10 z-[110]">
                  {timeOptions.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* End Date and Time */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-black">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal border-[0.5px] border-black border-opacity-10 hover:bg-black hover:bg-opacity-5"
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    <span className={endDate ? "text-black" : "text-black opacity-20"}>
                      {endDate ? formatDisplayDate(endDate) : "Pick date"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-[0.5px] border-black border-opacity-10 z-[110]" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-black">End Time</label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger className="border-[0.5px] border-black border-opacity-10 focus:border-black focus:border-opacity-20">
                  <SelectValue placeholder="Select time" className="text-black opacity-20" />
                </SelectTrigger>
                <SelectContent className="bg-white border-[0.5px] border-black border-opacity-10 z-[110]">
                  {timeOptions.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Attendees */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-black">Attendees</label>
            {attendees.map((attendee, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={attendee}
                  onChange={(e) => updateAttendee(index, e.target.value)}
                  placeholder="Enter email address"
                  className="flex-1 border-[0.5px] border-black border-opacity-10 focus:border-black focus:border-opacity-20 placeholder:text-black placeholder:opacity-20"
                />
                {attendees.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAttendee(index)}
                    className="h-10 w-10 p-0 hover:bg-black hover:bg-opacity-10"
                  >
                    <X className="h-4 w-4 text-black opacity-60" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              onClick={addAttendee}
              className="w-full h-8 text-black opacity-60 hover:opacity-100 hover:bg-black hover:bg-opacity-5"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Attendee
            </Button>
          </div>

          {/* Meeting Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-black">Meeting Type</label>
            <Select value={meetingType} onValueChange={setMeetingType}>
              <SelectTrigger className="border-[0.5px] border-black border-opacity-10 focus:border-black focus:border-opacity-20">
                <SelectValue placeholder="Select meeting type" className="text-black opacity-20" />
              </SelectTrigger>
              <SelectContent className="bg-white border-[0.5px] border-black border-opacity-10 z-[110]">
                <SelectItem value="intro">Intro</SelectItem>
                <SelectItem value="discovery">Discovery</SelectItem>
                <SelectItem value="closing">Closing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={isCreating}
            className="w-full bg-black hover:bg-black hover:bg-opacity-80 text-white"
          >
            {isCreating ? 'Creating Meeting...' : 'Create Meeting'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default CreateMeetingPopover;

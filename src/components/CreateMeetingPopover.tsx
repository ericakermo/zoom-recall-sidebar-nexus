
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { X, Plus, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

interface CreateMeetingPopoverProps {
  children: React.ReactNode;
}

const CreateMeetingPopover = ({ children }: CreateMeetingPopoverProps) => {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [endTime, setEndTime] = useState('');
  const [attendees, setAttendees] = useState<string[]>(['']);
  const [meetingType, setMeetingType] = useState<string>('');
  const [open, setOpen] = useState(false);

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

  const handleSubmit = () => {
    // Handle meeting creation logic here
    console.log({
      title,
      startDate,
      startTime,
      endDate,
      endTime,
      attendees: attendees.filter(email => email.trim() !== ''),
      meetingType
    });
    setOpen(false);
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
              className="border-[0.5px] border-black border-opacity-10 focus:border-black focus:border-opacity-20"
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
                    {startDate ? formatDisplayDate(startDate) : "Pick date"}
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
                  <SelectValue placeholder="Select time" />
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
                    {endDate ? formatDisplayDate(endDate) : "Pick date"}
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
                  <SelectValue placeholder="Select time" />
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
                  className="flex-1 border-[0.5px] border-black border-opacity-10 focus:border-black focus:border-opacity-20"
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
                <SelectValue placeholder="Select meeting type" />
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
            className="w-full bg-black hover:bg-black hover:bg-opacity-80 text-white"
          >
            Create Meeting
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default CreateMeetingPopover;

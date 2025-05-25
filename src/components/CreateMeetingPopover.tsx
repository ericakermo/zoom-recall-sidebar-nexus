
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus } from 'lucide-react';

interface CreateMeetingPopoverProps {
  children: React.ReactNode;
}

const CreateMeetingPopover = ({ children }: CreateMeetingPopoverProps) => {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [attendees, setAttendees] = useState<string[]>(['']);
  const [meetingType, setMeetingType] = useState<string>('');
  const [open, setOpen] = useState(false);

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        className="w-96 p-6 bg-white border border-black border-opacity-20" 
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
              className="border-black border-opacity-20 focus:border-black focus:border-opacity-40"
            />
          </div>

          {/* Start Date and Time */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-black">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-black border-opacity-20 focus:border-black focus:border-opacity-40"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-black">Start Time</label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="border-black border-opacity-20 focus:border-black focus:border-opacity-40"
              />
            </div>
          </div>

          {/* End Date and Time */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-black">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border-black border-opacity-20 focus:border-black focus:border-opacity-40"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-black">End Time</label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="border-black border-opacity-20 focus:border-black focus:border-opacity-40"
              />
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
                  className="flex-1 border-black border-opacity-20 focus:border-black focus:border-opacity-40"
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
              <SelectTrigger className="border-black border-opacity-20 focus:border-black focus:border-opacity-40">
                <SelectValue placeholder="Select meeting type" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-black border-opacity-20">
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

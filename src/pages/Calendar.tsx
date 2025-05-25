
import React, { useState } from 'react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Plus, ChevronLeft, ChevronRight, X, RefreshCw, ExternalLink } from 'lucide-react';
import { useZoomMeetings } from '@/hooks/useZoomMeetings';
import { format } from 'date-fns';

const Calendar = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const { meetings, isLoading, isSyncing, syncMeetings } = useZoomMeetings(date);

  const handleJoinMeeting = (joinUrl: string) => {
    if (joinUrl) {
      window.open(joinUrl, '_blank');
    }
  };

  const formatMeetingTime = (startTime: string, duration: number) => {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60000);
    return {
      startTime: format(start, 'HH:mm'),
      endTime: format(end, 'HH:mm')
    };
  };

  return (
    <div className="p-6 h-full">
      <div className="flex items-start gap-6 h-full">
        {/* Calendar on the left */}
        <div className="flex-shrink-0">
          <CalendarComponent 
            mode="single" 
            selected={date} 
            onSelect={setDate} 
            className="rounded-lg border border-border p-3 pointer-events-auto [&_.rdp-day_selected]:!bg-black [&_.rdp-day_selected]:!text-white [&_.rdp-day_selected:hover]:!bg-black [&_.rdp-day_selected:hover]:!text-white [&_button[aria-selected='true']]:!bg-black [&_button[aria-selected='true']]:!text-white [&_button[aria-selected='true']:hover]:!bg-black [&_button[aria-selected='true']:hover]:!text-white" 
          />
        </div>
        
        {/* Vertical line */}
        <div className="flex items-center h-full">
          <div className="w-0.5 h-[95%] bg-black opacity-20"></div>
        </div>
        
        {/* Right side content */}
        <div className="flex flex-col gap-4 flex-1">
          {/* Buttons section */}
          <div className="flex items-center gap-2 self-start">
            {/* Sync button with refresh icon */}
            <Button 
              size="icon" 
              className="rounded-full bg-black hover:bg-black/80 text-white w-10 h-10"
              onClick={syncMeetings}
              disabled={isSyncing}
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>

            {/* Chevron buttons */}
            <div className="flex gap-1">
              <Button size="icon" className="rounded-md bg-black hover:bg-black/80 text-white w-8 h-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Button size="icon" className="rounded-md bg-black hover:bg-black/80 text-white w-8 h-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Horizontal line below all buttons */}
          <div className="w-full h-px bg-black opacity-10"></div>

          {/* Today header */}
          <p className="text-sm font-medium text-left">
            {date ? format(date, 'EEEE, MMMM d') : 'Today'}
          </p>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2 text-sm text-gray-600">Loading meetings...</span>
            </div>
          )}

          {/* Meetings section */}
          <div className="flex flex-col gap-4 w-full">
            {!isLoading && meetings.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No meetings scheduled for this day</p>
                <p className="text-xs mt-1">Click the sync button to fetch your Zoom meetings</p>
              </div>
            )}

            {meetings.map((meeting, index) => {
              const { startTime, endTime } = formatMeetingTime(meeting.start_time, meeting.duration);
              const variants = ['default', 'warning', 'info'] as const;
              const variant = variants[index % variants.length];

              return (
                <Alert
                  key={meeting.id}
                  layout="row"
                  isNotification
                  className="w-[90%] bg-background"
                  variant={variant}
                  action={
                    <div className="flex items-center gap-3">
                      <Button 
                        size="sm"
                        onClick={() => handleJoinMeeting(meeting.join_url)}
                        disabled={!meeting.join_url}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Join Meeting
                      </Button>
                      <Button
                        variant="ghost"
                        className="group -my-1.5 -me-2 size-8 shrink-0 p-0 hover:bg-transparent"
                        aria-label="Close banner"
                      >
                        <X
                          size={16}
                          strokeWidth={2}
                          className="opacity-60 transition-opacity group-hover:opacity-100"
                          aria-hidden="true"
                        />
                      </Button>
                    </div>
                  }
                >
                  <div className="flex grow items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <p className="h-6 text-xs w-16 px-2 py-1">{startTime}</p>
                      <p className="h-6 text-xs w-16 px-2 py-1">{endTime}</p>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-medium">{meeting.title}</p>
                      <p className="text-xs text-gray-500">{meeting.duration} minutes</p>
                    </div>
                  </div>
                </Alert>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;


import React, { useState, useEffect } from 'react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Plus, ChevronLeft, ChevronRight, CircleCheck, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

interface ZoomMeeting {
  id: string;
  meeting_id: string;
  title: string;
  start_time: string;
  duration: number;
  user_id: string;
}

const Calendar = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [meetings, setMeetings] = useState<ZoomMeeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
          .from('zoom_meetings')
          .select('*')
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true });

        if (error) throw error;
        setMeetings(data || []);
      } catch (err: any) {
        console.error('Error fetching meetings:', err);
        toast({
          title: "Error",
          description: err.message,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchMeetings();
  }, [toast]);

  const getMeetingsForDate = (date: Date) => {
    return meetings.filter(meeting => {
      const meetingDate = new Date(meeting.start_time);
      return meetingDate.toDateString() === date.toDateString();
    });
  };

  const formatMeetingTime = (startTime: string, duration: number) => {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60000);
    return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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
            {/* Circle button with plus */}
            <Button size="icon" className="rounded-full bg-black hover:bg-black/80 text-white w-10 h-10">
              <Plus className="h-4 w-4" />
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

          {/* Alert components section */}
          <div className="flex flex-col gap-4 w-full">
            {date && getMeetingsForDate(date).map((meeting) => (
              <Alert
                key={meeting.id}
                layout="row"
                isNotification
                className="w-[90%] bg-background"
                icon={
                  <CircleCheck
                    className="text-emerald-500"
                    size={16}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                }
                action={
                  <div className="flex items-center gap-3">
                    <Button 
                      size="sm"
                      onClick={() => navigate(`/meeting/${meeting.id}`)}
                    >
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
                <div className="flex grow items-center justify-between gap-12">
                  <div>
                    <p className="text-sm font-medium">{meeting.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatMeetingTime(meeting.start_time, meeting.duration)}
                    </p>
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;

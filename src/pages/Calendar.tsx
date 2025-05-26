
import React, { useState } from 'react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Plus, ChevronLeft, ChevronRight, X, RefreshCw, ExternalLink } from 'lucide-react';
import { useZoomMeetings } from '@/hooks/useZoomMeetings';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import CreateMeetingPopover from '@/components/CreateMeetingPopover';
import MeetingDetailsPopover from '@/components/MeetingDetailsPopover';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

const Calendar = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const navigate = useNavigate();
  const { meetings, isLoading, isSyncing, syncMeetings } = useZoomMeetings(date);

  const handleJoinMeeting = async (meetingId: string) => {
    try {
      console.log('🎯 Starting meeting join process for meeting ID:', meetingId);
      
      // 1. Get user session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      console.log('✅ User authenticated:', user.email);

      // 2. Get meeting details with proper validation
      const { data: meeting, error: meetingError } = await supabase
        .from('zoom_meetings')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (meetingError) throw meetingError;
      console.log('✅ Meeting details retrieved:', meeting);

      // 3. Validate meeting status
      const meetingStatus = await validateMeetingStatus(meeting.zoom_meeting_id);
      console.log('ℹ️ Meeting status:', meetingStatus);

      if (!meetingStatus.canJoin) {
        throw new Error(meetingStatus.reason || 'Meeting is not ready to join');
      }

      // 4. Get tokens with proper error handling
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
        body: { 
          meetingNumber: meeting.zoom_meeting_id,
          role: meeting.user_id === user.id ? 1 : 0
        }
      });

      if (tokenError) throw tokenError;
      console.log('✅ Tokens retrieved successfully');

      // 5. Navigate to meeting page with state
      navigate(`/meeting/${meetingId}`, {
        state: {
          meeting,
          tokens: tokenData,
          isHost: meeting.user_id === user.id
        }
      });

    } catch (error) {
      console.error('❌ Join process failed:', error);
      toast({
        title: "Error joining meeting",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleCloseMeeting = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent popover from opening
    // Add close functionality here if needed
  };

  const formatMeetingTime = (startTime: string, duration: number) => {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60000);
    return {
      startTime: format(start, 'HH:mm'),
      endTime: format(end, 'HH:mm')
    };
  };

  const validateMeetingStatus = async (meetingId: string) => {
    const { data, error } = await supabase.functions.invoke('validate-meeting-status', {
      body: { meetingId }
    });

    if (error) throw error;
    return data;
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
            {/* Refresh button */}
            <Button 
              size="icon" 
              variant="ghost"
              onClick={syncMeetings}
              disabled={isSyncing}
              className="w-10 h-10 p-0 hover:bg-black hover:bg-opacity-10"
            >
              <RefreshCw className={`h-4 w-4 text-black opacity-10 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>

            {/* Plus button with popover */}
            <CreateMeetingPopover>
              <Button 
                size="icon" 
                className="rounded-full bg-black hover:bg-black/80 text-white w-10 h-10"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </CreateMeetingPopover>

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
                <MeetingDetailsPopover key={meeting.id} meeting={meeting}>
                  <div className="cursor-pointer">
                    <Alert
                      layout="row"
                      isNotification
                      className="w-[90%] bg-background hover:border-opacity-50 transition-all duration-200"
                      variant={variant}
                      action={
                        <div className="flex items-center gap-3">
                          <Button 
                            size="sm"
                            onClick={() => handleJoinMeeting(meeting.id)}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Join Meeting
                          </Button>
                          <Button
                            variant="ghost"
                            className="group -my-1.5 -me-2 size-8 shrink-0 p-0 hover:bg-transparent"
                            aria-label="Close banner"
                            onClick={handleCloseMeeting}
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
                  </div>
                </MeetingDetailsPopover>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;

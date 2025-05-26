

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
      const meetingStatus = await validateMeetingStatus(meeting.meeting_id);
      console.log('ℹ️ Meeting status:', meetingStatus);

      if (!meetingStatus.canJoin) {
        toast({
          title: "Cannot join meeting",
          description: meetingStatus.reason || 'Meeting is not ready to join',
          variant: "destructive"
        });
        return;
      }

      // Show status-specific messages
      if (meetingStatus.status === 'waiting') {
        toast({
          title: "Joining meeting",
          description: "Meeting is in waiting room",
        });
      }

      // 4. Get tokens with proper error handling
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
        body: { 
          meetingNumber: meeting.meeting_id,
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
          isHost: meeting.user_id === user.id,
          meetingStatus
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

  const getMeetingStatusBadge = (meeting: any) => {
    const now = new Date();
    const startTime = new Date(meeting.start_time);
    const endTime = new Date(startTime.getTime() + meeting.duration * 60000);
    
    if (now > endTime) {
      return <span className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-full">Ended</span>;
    } else if (now >= startTime) {
      return <span className="text-xs px-2 py-1 bg-green-200 text-green-700 rounded-full animate-pulse">Live</span>;
    } else {
      const minutesUntilStart = Math.floor((startTime.getTime() - now.getTime()) / 60000);
      if (minutesUntilStart <= 10) {
        return <span className="text-xs px-2 py-1 bg-yellow-200 text-yellow-700 rounded-full">Starting soon</span>;
      }
      return <span className="text-xs px-2 py-1 bg-blue-200 text-blue-700 rounded-full">Upcoming</span>;
    }
  };

  return (
    <div className="p-6 h-full bg-gradient-to-br from-gray-50 to-white">
      <div className="flex items-start gap-8 h-full max-w-7xl mx-auto">
        {/* Enhanced Calendar Section */}
        <div className="flex-shrink-0 bg-white rounded-xl shadow-lg border border-gray-100 p-1">
          <CalendarComponent 
            mode="single" 
            selected={date} 
            onSelect={setDate} 
            className="rounded-lg p-3 [&_.rdp-day_selected]:!bg-black [&_.rdp-day_selected]:!text-white [&_.rdp-day_selected:hover]:!bg-black [&_.rdp-day_selected:hover]:!text-white [&_button[aria-selected='true']]:!bg-black [&_button[aria-selected='true']]:!text-white [&_button[aria-selected='true']:hover]:!bg-black [&_button[aria-selected='true']:hover]:!text-white" 
          />
        </div>
        
        {/* Enhanced Vertical Divider */}
        <div className="flex items-center h-full">
          <div className="w-px h-[90%] bg-gradient-to-b from-transparent via-gray-300 to-transparent opacity-60"></div>
        </div>
        
        {/* Enhanced Right Side Content */}
        <div className="flex flex-col gap-6 flex-1">
          {/* Enhanced Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                size="icon" 
                variant="outline"
                onClick={syncMeetings}
                disabled={isSyncing}
                className="w-10 h-10 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200"
              >
                <RefreshCw className={`h-4 w-4 text-gray-600 ${isSyncing ? 'animate-spin' : ''}`} />
              </Button>

              <CreateMeetingPopover>
                <Button 
                  size="icon" 
                  className="rounded-full bg-black hover:bg-gray-800 text-white w-10 h-10 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </CreateMeetingPopover>

              <div className="flex gap-2">
                <Button 
                  size="icon" 
                  className="rounded-lg bg-black hover:bg-gray-800 text-white w-9 h-9 shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <Button 
                  size="icon" 
                  className="rounded-lg bg-black hover:bg-gray-800 text-white w-9 h-9 shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Enhanced Sync Status */}
            {isSyncing && (
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-full border border-blue-100">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Syncing meetings...
              </div>
            )}
          </div>

          {/* Enhanced Date Header */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">
              {date ? format(date, 'EEEE, MMMM d, yyyy') : 'Today'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {meetings.length} {meetings.length === 1 ? 'meeting' : 'meetings'} scheduled
            </p>
          </div>

          {/* Enhanced Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-gray-400" />
                <p className="text-sm text-gray-600">Loading your meetings...</p>
              </div>
            </div>
          )}

          {/* Enhanced Meetings Section */}
          <div className="flex flex-col gap-4">
            {!isLoading && meetings.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-100 shadow-sm">
                <div className="max-w-sm mx-auto">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Plus className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No meetings today</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    You don't have any meetings scheduled for this day
                  </p>
                  <p className="text-xs text-gray-400">
                    Click the sync button to fetch your latest Zoom meetings
                  </p>
                </div>
              </div>
            )}

            {meetings.map((meeting, index) => {
              const { startTime, endTime } = formatMeetingTime(meeting.start_time, meeting.duration);
              const variants = ['default', 'warning', 'info'] as const;
              const variant = variants[index % variants.length];

              return (
                <MeetingDetailsPopover key={meeting.id} meeting={meeting}>
                  <div className="cursor-pointer group">
                    <Alert
                      layout="row"
                      isNotification
                      className="bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 group-hover:scale-[1.02]"
                      variant={variant}
                      action={
                        <div className="flex items-center gap-3">
                          <Button 
                            size="sm"
                            onClick={() => handleJoinMeeting(meeting.id)}
                            className="bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow-md transition-all duration-200"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Join
                          </Button>
                          <Button
                            variant="ghost"
                            className="group/close -my-1.5 -me-2 size-8 shrink-0 p-0 hover:bg-gray-100 transition-colors duration-200"
                            aria-label="Close"
                            onClick={handleCloseMeeting}
                          >
                            <X
                              size={16}
                              strokeWidth={2}
                              className="opacity-40 group-hover/close:opacity-70 transition-opacity duration-200"
                              aria-hidden="true"
                            />
                          </Button>
                        </div>
                      }
                    >
                      <div className="flex grow items-center gap-6">
                        <div className="flex flex-col gap-1 min-w-[60px]">
                          <div className="text-xs font-medium text-gray-900 bg-gray-50 px-2 py-1 rounded text-center">
                            {startTime}
                          </div>
                          <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded text-center">
                            {endTime}
                          </div>
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-sm font-semibold text-gray-900 truncate">{meeting.title}</h3>
                            {getMeetingStatusBadge(meeting)}
                          </div>
                          <p className="text-xs text-gray-500">
                            {meeting.duration} minutes • Meeting ID: {meeting.meeting_id}
                          </p>
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

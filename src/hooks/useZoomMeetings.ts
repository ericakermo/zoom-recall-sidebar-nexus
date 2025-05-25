
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ZoomMeeting {
  id: string;
  meeting_id: string;
  title: string;
  start_time: string;
  duration: number;
  join_url: string;
  created_at: string;
  updated_at: string;
}

export const useZoomMeetings = (selectedDate?: Date) => {
  const [meetings, setMeetings] = useState<ZoomMeeting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchMeetingsForDate = async (date: Date) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('zoom_meetings')
        .select('*')
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching meetings:', error);
        toast({
          title: "Error",
          description: "Failed to fetch meetings",
          variant: "destructive"
        });
        return;
      }

      setMeetings(data || []);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      toast({
        title: "Error",
        description: "Failed to fetch meetings",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const syncMeetings = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to sync meetings",
        variant: "destructive"
      });
      return;
    }

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-zoom-meetings', {
        body: { user_id: user.id },
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: `Synced ${data?.synced_meetings || 0} meetings from Zoom`,
      });

      // Refresh meetings after sync
      if (selectedDate) {
        fetchMeetingsForDate(selectedDate);
      }
    } catch (error) {
      console.error('Error syncing meetings:', error);
      toast({
        title: "Error",
        description: "Failed to sync meetings from Zoom. Please check your Zoom connection.",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (selectedDate && user) {
      fetchMeetingsForDate(selectedDate);
    }
  }, [selectedDate, user]);

  return {
    meetings,
    isLoading,
    isSyncing,
    syncMeetings,
    fetchMeetingsForDate,
  };
};

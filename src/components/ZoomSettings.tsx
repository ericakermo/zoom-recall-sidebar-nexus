
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';

const joinMeetingSchema = z.object({
  meetingId: z.string().min(9, 'Meeting ID must be at least 9 characters'),
  meetingPassword: z.string().optional(),
});

export function ZoomSettings() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const joinForm = useForm<z.infer<typeof joinMeetingSchema>>({
    resolver: zodResolver(joinMeetingSchema),
    defaultValues: {
      meetingId: '',
      meetingPassword: '',
    },
  });

  useEffect(() => {
    const checkZoomConnection = async () => {
      if (!user) return;

      try {
        // Use a generic approach to query the zoom_connections table
        const { data, error } = await supabase
          .from('zoom_connections' as any)
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
          throw error;
        }
        
        setIsConnected(!!data);
      } catch (error) {
        console.error('Error checking Zoom connection:', error);
        toast({
          title: "Error",
          description: "Failed to check Zoom connection status",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkZoomConnection();
  }, [user, toast]);

  const handleConnectZoom = () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You need to be logged in to connect Zoom",
        variant: "destructive"
      });
      return;
    }

    // Use the client ID from the environment variable
    const zoomClientId = "dkQMavedS2OWM2c73F6pLg";
    if (!zoomClientId) {
      toast({
        title: "Error",
        description: "Zoom client ID not configured",
        variant: "destructive"
      });
      return;
    }

    // Use the Supabase URL for the redirect URI
    const supabaseUrl = "https://qsxlvwwebbakmzpwjfbb.supabase.co";
    const redirectUri = `${supabaseUrl}/functions/v1/zoom-oauth-callback`;
    const zoomAuthUrl = `https://zoom.us/oauth/authorize?response_type=code&client_id=${
      zoomClientId
    }&redirect_uri=${encodeURIComponent(redirectUri)}&state=${user.id}`;
    
    window.location.href = zoomAuthUrl;
  };

  const handleDisconnectZoom = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      // Use a generic approach to query the zoom_connections table
      const { error } = await supabase
        .from('zoom_connections' as any)
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      
      setIsConnected(false);
      toast({
        title: "Success",
        description: "Zoom account disconnected successfully"
      });
    } catch (error) {
      console.error('Error disconnecting Zoom:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect Zoom account",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitJoinMeeting = (values: z.infer<typeof joinMeetingSchema>) => {
    navigate(`/meetings/join?meetingId=${values.meetingId}&password=${values.meetingPassword || ''}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zoom Integration</CardTitle>
        <CardDescription>
          Connect your Zoom account to join meetings directly from the app
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : isConnected ? (
          <div className="space-y-4">
            <p className="text-sm text-green-600">
              Your Zoom account is connected
            </p>
            <div className="flex flex-col md:flex-row gap-4">
              <Button 
                onClick={() => navigate('/meetings')} 
                className="w-full md:w-auto"
              >
                View My Meetings
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full md:w-auto">Join a Meeting</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Join Zoom Meeting</DialogTitle>
                    <DialogDescription>
                      Enter the meeting ID and password (if required) to join.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...joinForm}>
                    <form onSubmit={joinForm.handleSubmit(onSubmitJoinMeeting)} className="space-y-4">
                      <FormField
                        control={joinForm.control}
                        name="meetingId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Meeting ID</FormLabel>
                            <FormControl>
                              <Input placeholder="123 456 7890" {...field} />
                            </FormControl>
                            <FormDescription>
                              Enter the 9-11 digit meeting ID
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={joinForm.control}
                        name="meetingPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Meeting password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full">Join Meeting</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        ) : (
          <Button onClick={handleConnectZoom}>
            Connect Zoom Account
          </Button>
        )}
      </CardContent>
      {isConnected && (
        <CardFooter className="flex justify-end">
          <Button
            variant="destructive"
            onClick={handleDisconnectZoom}
            size="sm"
          >
            Disconnect Zoom Account
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}


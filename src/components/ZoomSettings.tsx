
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export function ZoomSettings() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const checkZoomConnection = async () => {
      if (!user) return;

      try {
        // Use a generic approach to query the zoom_connections table
        const { data, error } = await supabase
          .from('zoom_connections')
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
    const zoomClientId = "eFAZ8Vf7RbG5saQVqL1zGA";
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
        .from('zoom_connections')
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
            <Button
              variant="destructive"
              onClick={handleDisconnectZoom}
            >
              Disconnect Zoom Account
            </Button>
          </div>
        ) : (
          <Button onClick={handleConnectZoom}>
            Connect Zoom Account
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

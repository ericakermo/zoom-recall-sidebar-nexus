import { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ZoomSettings() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = useSupabaseClient();
  const user = useUser();

  useEffect(() => {
    const checkZoomConnection = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('zoom_connections')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        setIsConnected(!!data);
      } catch (error) {
        console.error('Error checking Zoom connection:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkZoomConnection();
  }, [user, supabase]);

  const handleConnectZoom = () => {
    // Redirect to Zoom OAuth
    const zoomAuthUrl = `https://zoom.us/oauth/authorize?response_type=code&client_id=${
      process.env.VITE_ZOOM_CLIENT_ID
    }&redirect_uri=${encodeURIComponent(
      `${window.location.origin}/api/zoom/callback`
    )}`;
    
    window.location.href = zoomAuthUrl;
  };

  const handleDisconnectZoom = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('zoom_connections')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      setIsConnected(false);
    } catch (error) {
      console.error('Error disconnecting Zoom:', error);
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
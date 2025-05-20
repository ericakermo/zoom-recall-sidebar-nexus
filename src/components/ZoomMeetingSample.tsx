
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getSignature } from '@/lib/zoom-config';

// Ensure the ZoomMtg is loaded
function loadZoomMtgScript() {
  const script = document.createElement('script');
  script.src = 'https://source.zoom.us/2.18.0/lib/vendor/react.min.js';
  script.async = true;
  document.body.appendChild(script);

  const scriptDom = document.createElement('script');
  scriptDom.src = 'https://source.zoom.us/2.18.0/lib/vendor/react-dom.min.js';
  scriptDom.async = true;
  document.body.appendChild(scriptDom);

  const scriptZoom = document.createElement('script');
  scriptZoom.src = 'https://source.zoom.us/2.18.0/lib/vendor/redux.min.js';
  scriptZoom.async = true;
  document.body.appendChild(scriptZoom);

  const scriptToolkit = document.createElement('script');
  scriptToolkit.src = 'https://source.zoom.us/2.18.0/lib/vendor/redux-thunk.min.js';
  scriptToolkit.async = true;
  document.body.appendChild(scriptToolkit);

  const scriptMain = document.createElement('script');
  scriptMain.src = 'https://source.zoom.us/2.18.0/zoom-meeting-2.18.0.min.js';
  scriptMain.async = true;
  document.body.appendChild(scriptMain);

  return new Promise<void>((resolve) => {
    scriptMain.onload = () => {
      resolve();
    };
  });
}

export interface ZoomMeetingSampleProps {
  meetingNumber: string;
  userName: string;
  userEmail?: string;
  passWord?: string;
  role?: number;
  leaveUrl?: string;
  onMeetingEnd?: () => void;
}

export function ZoomMeetingSample({
  meetingNumber,
  userName,
  userEmail = '',
  passWord = '',
  role = 0,
  leaveUrl = '/',
  onMeetingEnd
}: ZoomMeetingSampleProps) {
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const zoomContainer = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const apiKey = 'eFAZ8Vf7RbG5saQVqL1zGA'; // Your SDK key

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        // Load ZoomMtg script
        await loadZoomMtgScript();
        
        // Configure ZoomMtg
        window.ZoomMtg.setZoomJSLib('https://source.zoom.us/2.18.0/lib', '/av');
        window.ZoomMtg.preLoadWasm();
        window.ZoomMtg.prepareWebSDK();
        
        // Set language
        window.ZoomMtg.i18n.load('en-US');
        window.ZoomMtg.i18n.reload('en-US');
        
        setLoading(false);
      } catch (error) {
        console.error('Failed to initialize Zoom:', error);
        setError('Failed to initialize Zoom SDK');
        setLoading(false);
      }
    };

    init();

    // Cleanup
    return () => {
      if (window.ZoomMtg) {
        window.ZoomMtg.endMeeting(() => {
          console.log('Meeting ended during cleanup');
          onMeetingEnd?.();
        });
      }
    };
  }, []);

  const joinMeeting = async () => {
    if (!window.ZoomMtg) {
      setError('Zoom SDK not loaded');
      return;
    }

    try {
      setJoining(true);
      setError(null);
      
      // Get signature from your backend
      const signature = await getSignature(meetingNumber, role);
      
      // Initialize the meeting container
      if (zoomContainer.current) {
        window.ZoomMtg.init({
          leaveUrl: leaveUrl,
          success: (success: any) => {
            console.log('Init success:', success);
            
            // Join the meeting
            window.ZoomMtg.join({
              signature: signature,
              meetingNumber: meetingNumber,
              userName: userName,
              sdkKey: apiKey,
              userEmail: userEmail,
              passWord: passWord,
              tk: '',
              success: () => {
                console.log('Joined meeting successfully');
                setJoining(false);
                toast({
                  title: 'Meeting Joined',
                  description: 'You have successfully joined the Zoom meeting',
                });
              },
              error: (error: any) => {
                console.error('Failed to join meeting:', error);
                setError('Failed to join meeting: ' + (error.errorMessage || 'Unknown error'));
                setJoining(false);
              }
            });
          },
          error: (error: any) => {
            console.error('Failed to initialize meeting:', error);
            setError('Failed to initialize meeting: ' + (error.errorMessage || 'Unknown error'));
            setJoining(false);
          }
        });
      }
    } catch (error: any) {
      console.error('Error joining meeting:', error);
      setError('Error joining meeting: ' + (error.message || 'Unknown error'));
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Zoom SDK</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">{error}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="zoom-meeting">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Join Zoom Meeting</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="meeting-info">Meeting Information</Label>
              <div className="text-sm space-y-1 mt-1">
                <p><strong>Meeting ID:</strong> {meetingNumber}</p>
                <p><strong>Your Name:</strong> {userName}</p>
                <p><strong>Role:</strong> {role === 1 ? 'Host' : 'Attendee'}</p>
              </div>
            </div>
            
            <Button 
              onClick={joinMeeting} 
              disabled={joining}
              className="w-full"
            >
              {joining ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Joining...
                </>
              ) : 'Join Meeting'}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <div id="zmmtg-root"></div>
      <div id="aria-notify-area" ref={zoomContainer}></div>
    </div>
  );
}

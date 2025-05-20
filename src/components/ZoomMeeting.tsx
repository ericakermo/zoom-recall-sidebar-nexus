import React, { useEffect, useRef, useState } from 'react';
import { createAndInitializeZoomClient, getSignature, joinZoomMeeting, leaveZoomMeeting } from '@/lib/zoom-config';

interface ZoomMeetingProps {
  meetingNumber: string;
  userName: string;
  userEmail?: string;
  password?: string;
  role?: number;
  onLeave?: () => void;
}

export const ZoomMeeting: React.FC<ZoomMeetingProps> = ({
  meetingNumber,
  userName,
  userEmail,
  password,
  role = 0,
  onLeave
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isContainerReady, setIsContainerReady] = useState(false);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const zoomClientRef = useRef<any>(null);

  // Check container setup and dimensions
  useEffect(() => {
    const checkContainer = () => {
      if (zoomContainerRef.current) {
        const container = zoomContainerRef.current;
        const style = window.getComputedStyle(container);
        
        // Check if container is visible and has dimensions
        if (
          container.offsetWidth > 0 &&
          container.offsetHeight > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0'
        ) {
          console.log('Container is ready:', {
            width: container.offsetWidth,
            height: container.offsetHeight,
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity
          });
          setIsContainerReady(true);
          return true;
        }
      }
      return false;
    };

    // Initial check
    if (!checkContainer()) {
      // If not ready, retry every 500ms for up to 10 seconds
      let attempts = 0;
      const maxAttempts = 20;
      const interval = setInterval(() => {
        attempts++;
        if (checkContainer() || attempts >= maxAttempts) {
          clearInterval(interval);
        }
      }, 500);

      return () => clearInterval(interval);
    }
  }, []);

  // Initialize Zoom client and join meeting
  useEffect(() => {
    const initializeZoom = async () => {
      if (!isContainerReady || !zoomContainerRef.current) {
        console.log('Waiting for container to be ready...');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Create and initialize Zoom client
        const client = await createAndInitializeZoomClient(zoomContainerRef.current);
        zoomClientRef.current = client;
        setIsSDKLoaded(true);

        // Get signature for the meeting
        const signature = await getSignature(meetingNumber, role);

        // Join the meeting
        await joinZoomMeeting(client, {
          signature,
          meetingNumber,
          userName,
          password,
          userEmail
        });

        setIsConnected(true);
        setIsLoading(false);
      } catch (err: any) {
        console.error('Error initializing Zoom:', err);
        setError(err.message || 'Failed to initialize Zoom meeting');
        setIsLoading(false);
      }
    };

    initializeZoom();

    // Cleanup function
    return () => {
      if (zoomClientRef.current) {
        leaveZoomMeeting(zoomClientRef.current);
      }
    };
  }, [meetingNumber, userName, userEmail, password, role, isContainerReady]);

  // Handle meeting controls
  const toggleMute = async () => {
    if (zoomClientRef.current) {
      try {
        await zoomClientRef.current.mute();
        setIsMuted(!isMuted);
      } catch (error) {
        console.error('Error toggling mute:', error);
      }
    }
  };

  const toggleVideo = async () => {
    if (zoomClientRef.current) {
      try {
        await zoomClientRef.current.stopVideo();
        setIsVideoOff(!isVideoOff);
      } catch (error) {
        console.error('Error toggling video:', error);
      }
    }
  };

  const handleLeave = async () => {
    if (zoomClientRef.current) {
      try {
        await leaveZoomMeeting(zoomClientRef.current);
        if (onLeave) {
          onLeave();
        }
      } catch (error) {
        console.error('Error leaving meeting:', error);
      }
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-50">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p>Initializing Zoom meeting...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-50">
          <div className="bg-red-500 text-white p-4 rounded-lg max-w-md">
            <h3 className="text-lg font-semibold mb-2">Error</h3>
            <p>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-white text-red-500 rounded hover:bg-gray-100"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Meeting container */}
      <div
        ref={zoomContainerRef}
        id="meetingSDKElement"
        className="w-full h-full bg-gray-900"
        style={{ minHeight: '480px' }}
      />

      {/* Meeting controls */}
      {isConnected && (
        <div className="absolute bottom-0 left-0 right-0 bg-gray-800 bg-opacity-75 p-4 flex justify-center space-x-4">
          <button
            onClick={toggleMute}
            className={`p-2 rounded-full ${
              isMuted ? 'bg-red-500' : 'bg-gray-600'
            } text-white hover:bg-opacity-80`}
          >
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
          <button
            onClick={toggleVideo}
            className={`p-2 rounded-full ${
              isVideoOff ? 'bg-red-500' : 'bg-gray-600'
            } text-white hover:bg-opacity-80`}
          >
            {isVideoOff ? 'Start Video' : 'Stop Video'}
          </button>
          <button
            onClick={handleLeave}
            className="p-2 rounded-full bg-red-500 text-white hover:bg-opacity-80"
          >
            Leave
          </button>
        </div>
      )}
    </div>
  );
};

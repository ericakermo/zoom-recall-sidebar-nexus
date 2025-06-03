
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useZoomSDKEnhanced } from '@/hooks/useZoomSDKEnhanced';
import { useZoomSession } from '@/context/ZoomSessionContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ZoomComponentViewProps {
  meetingNumber: string;
  meetingPassword?: string;
  userName?: string;
  role?: number;
  onMeetingJoined?: (client: any) => void;
  onMeetingError?: (error: string) => void;
  onMeetingLeft?: () => void;
}

export function ZoomComponentView({
  meetingNumber,
  meetingPassword,
  userName: providedUserName,
  role = 0,
  onMeetingJoined,
  onMeetingError,
  onMeetingLeft
}: ZoomComponentViewProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState('Initializing...');
  const hasAttemptedJoinRef = useRef(false);
  const { forceLeaveSession, isSessionActive } = useZoomSession();

  // Enhanced SDK
  const {
    isReady,
    isJoining,
    isJoined,
    joinMeeting,
    client
  } = useZoomSDKEnhanced({
    onReady: () => {
      console.log('✅ SDK ready');
      setLoadingStep('SDK ready - preparing to join...');
    },
    onError: (error) => {
      console.error('❌ SDK error:', error);
      setError(error);
      setIsLoading(false);
    }
  });

  const getTokens = useCallback(async (meetingNumber: string, role: number) => {
    try {
      setLoadingStep('Getting authentication tokens...');
      
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-zoom-token', {
        body: {
          meetingNumber,
          role: role || 0,
          expirationSeconds: 7200
        }
      });

      if (tokenError) {
        throw new Error(`Token error: ${tokenError.message}`);
      }

      let zakToken = null;
      if (role === 1) {
        setLoadingStep('Getting host authentication...');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        
        if (zakError || !zakData?.zak) {
          throw new Error('Host role requires fresh ZAK token - please try again');
        }
        
        zakToken = zakData.zak;
      }

      return { ...tokenData, zak: zakToken };
    } catch (error: any) {
      throw error;
    }
  }, []);

  const handleJoinMeeting = useCallback(async () => {
    // Prevent multiple join attempts
    if (!isReady || isJoining || isJoined || hasAttemptedJoinRef.current) {
      return;
    }

    // Check for existing sessions
    if (isSessionActive()) {
      console.log('🔄 Cleaning up existing session...');
      await forceLeaveSession();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    hasAttemptedJoinRef.current = true;
    setLoadingStep('Connecting to meeting...');

    try {
      const tokens = await getTokens(meetingNumber, role || 0);

      const joinConfig = {
        sdkKey: tokens.sdkKey,
        signature: tokens.signature,
        meetingNumber,
        userName: providedUserName || user?.email || 'Guest',
        userEmail: user?.email || '',
        password: meetingPassword || '',
        role: role || 0,
        zak: tokens.zak || ''
      };

      console.log('🔄 Joining meeting with config:', { ...joinConfig, signature: 'hidden' });
      await joinMeeting(joinConfig);
      
      setIsLoading(false);
      onMeetingJoined?.(client);
    } catch (error: any) {
      console.error('❌ Join failed:', error);
      hasAttemptedJoinRef.current = false;
      setError(error.message);
      setIsLoading(false);
      onMeetingError?.(error.message);
    }
  }, [
    isReady, isJoining, isJoined, meetingNumber, role, providedUserName, 
    user, meetingPassword, getTokens, joinMeeting, onMeetingJoined, 
    client, isSessionActive, forceLeaveSession, onMeetingError
  ]);

  // Auto-join when ready
  useEffect(() => {
    if (isReady && !hasAttemptedJoinRef.current && !error) {
      console.log('🚀 SDK ready - starting join process');
      handleJoinMeeting();
    }
  }, [isReady, handleJoinMeeting, error]);

  // Reset on meeting change
  useEffect(() => {
    hasAttemptedJoinRef.current = false;
    setError(null);
    setIsLoading(true);
    setLoadingStep('Initializing...');
  }, [meetingNumber]);

  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setLoadingStep('Retrying...');
    hasAttemptedJoinRef.current = false;
    handleJoinMeeting();
  }, [handleJoinMeeting]);

  // Show error state
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 font-medium">Unable to Join Meeting</p>
            <p className="text-red-500 text-sm mt-1">{error}</p>
          </div>
          
          <div className="space-y-2">
            <Button onClick={handleRetry} className="w-full">
              Try Again
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()} 
              className="w-full"
            >
              Refresh Page
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => window.location.href = '/calendar'} 
              className="w-full"
            >
              Back to Calendar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-50">
          <div className="text-center text-white">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-lg">{loadingStep}</p>
            <p className="text-sm text-gray-400 mt-2">Meeting ID: {meetingNumber}</p>
          </div>
        </div>
      )}
      
      <div 
        id="meetingSDKElement"
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
}

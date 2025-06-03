
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useZoomMeeting } from '@/hooks/useZoomMeeting';

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
  const [currentStep, setCurrentStep] = useState('Preparing...');
  const [retryCount, setRetryCount] = useState(0);
  
  const {
    containerRef,
    isInitializing,
    isJoining,
    isJoined,
    error,
    joinMeeting,
    leaveMeeting,
    sdkStatus
  } = useZoomMeeting();

  const userName = providedUserName || user?.email || 'Guest';

  const getTokensAndJoin = useCallback(async () => {
    try {
      setCurrentStep('Getting authentication tokens...');
      console.log('🔄 [ZOOM-VIEW] Getting tokens for meeting:', meetingNumber);
      
      // Get tokens from Supabase
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

      // Get ZAK token if host
      let zakToken = null;
      if (role === 1) {
        setCurrentStep('Getting host authentication...');
        const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
        if (zakError || !zakData?.zak) {
          throw new Error('Host role requires fresh ZAK token');
        }
        zakToken = zakData.zak;
      }

      setCurrentStep('Joining meeting...');
      console.log('🔄 [ZOOM-VIEW] Joining meeting with tokens...');

      // Join the meeting
      await joinMeeting({
        sdkKey: tokenData.sdkKey,
        signature: tokenData.signature,
        meetingNumber: meetingNumber.replace(/\s+/g, ''),
        userName,
        userEmail: user?.email || '',
        password: meetingPassword || '',
        role: role || 0,
        zak: zakToken || ''
      });

      // Notify parent component
      onMeetingJoined?.(null);
      console.log('✅ [ZOOM-VIEW] Meeting join complete');

    } catch (error: any) {
      console.error('❌ [ZOOM-VIEW] Join process failed:', error);
      onMeetingError?.(error.message);
    }
  }, [meetingNumber, role, userName, user?.email, meetingPassword, joinMeeting, onMeetingJoined, onMeetingError]);

  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    setCurrentStep('Retrying...');
    getTokensAndJoin();
  }, [getTokensAndJoin]);

  // Start the join process when component mounts
  useEffect(() => {
    console.log('🚀 [ZOOM-VIEW] Component mounted, starting join process...');
    setCurrentStep('Initializing SDK...');
    
    // Small delay to ensure container is rendered
    const timer = setTimeout(() => {
      getTokensAndJoin();
    }, 100);

    return () => clearTimeout(timer);
  }, [getTokensAndJoin]);

  // Handle meeting leave
  useEffect(() => {
    if (!isJoined) return;

    const handleBeforeUnload = () => {
      leaveMeeting();
      onMeetingLeft?.();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      leaveMeeting();
      onMeetingLeft?.();
    };
  }, [isJoined, leaveMeeting, onMeetingLeft]);

  const isLoading = isInitializing || isJoining;
  const showError = error && !isLoading;

  if (showError) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 font-medium">Unable to Join Meeting</p>
            <p className="text-red-500 text-sm mt-1">{error}</p>
            {retryCount > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Retry attempt: {retryCount}/3
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Button onClick={handleRetry} disabled={retryCount >= 3} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              {retryCount >= 3 ? 'Max retries reached' : 'Try Again'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()} 
              className="w-full"
            >
              Refresh Page
            </Button>
          </div>

          {/* Debug info */}
          <details className="mt-4 text-left">
            <summary className="text-xs text-gray-500 cursor-pointer">Debug Info</summary>
            <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto">
              {JSON.stringify(sdkStatus, null, 2)}
            </pre>
          </details>
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
            <p className="text-lg">{currentStep}</p>
            <p className="text-sm text-gray-400 mt-2">Meeting ID: {meetingNumber}</p>
            {retryCount > 0 && (
              <p className="text-xs text-yellow-400 mt-1">
                Retry attempt: {retryCount}/3
              </p>
            )}
            
            {/* Progress indicators */}
            <div className="mt-4 space-y-1">
              <div className="text-xs text-gray-500">
                SDK Status: {sdkStatus.isInitialized ? '✅' : '⏳'} | 
                Container: {sdkStatus.hasContainer ? '✅' : '⏳'} |
                Client: {sdkStatus.hasClient ? '✅' : '⏳'}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Zoom meeting container */}
      <div 
        ref={containerRef}
        id="meetingSDKElement"
        className="w-full h-full"
        style={{ 
          minHeight: '400px',
          background: isJoined ? 'transparent' : '#1f1f1f'
        }}
      />
    </div>
  );
}

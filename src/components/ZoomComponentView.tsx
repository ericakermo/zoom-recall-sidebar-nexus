
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

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
  const [loadingStep, setLoadingStep] = useState('Initializing SDK...');
  const clientRef = useRef<any>(null);
  const isInitializedRef = useRef(false);
  const hasJoinedRef = useRef(false);

  const getTokens = useCallback(async (meetingNumber: string, role: number) => {
    console.log('🔄 Getting tokens for meeting:', meetingNumber, 'role:', role);
    
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
      const { data: zakData, error: zakError } = await supabase.functions.invoke('get-zoom-zak');
      if (zakError || !zakData?.zak) {
        throw new Error('Host role requires fresh ZAK token');
      }
      zakToken = zakData.zak;
    }

    return { ...tokenData, zak: zakToken };
  }, []);

  const initializeAndJoin = useCallback(async () => {
    if (hasJoinedRef.current || isInitializedRef.current) {
      console.log('🛑 Already initialized/joined, skipping');
      return;
    }

    try {
      setLoadingStep('Waiting for container...');
      
      // Wait for container to be ready
      let attempts = 0;
      while (attempts < 50) {
        const container = document.getElementById('meetingSDKElement');
        if (container) {
          console.log('✅ Container found');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      const container = document.getElementById('meetingSDKElement');
      if (!container) {
        throw new Error('Meeting container not found');
      }

      setLoadingStep('Initializing Zoom SDK...');
      console.log('🔄 Creating Zoom client...');
      
      clientRef.current = ZoomMtgEmbedded.createClient();
      
      await clientRef.current.init({
        debug: true,
        zoomAppRoot: container,
        assetPath: '/lib',
        language: 'en-US'
      });

      console.log('✅ SDK initialized');
      isInitializedRef.current = true;

      setLoadingStep('Getting authentication...');
      const tokens = await getTokens(meetingNumber, role || 0);

      setLoadingStep('Joining meeting...');
      console.log('🔄 Joining meeting...');

      const joinConfig = {
        sdkKey: tokens.sdkKey,
        signature: tokens.signature,
        meetingNumber: meetingNumber.replace(/\s+/g, ''),
        userName: providedUserName || user?.email || 'Guest',
        userEmail: user?.email || '',
        password: meetingPassword || '',
        role: role || 0,
        zak: tokens.zak || ''
      };

      await clientRef.current.join(joinConfig);
      
      hasJoinedRef.current = true;
      setIsLoading(false);
      console.log('✅ Successfully joined meeting');
      onMeetingJoined?.(clientRef.current);

    } catch (error: any) {
      console.error('❌ Failed to initialize/join:', error);
      setError(error.message);
      setIsLoading(false);
      onMeetingError?.(error.message);
    }
  }, [meetingNumber, role, providedUserName, user, meetingPassword, getTokens, onMeetingJoined, onMeetingError]);

  // Start initialization when component mounts
  useEffect(() => {
    console.log('🚀 ZoomComponentView mounted, starting initialization...');
    const timer = setTimeout(() => {
      initializeAndJoin();
    }, 500); // Small delay to ensure container is rendered

    return () => clearTimeout(timer);
  }, [initializeAndJoin]);

  // Reset on meeting change
  useEffect(() => {
    hasJoinedRef.current = false;
    isInitializedRef.current = false;
    setError(null);
    setIsLoading(true);
    setLoadingStep('Initializing SDK...');
  }, [meetingNumber]);

  const handleRetry = useCallback(() => {
    hasJoinedRef.current = false;
    isInitializedRef.current = false;
    setError(null);
    setIsLoading(true);
    setLoadingStep('Retrying...');
    initializeAndJoin();
  }, [initializeAndJoin]);

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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
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

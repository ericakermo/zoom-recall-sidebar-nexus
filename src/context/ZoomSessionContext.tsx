
import React, { createContext, useContext, useRef, useEffect, useState, useCallback } from 'react';

interface ZoomSessionContextType {
  currentClient: any | null;
  isInMeeting: boolean;
  setCurrentClient: (client: any) => void;
  forceLeaveSession: () => Promise<void>;
  isSessionActive: () => boolean;
  resetSession: () => void;
}

const ZoomSessionContext = createContext<ZoomSessionContextType | undefined>(undefined);

export function ZoomSessionProvider({ children }: { children: React.ReactNode }) {
  const [currentClient, setCurrentClientState] = useState<any | null>(null);
  const [isInMeeting, setIsInMeeting] = useState(false);
  const sessionActiveRef = useRef(false);
  const cleanupAttemptedRef = useRef(false);

  const setCurrentClient = useCallback((client: any) => {
    console.log('🔄 [SESSION-MANAGER] Setting current client:', !!client);
    setCurrentClientState(client);
    sessionActiveRef.current = !!client;
    setIsInMeeting(!!client);
  }, []);

  const forceLeaveSession = useCallback(async () => {
    if (!currentClient || cleanupAttemptedRef.current) {
      return;
    }

    cleanupAttemptedRef.current = true;
    console.log('🚪 [SESSION-MANAGER] Force leaving current session');

    try {
      if (typeof currentClient.leave === 'function') {
        await currentClient.leave();
        console.log('✅ [SESSION-MANAGER] Successfully left session');
      }
      
      if (typeof currentClient.destroy === 'function') {
        currentClient.destroy();
        console.log('✅ [SESSION-MANAGER] Successfully destroyed client');
      }
    } catch (error) {
      console.warn('⚠️ [SESSION-MANAGER] Error during force leave:', error);
    } finally {
      setCurrentClientState(null);
      sessionActiveRef.current = false;
      setIsInMeeting(false);
      cleanupAttemptedRef.current = false;
    }
  }, [currentClient]);

  const isSessionActive = useCallback(() => {
    return sessionActiveRef.current && !!currentClient;
  }, [currentClient]);

  const resetSession = useCallback(() => {
    console.log('🔄 [SESSION-MANAGER] Resetting session state');
    setCurrentClientState(null);
    sessionActiveRef.current = false;
    setIsInMeeting(false);
    cleanupAttemptedRef.current = false;
  }, []);

  // Global beforeunload handler
  useEffect(() => {
    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      if (isSessionActive()) {
        console.log('🔄 [SESSION-MANAGER] Page unload detected, cleaning up session');
        
        // Prevent default to show warning
        event.preventDefault();
        event.returnValue = 'You are currently in a Zoom meeting. Are you sure you want to leave?';
        
        // Force cleanup
        await forceLeaveSession();
        
        return event.returnValue;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isSessionActive()) {
        console.log('👁️ [SESSION-MANAGER] Page hidden, cleaning up session');
        forceLeaveSession();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [forceLeaveSession, isSessionActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSessionActive()) {
        console.log('🧹 [SESSION-MANAGER] Provider unmounting, cleaning up session');
        forceLeaveSession();
      }
    };
  }, []);

  const value = {
    currentClient,
    isInMeeting,
    setCurrentClient,
    forceLeaveSession,
    isSessionActive,
    resetSession
  };

  return (
    <ZoomSessionContext.Provider value={value}>
      {children}
    </ZoomSessionContext.Provider>
  );
}

export function useZoomSession() {
  const context = useContext(ZoomSessionContext);
  if (context === undefined) {
    throw new Error('useZoomSession must be used within a ZoomSessionProvider');
  }
  return context;
}

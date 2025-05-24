import React, { useState, useEffect } from 'react';
import { ZoomMtg } from '@zoomus/websdk';
import { v4 as uuidv4 } from 'uuid';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

interface JoinZoomMeetingProps {
  meetingNumber: string;
  passcode: string;
  userName: string;
}

const JoinZoomMeeting = ({ meetingNumber, passcode, userName }: JoinZoomMeetingProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [signature, setSignature] = useState('');
  const [sdkReady, setSdkReady] = useState(false);
  const supabase = useSupabaseClient();

  useEffect(() => {
    ZoomMtg.preLoadWasm();
    ZoomMtg.prepareJssdk();

    const initZoomSdk = async () => {
      ZoomMtg.init({
        leaveUrl: 'http://localhost:3000',
        isSupportAV: true,
        success: () => {
          console.log('Zoom SDK initialized successfully');
          setSdkReady(true);
        },
        error: (error) => {
          console.error('Zoom SDK initialization failed', error);
        },
      });
    };

    initZoomSdk();
  }, []);

  const generateSignature = async (meetingNumber: string, role: number) => {
    try {
      const meetingSDKSignature = require('zoom-meeting-sdk').generateSignature;
      const apiKey = process.env.NEXT_PUBLIC_ZOOM_API_KEY || '';
      const apiSecret = process.env.ZOOM_API_SECRET || '';

      const signature = meetingSDKSignature({
        meetingNumber: parseInt(meetingNumber),
        sdkKey: apiKey,
        sdkSecret: apiSecret,
        role: role,
        userName: userName,
        userEmail: '',
        passcode: passcode,
      });
      return signature;
    } catch (error) {
      console.error('Signature generation failed', error);
      return '';
    }
  };

  const joinMeeting = async () => {
    try {
      setIsLoading(true);
      const signature = await generateSignature(meetingNumber, 0);
      setSignature(signature);

      const tokenResponse = await supabase.functions.invoke('get-zoom-token');
      if (tokenResponse.error) {
        throw new Error('Failed to get access token');
      }

      const tokenData = tokenResponse.data;
      const accessToken = typeof tokenData === 'string' ? tokenData : tokenData.access_token;

      ZoomMtg.join({
        sdkKey: process.env.NEXT_PUBLIC_ZOOM_API_KEY || '',
        signature: signature,
        meetingNumber: meetingNumber,
        userName: userName,
        passcode: passcode,
        userEmail: '',
        tk: accessToken,
        success: (res) => {
          console.log('join meeting success');
          console.log('JWT:', res.result);
        },
        error: (res) => {
          console.log('Failed to join meeting', res);
        },
      });
    } catch (error) {
      console.error('Failed to join Zoom meeting', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {sdkReady ? (
        <button
          onClick={joinMeeting}
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          {isLoading ? 'Joining...' : 'Join Zoom Meeting'}
        </button>
      ) : (
        <div>Loading Zoom SDK...</div>
      )}
      <div id="zmmtg-root"></div>
    </div>
  );
};

export default JoinZoomMeeting;

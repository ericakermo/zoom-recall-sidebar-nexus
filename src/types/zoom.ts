export interface ZoomMeetingConfig {
  signature: string;
  meetingNumber: string;
  userName: string;
  password?: string;
  apiKey: string;
  role: number; // 0 for attendee, 1 for host
  leaveUrl?: string;
  registrantToken?: string;
  zakToken?: string;
  userEmail?: string;
}

export interface ZoomClient {
  init: (config: any) => Promise<void>;
  join: (config: any) => Promise<void>;
  leave: () => void;
}

declare global {
  interface Window {
    ZoomMtg: any;
    ZoomMtgEmbedded: any; // Add this to fix TypeScript errors
    React?: any;
    ReactDOM?: any;
  }
}

export interface ZoomJoinParams {
  meetingNumber: string;
  userName: string;
  signature: string;
  password?: string;
  userEmail?: string;
  sdkKey: string;
  role?: number;
  zak?: string;
}

export interface ZoomJoinConfig {
  sdkKey: string;
  signature: string;
  meetingNumber: string;
  userName: string;
  userEmail?: string;
  password: string;
  role: number;
  zak?: string;
  join_before_host?: boolean;
  success: (success: any) => void;
  error: (error: any) => void;
}

export interface ZoomTokenData {
  accessToken: string;
  tokenType: string;
  sdkKey: string;
  signature: string;
  zak?: string;
}

export interface MeetingStatus {
  status: string;
  startTime: string;
  duration: number;
  joinBeforeHost: boolean;
} 

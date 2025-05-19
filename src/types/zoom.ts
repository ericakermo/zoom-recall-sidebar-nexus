
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

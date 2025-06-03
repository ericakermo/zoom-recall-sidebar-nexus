
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

export interface ZoomInitConfig {
  zoomAppRoot: HTMLElement;
  language?: string;
  debug?: boolean;
}

export interface ZoomJoinConfig {
  sdkKey: string;
  signature: string;
  meetingNumber: string;
  userName: string;
  userEmail?: string;
  password?: string;
  role?: number;
  zak?: string;
}

export class ZoomSDKManager {
  private client: any = null;
  private isInitialized = false;
  private isJoined = false;
  private containerElement: HTMLElement | null = null;

  async initialize(config: ZoomInitConfig): Promise<void> {
    if (this.isInitialized && this.client) {
      console.log('🔍 [SDK-MANAGER] Already initialized');
      return;
    }

    console.log('🚀 [SDK-MANAGER] Starting initialization...');
    
    this.containerElement = config.zoomAppRoot;
    
    try {
      // Create Zoom client
      this.client = ZoomMtgEmbedded.createClient();
      
      // Initialize with proper configuration
      await this.client.init({
        debug: config.debug || true,
        zoomAppRoot: config.zoomAppRoot,
        assetPath: '/lib',
        language: config.language || 'en-US'
      });
      
      this.isInitialized = true;
      console.log('✅ [SDK-MANAGER] Initialization complete');
    } catch (error) {
      console.error('❌ [SDK-MANAGER] Initialization failed:', error);
      this.cleanup();
      throw new Error(`SDK initialization failed: ${error.message}`);
    }
  }

  async joinMeeting(config: ZoomJoinConfig): Promise<void> {
    if (!this.isInitialized || !this.client) {
      throw new Error('SDK not initialized');
    }

    if (this.isJoined) {
      throw new Error('Already joined a meeting');
    }

    console.log('🔄 [SDK-MANAGER] Joining meeting...');
    
    try {
      const joinConfig = {
        sdkKey: config.sdkKey,
        signature: config.signature,
        meetingNumber: config.meetingNumber.replace(/\s+/g, ''),
        userName: config.userName,
        userEmail: config.userEmail || '',
        password: config.password || '',
        zak: config.zak || ''
      };

      await this.client.join(joinConfig);
      this.isJoined = true;
      console.log('✅ [SDK-MANAGER] Successfully joined meeting');
    } catch (error) {
      console.error('❌ [SDK-MANAGER] Join failed:', error);
      throw new Error(`Failed to join meeting: ${error.message}`);
    }
  }

  async leaveMeeting(): Promise<void> {
    if (this.client && this.isJoined) {
      try {
        await this.client.leave();
        this.isJoined = false;
        console.log('✅ [SDK-MANAGER] Left meeting');
      } catch (error) {
        console.error('❌ [SDK-MANAGER] Leave failed:', error);
      }
    }
  }

  cleanup(): void {
    if (this.client) {
      try {
        if (this.isJoined) {
          this.client.leave();
        }
      } catch (error) {
        console.warn('⚠️ [SDK-MANAGER] Cleanup warning:', error);
      }
      this.client = null;
    }
    
    this.isInitialized = false;
    this.isJoined = false;
    this.containerElement = null;
    console.log('🧹 [SDK-MANAGER] Cleanup complete');
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isJoined: this.isJoined,
      hasClient: !!this.client,
      hasContainer: !!this.containerElement
    };
  }
}

// Global instance
export const zoomSDK = new ZoomSDKManager();

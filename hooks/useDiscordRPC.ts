import { useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';

// Discord RPC types
interface DiscordRPCActivity {
  details?: string;
  state?: string;
  startTimestamp?: number;
  endTimestamp?: number;
  largeImageKey?: string;
  largeImageText?: string;
  smallImageKey?: string;
  smallImageText?: string;
  partyId?: string;
  partySize?: number;
  partyMax?: number;
  matchSecret?: string;
  joinSecret?: string;
  spectateSecret?: string;
  instance?: boolean;
}

interface DiscordRPCState {
  connected: boolean;
  error: string | null;
  activity: DiscordRPCActivity | null;
}

// Your Discord Application ID (you'll need to create one at https://discord.com/developers/applications)
const DISCORD_CLIENT_ID = '1376029920219893930'; // Using your existing Discord app ID

export const useDiscordRPC = () => {
  const [state, setState] = useState<DiscordRPCState>({
    connected: false,
    error: null,
    activity: null,
  });

  const rpcClientRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connectRPC = async () => {
    // Discord RPC is only supported on desktop/web platforms with Discord desktop app
    console.log('🎮 Discord RPC connection attempted');
    console.log('📱 Note: Discord RPC is not supported on mobile platforms');
    console.log('💡 This feature will work when you build for web or desktop');
    
    // For now, just return false since we can't use discord-rpc package on mobile
    setState(prev => ({ 
      ...prev, 
      connected: false, 
      error: 'Discord RPC not supported on mobile platforms'
    }));
    return false;
  };

  const setZantakuActivity = async () => {
    console.log('🎮 Would set Discord activity: Browsing Zantaku');
    console.log('📱 (Not available on mobile - desktop/web only)');
    return false;
  };

  const setWatchingActivity = async (animeTitle: string, episode?: number) => {
    console.log(`🎮 Would set Discord activity: Watching ${animeTitle}${episode ? ` - Episode ${episode}` : ''}`);
    console.log('📱 (Not available on mobile - desktop/web only)');
    return false;
  };

  const setReadingActivity = async (mangaTitle: string, chapter?: number) => {
    console.log(`🎮 Would set Discord activity: Reading ${mangaTitle}${chapter ? ` - Chapter ${chapter}` : ''}`);
    console.log('📱 (Not available on mobile - desktop/web only)');
    return false;
  };

  const clearActivity = async () => {
    console.log('🎮 Would clear Discord activity');
    console.log('📱 (Not available on mobile - desktop/web only)');
    return false;
  };

  const disconnectRPC = async () => {
    console.log('🎮 Would disconnect Discord RPC');
    console.log('📱 (Not available on mobile - desktop/web only)');
    setState(prev => ({ ...prev, connected: false, activity: null, error: null }));
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectRPC();
    };
  }, []);

  return {
    ...state,
    connectRPC,
    disconnectRPC,
    setZantakuActivity,
    setWatchingActivity,
    setReadingActivity,
    clearActivity,
  };
}; 
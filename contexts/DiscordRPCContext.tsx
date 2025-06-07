import React, { createContext, useContext, useEffect, useState } from 'react';
import { useDiscordRPC } from '../hooks/useDiscordRPC';
import { useDiscordAuth } from '../hooks/useDiscordAuth';

interface DiscordRPCContextType {
  connected: boolean;
  setWatchingAnime: (title: string, episode?: number) => Promise<boolean>;
  setReadingManga: (title: string, chapter?: number) => Promise<boolean>;
  setBrowsingZantaku: () => Promise<boolean>;
  clearActivity: () => Promise<boolean>;
}

const DiscordRPCContext = createContext<DiscordRPCContextType | null>(null);

export const useDiscordRPCContext = () => {
  const context = useContext(DiscordRPCContext);
  if (!context) {
    throw new Error('useDiscordRPCContext must be used within a DiscordRPCProvider');
  }
  return context;
};

interface DiscordRPCProviderProps {
  children: React.ReactNode;
}

export const DiscordRPCProvider: React.FC<DiscordRPCProviderProps> = ({ children }) => {
  const { user: discordUser } = useDiscordAuth();
  const { 
    connected, 
    connectRPC, 
    disconnectRPC, 
    setZantakuActivity,
    setWatchingActivity,
    setReadingActivity,
    clearActivity 
  } = useDiscordRPC();

  // Auto-connect when Discord user is available
  useEffect(() => {
    if (discordUser && !connected) {
      console.log('🎮 [RPC Context] Discord user detected, connecting RPC...');
      connectRPC().then((success) => {
        if (success) {
          console.log('🎮 [RPC Context] Connected, setting default Zantaku activity...');
          setTimeout(() => setZantakuActivity(), 1000);
        }
      });
    } else if (!discordUser && connected) {
      console.log('🎮 [RPC Context] Discord user disconnected, disconnecting RPC...');
      disconnectRPC();
    }
  }, [discordUser, connected, connectRPC, disconnectRPC, setZantakuActivity]);

  const setWatchingAnime = async (title: string, episode?: number): Promise<boolean> => {
    if (!connected) {
      console.log('⚠️ [RPC Context] Cannot set watching activity: RPC not connected');
      return false;
    }
    return await setWatchingActivity(title, episode);
  };

  const setReadingManga = async (title: string, chapter?: number): Promise<boolean> => {
    if (!connected) {
      console.log('⚠️ [RPC Context] Cannot set reading activity: RPC not connected');
      return false;
    }
    return await setReadingActivity(title, chapter);
  };

  const setBrowsingZantaku = async (): Promise<boolean> => {
    if (!connected) {
      console.log('⚠️ [RPC Context] Cannot set browsing activity: RPC not connected');
      return false;
    }
    return await setZantakuActivity();
  };

  const contextValue: DiscordRPCContextType = {
    connected,
    setWatchingAnime,
    setReadingManga,
    setBrowsingZantaku,
    clearActivity,
  };

  return (
    <DiscordRPCContext.Provider value={contextValue}>
      {children}
    </DiscordRPCContext.Provider>
  );
}; 
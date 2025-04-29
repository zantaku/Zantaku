import React, { createContext, useState, useContext } from 'react';
import { VideoQuality } from '../types/player';

interface PlayerPreferences {
  volume: number;
  playbackRate: number;
  subtitlesEnabled: boolean;
  preferredQuality: VideoQuality;
  autoplayNext: boolean;
  rememberPosition: boolean;
  selectedSubtitleLanguage: string;
}

interface PlayerContextType {
  preferences: PlayerPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<PlayerPreferences>>;
}

const defaultPreferences: PlayerPreferences = {
  volume: 1,
  playbackRate: 1,
  subtitlesEnabled: true,
  preferredQuality: '1080p',
  autoplayNext: true,
  rememberPosition: true,
  selectedSubtitleLanguage: 'English'
};

export const PlayerContext = createContext<PlayerContextType>({
  preferences: defaultPreferences,
  setPreferences: () => {}
});

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<PlayerPreferences>(defaultPreferences);

  return (
    <PlayerContext.Provider value={{ preferences, setPreferences }}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayerContext = () => useContext(PlayerContext); 
import React, { createContext, useState, useContext } from 'react';
import { VideoQuality } from '../types/player';

export interface PlayerPreferences {
  volume: number;
  playbackRate: number;
  subtitlesEnabled: boolean;
  preferredQuality: VideoQuality;
  preferredLanguage: string;
  autoplayNext: boolean;
  rememberPosition: boolean;
  selectedSubtitleLanguage: string;
  debugOverlayEnabled: boolean;
  subtitleStyle: {
    fontSize: number;
    backgroundColor: string;
    textColor: string;
    backgroundOpacity: number;
    boldText: boolean;
  };
  markerSettings: {
    showMarkers: boolean;
    autoSkipIntro: boolean;
    autoSkipOutro: boolean;
    autoPlayNextEpisode: boolean;
  };
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
  preferredLanguage: 'English',
  autoplayNext: true,
  rememberPosition: true,
  selectedSubtitleLanguage: 'English',
  debugOverlayEnabled: false,
  subtitleStyle: {
    fontSize: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    textColor: '#FFFFFF',
    backgroundOpacity: 0.7,
    boldText: false
  },
  markerSettings: {
    showMarkers: true,
    autoSkipIntro: false,
    autoSkipOutro: false,
    autoPlayNextEpisode: true
  }
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
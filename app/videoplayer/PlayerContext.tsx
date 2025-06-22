import React, { createContext, useState, useContext } from 'react';
import { VIDEO_QUALITIES, VideoQuality } from './types';

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

export interface AniListUser {
  userId: number;
  username: string;
  token: string;
  avatar?: string;
}

interface PlayerContextType {
  preferences: PlayerPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<PlayerPreferences>>;
  anilistUser: AniListUser | null;
  setAnilistUser: React.Dispatch<React.SetStateAction<AniListUser | null>>;
  onSaveToAniList?: (episodeData: {
    anilistId: string;
    episodeNumber: number;
    currentTime: number;
    duration: number;
  }) => Promise<boolean>;
  onEnterPiP?: () => void;
  onExitPiP?: () => void;
}

const defaultPreferences: PlayerPreferences = {
  volume: 1,
  playbackRate: 1,
  subtitlesEnabled: false,
  preferredQuality: VIDEO_QUALITIES[0],
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
  setPreferences: () => {},
  anilistUser: null,
  setAnilistUser: () => {},
  onSaveToAniList: undefined,
  onEnterPiP: undefined,
  onExitPiP: undefined
});

export const usePlayerContext = () => useContext(PlayerContext);

export const PlayerProvider: React.FC<{ 
  children: React.ReactNode;
  anilistUser?: AniListUser | null;
  onSaveToAniList?: (episodeData: {
    anilistId: string;
    episodeNumber: number;
    currentTime: number;
    duration: number;
  }) => Promise<boolean>;
  onEnterPiP?: () => void;
  onExitPiP?: () => void;
}> = ({ children, anilistUser: initialAnilistUser, onSaveToAniList, onEnterPiP, onExitPiP }) => {
  const [preferences, setPreferences] = useState<PlayerPreferences>(defaultPreferences);
  const [anilistUser, setAnilistUser] = useState<AniListUser | null>(initialAnilistUser || null);

  return (
    <PlayerContext.Provider value={{ 
      preferences, 
      setPreferences, 
      anilistUser, 
      setAnilistUser,
      onSaveToAniList,
      onEnterPiP,
      onExitPiP
    }}>
      {children}
    </PlayerContext.Provider>
  );
}; 
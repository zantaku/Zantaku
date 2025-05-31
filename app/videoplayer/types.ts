// Define video quality constants and types
export const VIDEO_QUALITIES = ['auto', '1080p', '720p', '480p', '360p'] as const;
export type VideoQuality = typeof VIDEO_QUALITIES[number];

// Define subtitle related types
export interface Subtitle {
  url: string;
  lang: string;
}

export interface SubtitleCue {
  startTime: number;
  endTime: number;
  text: string;
}

// Define video timing markers
export interface VideoTimings {
  intro?: {
    start: number;
    end: number;
  };
  outro?: {
    start: number;
    end: number;
  };
}

// Define audio track types for dub/sub switching
export interface AudioTrack {
  type: 'sub' | 'dub';
  available: boolean;
  episodeId?: string;
  anilistId?: string;
}

// Define player progress data
export interface VideoProgressData {
  currentTime: number;
  playableDuration: number;
  seekableDuration: number;
}

// Define subtitle track interface
export interface SubtitleTrack {
  lang: string;
  url: string;
}

export interface VideoError {
  message: string;
} 
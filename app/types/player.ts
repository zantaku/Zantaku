export const VIDEO_QUALITIES = ['1080p', '720p', '480p', '360p'] as const;
export type VideoQuality = typeof VIDEO_QUALITIES[number];

export interface Subtitle {
  url: string;
  lang: string;
}

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

export interface SubtitleCue {
  startTime: number;
  endTime: number;
  text: string;
} 
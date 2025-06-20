// Proxy configuration
export const M3U8_PROXY_BASE_URL = 'https://m3u8-proxy-liard.vercel.app/m3u8-proxy?url=';
export const USE_PROXY = false; // Set to false for direct playback by default

// Network speed thresholds in bytes per second
export const NETWORK_SPEED_THRESHOLDS = {
  SLOW: 500000, // 500 KB/s
  MEDIUM: 1500000, // 1.5 MB/s
  FAST: 3000000 // 3 MB/s
};

// Playback monitoring configuration
export const PLAYBACK_MONITOR_INTERVAL = 1000; // Check every 1 second
export const KEEP_ALIVE_INTERVAL = 15000; // Send keep-alive every 15 seconds
export const STALL_DETECTION_THRESHOLD = 3000; // Consider stalled if no progress for 3 seconds
export const MAX_RECOVERY_ATTEMPTS = 3;

// Constants for UI behavior
export const CONTROLS_FADE_TIMEOUT = 20000; // Show controls for 20 seconds before hiding
export const DOUBLE_TAP_THRESHOLD = 300; // Time window for double tap detection in ms
export const SWIPE_THRESHOLD = 20; // Minimum distance for swipe detection

// M3U8 DOMAINS for proxy configuration
export const M3U8_DOMAINS = {
  GOGO: ["gogocdn.net", "gogocdn.io"],
  ZORO: ["vidstreaming.io", "rapid-cloud.co", "megacloud.tv", "filemoon.sx", "ef.netmagcdn.com", "ed.netmagcdn.com", "eg.netmagcdn.com"],
  NINEANIME: ["mcloud.to"],
};

// Constants for player UI
export const PLAYER_COLORS = {
  PRIMARY: '#FF66C4', // Zantaku theme color
  SECONDARY: '#0F3460',
  BACKGROUND_DARK: '#1A1A2E',
  TEXT_LIGHT: '#FFFFFF',
  TEXT_SECONDARY: 'rgba(255, 255, 255, 0.7)',
  OVERLAY_BACKGROUND: 'rgba(0, 0, 0, 0.5)',
  SLIDER_TRACK: 'rgba(255, 255, 255, 0.3)',
  GRADIENT_START: '#1A1A2E',
  GRADIENT_END: '#0F3460',
};

// Constants for player behavior
export const PLAYER_BEHAVIOR = {
  CONTROLS_HIDE_DELAY: 4000, // ms
  DOUBLE_TAP_SEEK_TIME: 10, // seconds to seek on double tap
  SKIP_INTRO_DURATION: 90, // default seconds to skip for OP/ED
  SEEK_DEBOUNCE_MS: 300, // ms to debounce seek operations for HLS
  SEEK_TOLERANCE_MS: 500, // ms tolerance for HLS seeking
};

// Constants for video quality options
export const VIDEO_QUALITIES = ['auto', '1080p', '720p', '480p', '360p'] as const;
export type VideoQuality = typeof VIDEO_QUALITIES[number];

// Video quality optimization settings
export const QUALITY_SETTINGS = {
  PREFER_HIGHEST_QUALITY: true, // Always try to select the highest available quality
  MIN_PREFERRED_HEIGHT: 1080, // Minimum preferred video height (1080p)
  FALLBACK_HEIGHT: 720, // Fallback quality if highest not available
  LOG_QUALITY_INFO: true, // Enable quality logging for debugging
};

// Constants for player animations
export const ANIMATIONS = {
  CONTROLS_FADE_DURATION: 200, // ms
  SEEK_ANIMATION_DURATION: 800, // ms
};

// Constants for modal display
export const MODAL_STYLES = {
  BLUR_INTENSITY: 70,
  CARD_OPACITY: 0.85,
  BORDER_RADIUS: 16,
  SHADOW_OPACITY: 0.5,
};

// Constants for timeline preview
export const TIMELINE_PREVIEW = {
  WIDTH: 160,
  HEIGHT: 90,
  BORDER_WIDTH: 2,
};

// Player interface dimensions
export const PLAYER_UI = {
  PLAY_BUTTON_SIZE: 80,
  SEEK_BUTTON_SIZE: 60,
  ICON_SIZE: {
    SMALL: 18,
    MEDIUM: 24,
    LARGE: 30,
    XLARGE: 40,
  },
};

// Subtitle default styles
export const SUBTITLE_STYLES = {
  FONT_SIZE: 18,
  BACKGROUND_COLOR: 'rgba(0, 0, 0, 0.7)',
  TEXT_COLOR: '#FFFFFF',
  BACKGROUND_OPACITY: 0.7,
  BOLD_TEXT: false,
};

// Video timing markers for common anime format
export const DEFAULT_TIMING_MARKERS = {
  INTRO: {
    START: 0,
    END: 90, // 1:30 - typical anime opening length
  },
  OUTRO: {
    START: 1290, // 21:30 - typical anime outro start (assuming 24min episode)
    END: 1380, // 23:00
  },
};

// Anime quotes for modals
export const ANIME_QUOTES = [
  "✨ I'll become the Pirate King! ✨",
  "✨ I'll never go back on my word! ✨",
  "✨ Believe in the me that believes in you! ✨",
  "✨ It's time to d-d-d-duel! ✨",
  "✨ El Psy Kongroo ✨",
  "✨ I am the bone of my sword ✨",
  "✨ People die when they are killed ✨",
  "✨ Just according to keikaku ✨",
  "✨ This isn't even my final form! ✨",
];

// Define debug constants
export const DEBUG = {
  OVERLAY_ENABLED: false,
};

// Load settings keys
export const STORAGE_KEYS = {
  PLAYER_PREFERENCES: 'player_preferences',
  VIDEO_PROGRESS: 'video_progress_',
  DONT_ASK_AGAIN: 'player_exit_dont_ask_again',
}; 
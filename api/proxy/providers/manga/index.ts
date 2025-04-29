// Export all manga providers

export * from './mangadex';
export * from './katana';

// Common types used across providers
export interface Chapter {
  id: string;
  number: string;
  title: string;
  url: string;
  isAnimeAdapted?: boolean;
  adaptationInfo?: string;
  volume?: string;
  chapter?: string;
  pages?: number;
  translatedLanguage?: string;
  updatedAt?: string;
  scanlationGroup?: string;
  thumbnail?: string;
  isLatest?: boolean;
  source: string;
  katanaUrl?: string;
}

export type MangaSource = 'mangadex' | 'katana';
export type Provider = 'mangadex' | 'katana';

// Helper function to determine which provider to use
export function getProviderForSource(source: MangaSource | Provider | string): MangaSource {
  if (source === 'mangadex' || source === 'katana') {
    return source;
  }
  // Default to MangaDex if unknown source
  return 'mangadex';
}

// Language to flag mapping used across providers
export const languageFlags: Record<string, string> = {
  'en': '🇺🇸',
  'ja': '🇯🇵',
  'ko': '🇰🇷',
  'zh': '🇨🇳',
  'zh-hk': '🇭🇰',
  'fr': '🇫🇷',
  'vi': '🇻🇳',
  'de': '🇩🇪',
  'es': '🇪🇸',
  'ru': '🇷🇺',
  'it': '🇮🇹',
  'pt': '🇵🇹',
  'pt-br': '🇧🇷',
  'tr': '🇹🇷',
  'ar': '🇦🇪',
  'th': '🇹🇭',
  'id': '🇮🇩',
  'pl': '🇵🇱',
  'nl': '🇳🇱',
  'my': '🇲🇾',
  'ms': '🇲🇾',
  'fi': '🇫🇮',
  'hi': '🇮🇳',
  'mn': '🇲🇳',
  'ro': '🇷🇴',
  'bg': '🇧🇬',
  'he': '🇮🇱',
  'uk': '🇺🇦',
  'cs': '🇨🇿',
  'sv': '🇸🇪',
  'bn': '🇧🇩',
  'no': '🇳🇴',
  'lt': '🇱🇹',
  'hu': '🇭🇺',
  'el': '🇬🇷',
  'da': '🇩🇰',
  'ca': '🇪🇸',
  'fa': '🇮🇷',
  'hr': '🇭🇷',
  'sr': '🇷🇸',
  'sk': '🇸🇰',
  'fil': '🇵🇭',
  'tl': '🇵🇭',
  'ne': '🇳🇵',
  'ur': '🇵🇰',
  'ta': '🇮🇳',
  'la': '🇻🇦',
  'et': '🇪🇪',
}; 
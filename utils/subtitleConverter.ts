// ASS to VTT subtitle converter for better Expo Go compatibility

export interface SubtitleCue {
  startTime: number;
  endTime: number;
  text: string;
}

export interface VTTCue {
  id?: string;
  startTime: string;
  endTime: string;
  text: string;
}

/**
 * Convert ASS subtitle format to WebVTT format
 * ASS format is more complex but we'll extract the essential timing and text
 */
export function convertASSToVTT(assText: string): string {
  const cues = parseASSSubtitles(assText);
  return generateVTTFromCues(cues);
}

/**
 * Parse ASS subtitle text and extract subtitle cues
 */
export function parseASSSubtitles(assText: string): SubtitleCue[] {
  const subtitles: SubtitleCue[] = [];
  const lines = assText.split('\n');
  
  let inEvents = false;
  let formatLine = '';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check for Events section
    if (trimmedLine === '[Events]') {
      inEvents = true;
      continue;
    }
    
    // Check for next section (stops parsing events)
    if (trimmedLine.startsWith('[') && trimmedLine !== '[Events]' && inEvents) {
      break;
    }
    
    if (inEvents) {
      // Get format definition
      if (trimmedLine.startsWith('Format:')) {
        formatLine = trimmedLine;
        continue;
      }
      
      // Parse dialogue lines
      if (trimmedLine.startsWith('Dialogue:')) {
        const cue = parseASSDialogue(trimmedLine, formatLine);
        if (cue) {
          subtitles.push(cue);
        }
      }
    }
  }
  
  // Sort by start time
  return subtitles.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Parse a single ASS dialogue line
 */
function parseASSDialogue(line: string, formatLine: string): SubtitleCue | null {
  try {
    // Remove "Dialogue: " prefix
    const content = line.substring(9);
    const parts = content.split(',');
    
    if (parts.length < 10) return null;
    
    // Default ASS format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
    // But we should parse the actual format if available
    let startIndex = 1;
    let endIndex = 2;
    let textIndex = 9;
    
    // Parse format line if available
    if (formatLine) {
      const formatParts = formatLine.substring(7).split(',').map(part => part.trim());
      startIndex = formatParts.indexOf('Start');
      endIndex = formatParts.indexOf('End');
      textIndex = formatParts.indexOf('Text');
      
      if (startIndex === -1) startIndex = 1;
      if (endIndex === -1) endIndex = 2;
      if (textIndex === -1) textIndex = 9;
    }
    
    const startTime = parseASSTime(parts[startIndex]?.trim());
    const endTime = parseASSTime(parts[endIndex]?.trim());
    
    if (isNaN(startTime) || isNaN(endTime) || startTime >= endTime) {
      return null;
    }
    
    // Extract text (everything from textIndex onwards)
    const text = parts.slice(textIndex).join(',');
    const cleanText = cleanASSText(text);
    
    if (!cleanText.trim()) return null;
    
    return {
      startTime,
      endTime,
      text: cleanText
    };
  } catch (error) {
    console.warn('[SUBTITLE-CONVERTER] Failed to parse dialogue line:', error);
    return null;
  }
}

/**
 * Parse ASS time format (H:MM:SS.CC) to seconds
 */
function parseASSTime(timeStr: string): number {
  if (!timeStr) return NaN;
  
  const match = timeStr.match(/(\d+):(\d{2}):(\d{2})\.(\d{2})/);
  if (!match) return NaN;
  
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const centiseconds = parseInt(match[4], 10);
  
  return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
}

/**
 * Clean ASS text by removing formatting codes and converting line breaks
 */
function cleanASSText(text: string): string {
  if (!text) return '';
  
  return text
    // Remove ASS formatting codes like {\pos(x,y)}, {\c&Hffffff&}, etc.
    .replace(/\{[^}]*\}/g, '')
    // Convert ASS line breaks to HTML line breaks
    .replace(/\\N/g, '\n')
    .replace(/\\n/g, '\n')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate WebVTT format from subtitle cues
 */
export function generateVTTFromCues(cues: SubtitleCue[]): string {
  let vtt = 'WEBVTT\n\n';
  
  cues.forEach((cue, index) => {
    // Add cue identifier
    vtt += `${index + 1}\n`;
    
    // Add timing
    const startTime = formatVTTTime(cue.startTime);
    const endTime = formatVTTTime(cue.endTime);
    vtt += `${startTime} --> ${endTime}\n`;
    
    // Add text
    vtt += `${cue.text}\n\n`;
  });
  
  return vtt;
}

/**
 * Format time in seconds to VTT format (HH:MM:SS.mmm)
 */
function formatVTTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const h = hours.toString().padStart(2, '0');
  const m = minutes.toString().padStart(2, '0');
  const s = Math.floor(secs).toString().padStart(2, '0');
  const ms = Math.floor((secs % 1) * 1000).toString().padStart(3, '0');
  
  return `${h}:${m}:${s}.${ms}`;
}

/**
 * Convert VTT text back to subtitle cues for React Native use
 */
export function parseVTTToCues(vttText: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const lines = vttText.split('\n');
  
  let i = 0;
  
  // Skip WEBVTT header
  while (i < lines.length && !lines[i].trim().startsWith('WEBVTT')) {
    i++;
  }
  i++; // Skip WEBVTT line
  
  while (i < lines.length) {
    // Skip empty lines
    while (i < lines.length && !lines[i].trim()) {
      i++;
    }
    
    if (i >= lines.length) break;
    
    // Skip cue identifier (optional)
    if (lines[i].trim() && !lines[i].includes('-->')) {
      i++;
    }
    
    // Parse timing line
    if (i < lines.length && lines[i].includes('-->')) {
      const timingLine = lines[i].trim();
      const [startStr, endStr] = timingLine.split('-->').map(t => t.trim());
      
      const startTime = parseVTTTime(startStr);
      const endTime = parseVTTTime(endStr);
      
      if (!isNaN(startTime) && !isNaN(endTime)) {
        i++;
        
        // Collect text lines until empty line or end
        const textLines: string[] = [];
        while (i < lines.length && lines[i].trim()) {
          textLines.push(lines[i]);
          i++;
        }
        
        if (textLines.length > 0) {
          cues.push({
            startTime,
            endTime,
            text: textLines.join('\n')
          });
        }
      } else {
        i++;
      }
    } else {
      i++;
    }
  }
  
  return cues;
}

/**
 * Parse VTT time format (HH:MM:SS.mmm) to seconds
 */
function parseVTTTime(timeStr: string): number {
  const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
  if (!match) return NaN;
  
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const milliseconds = parseInt(match[4], 10);
  
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

/**
 * Create a blob URL for VTT content (for use in WebView)
 */
export function createVTTBlobURL(vttContent: string): string {
  // This would be used in WebView context
  const blob = new Blob([vttContent], { type: 'text/vtt' });
  return URL.createObjectURL(blob);
}

/**
 * Detect subtitle format from content
 */
export function detectSubtitleFormat(content: string): 'ass' | 'vtt' | 'srt' | 'unknown' {
  const trimmed = content.trim();
  
  if (trimmed.startsWith('WEBVTT')) {
    return 'vtt';
  }
  
  if (trimmed.includes('[Script Info]') || trimmed.includes('[Events]')) {
    return 'ass';
  }
  
  if (/^\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/.test(trimmed)) {
    return 'srt';
  }
  
  return 'unknown';
}

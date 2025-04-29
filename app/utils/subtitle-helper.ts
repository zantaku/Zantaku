/**
 * Subtitle Helper Utilities
 * Useful functions for debugging and managing subtitles
 */

/**
 * Debug a subtitle file by logging its structure
 * @param url The URL of the subtitle file
 */
export async function debugSubtitleFile(url: string): Promise<void> {
  console.log('🔍 Starting subtitle file debug...');
  console.log('URL:', url);
  
  try {
    // Fetch the subtitle content
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch subtitle: ${response.status} ${response.statusText}`);
    }
    
    const content = await response.text();
    console.log('Content length:', content.length);
    console.log('First 200 characters:', content.substring(0, 200));
    
    // Check the format
    const isVTT = content.trim().startsWith('WEBVTT');
    console.log('Format:', isVTT ? 'WebVTT' : 'SRT');
    
    // Parse some sample cues
    const lines = content.trim().split('\n');
    let sampleCues: { start: string, end: string, text: string }[] = [];
    
    if (isVTT) {
      // Parse VTT format
      let i = 0;
      
      // Skip the header
      while (i < lines.length && !lines[i].includes('-->')) {
        i++;
      }
      
      // Get some sample cues
      for (let cueCount = 0; cueCount < 3 && i < lines.length; cueCount++) {
        if (lines[i].includes('-->')) {
          const timeLine = lines[i];
          const [start, end] = timeLine.split('-->').map(t => t.trim());
          
          let text = '';
          i++;
          while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
            text += (text ? '\n' : '') + lines[i];
            i++;
          }
          
          if (text) {
            sampleCues.push({ start, end, text });
          }
        } else {
          i++;
        }
      }
    } else {
      // Parse SRT format
      const blocks = content.trim().split('\n\n');
      for (let i = 0; i < Math.min(3, blocks.length); i++) {
        const lines = blocks[i].split('\n');
        if (lines.length >= 3) {
          const timeIndex = lines.findIndex(l => l.includes('-->'));
          if (timeIndex >= 0) {
            const [start, end] = lines[timeIndex].split('-->').map(t => t.trim());
            const text = lines.slice(timeIndex + 1).join('\n');
            sampleCues.push({ start, end, text });
          }
        }
      }
    }
    
    console.log('Sample cues:', sampleCues);
    console.log('🔍 Subtitle debug complete');
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error debugging subtitle:', error);
    return Promise.reject(error);
  }
}

/**
 * Try to fix common issues with subtitle files
 * @param content The subtitle file content
 * @returns Fixed content
 */
export function fixSubtitleContent(content: string): string {
  // Check if it's a VTT file
  const isVTT = content.trim().startsWith('WEBVTT');
  
  if (isVTT) {
    // Fix common WebVTT issues
    let fixed = content;
    
    // Ensure WEBVTT header is correct
    if (!fixed.trim().startsWith('WEBVTT')) {
      fixed = 'WEBVTT\n\n' + fixed;
    }
    
    // Fix timestamp formats (ensure they have hours part)
    fixed = fixed.replace(/(\d+):(\d+\.\d+)\s+-->\s+(\d+):(\d+\.\d+)/g, '00:$1:$2 --> 00:$3:$4');
    
    return fixed;
  } else {
    // Fix common SRT issues
    let fixed = content;
    
    // Fix timestamp formats
    fixed = fixed.replace(/(\d+):(\d+),(\d+)\s+-->\s+(\d+):(\d+),(\d+)/g, '00:$1:$2,$3 --> 00:$4:$5,$6');
    
    return fixed;
  }
}

/**
 * Parse a subtitle time string into seconds
 * @param timeStr Time string in format hh:mm:ss.mmm or mm:ss.mmm
 * @returns Time in seconds
 */
export function parseTimeToSeconds(timeStr: string): number {
  try {
    if (!timeStr) return 0;
    
    const isVTT = timeStr.includes('.');
    const parts = timeStr.split(':');
    
    // Handle different time formats
    if (parts.length === 3) {
      // Format: HH:MM:SS.mmm or HH:MM:SS,mmm
      const [hours, minutes, seconds] = parts;
      
      if (isVTT) {
        // VTT format with . for milliseconds
        const [secs, ms] = seconds.split('.');
        return (
          parseInt(hours) * 3600 +
          parseInt(minutes) * 60 +
          parseInt(secs) +
          parseInt(ms || '0') / 1000
        );
      } else {
        // SRT format with , for milliseconds
        const [secs, ms] = seconds.split(',');
        return (
          parseInt(hours) * 3600 +
          parseInt(minutes) * 60 +
          parseInt(secs) +
          parseInt(ms || '0') / 1000
        );
      }
    } else if (parts.length === 2) {
      // Format: MM:SS.mmm or MM:SS,mmm (no hours part)
      const [minutes, seconds] = parts;
      
      if (isVTT) {
        // VTT format with . for milliseconds
        const [secs, ms] = seconds.split('.');
        return (
          parseInt(minutes) * 60 +
          parseInt(secs) +
          parseInt(ms || '0') / 1000
        );
      } else {
        // SRT format with , for milliseconds
        const [secs, ms] = seconds.split(',');
        return (
          parseInt(minutes) * 60 +
          parseInt(secs) +
          parseInt(ms || '0') / 1000
        );
      }
    }
    
    console.error('Invalid time format:', timeStr);
    return 0;
  } catch (error) {
    console.error('Error parsing time:', timeStr, error);
    return 0;
  }
} 
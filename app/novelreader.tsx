import React, { memo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Platform, 
  StatusBar, 
  Animated, 
  SafeAreaView, 
  ActivityIndicator, 
  Dimensions, 
  FlatList,
  Modal,
  PanResponder as RNPanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  TouchableWithoutFeedback,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ScrollView,
  BackHandler
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useRef, useCallback, useEffect } from 'react';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import JSZip from 'jszip';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../constants/auth';
import { useIncognito } from '../hooks/useIncognito';
import '@fontsource/merriweather';
import '@fontsource/lora';
import '@fontsource/source-sans-pro';
import '@fontsource/inter';
import he from 'he';
import ePub from 'epubjs';
import type { Book as EPUBBook, NavItem } from 'epubjs';
import * as Constants from 'expo-constants';

const FONTS = {
  inter: {
    name: 'Inter',
    label: 'Inter',
    style: 'Inter_28pt-Regular'
  },
  merriweather: {
    name: 'Merriweather',
    label: 'Merriweather',
    style: 'Merriweather-Regular'
  },
  lora: {
    name: 'Lora',
    label: 'Lora',
    style: 'Lora-Regular'
  },
  sourceSansPro: {
    name: 'Source Sans Pro',
    label: 'Source Sans',
    style: 'SourceSansPro-Regular'
  }
} as const;

type FontKey = keyof typeof FONTS;

const THEMES = {
  light: {
    name: 'Light',
    background: '#FFFFFF',
    text: '#2C3E50',
    secondary: '#7F8C8D',
    headerBg: 'rgba(255, 255, 255, 0.98)',
    controlBg: 'rgba(255, 255, 255, 0.98)',
    tint: '#3498DB',
    border: 'rgba(0, 0, 0, 0.1)'
  },
  dark: {
    name: 'Dark',
    background: '#1A1A1A',
    text: '#E0E0E0',
    secondary: '#A0A0A0',
    headerBg: 'rgba(26, 26, 26, 0.98)',
    controlBg: 'rgba(26, 26, 26, 0.98)',
    tint: '#3498DB',
    border: 'rgba(255, 255, 255, 0.1)'
  },
  sepia: {
    name: 'Sepia',
    background: '#F5ECE2',
    text: '#5C4B3C',
    secondary: '#8B7355',
    headerBg: 'rgba(245, 236, 226, 0.98)',
    controlBg: 'rgba(245, 236, 226, 0.98)',
    tint: '#C4A484',
    border: 'rgba(92, 75, 60, 0.1)'
  },
  amoled: {
    name: 'AMOLED',
    background: '#000000',
    text: '#CCCCCC',
    secondary: '#888888',
    headerBg: 'rgba(0, 0, 0, 0.98)',
    controlBg: 'rgba(0, 0, 0, 0.98)',
    tint: '#3498DB',
    border: 'rgba(255, 255, 255, 0.1)'
  },
  cream: {
    name: 'Cream',
    background: '#FFF8E7',
    text: '#4A4A4A',
    secondary: '#767676',
    headerBg: 'rgba(255, 248, 231, 0.98)',
    controlBg: 'rgba(255, 248, 231, 0.98)',
    tint: '#D4A373',
    border: 'rgba(74, 74, 74, 0.1)'
  }
} as const;

type Theme = keyof typeof THEMES;

const STORAGE_KEYS = {
  FONT_SIZE: 'reader_font_size',
  THEME: 'reader_theme',
  FONT: 'reader_font',
  LINE_HEIGHT: 'reader_line_height',
  TEXT_ALIGN: 'reader_text_align',
  PARAGRAPH_SPACING: 'reader_paragraph_spacing',
  MARGIN_SIZE: 'reader_margin_size',
  DONT_ASK_SAVE: 'reader_dont_ask_save'
} as const;

interface EPUBValidationResult {
  isValid: boolean;
  rootDirectory: string;
  contentOpfPath: string;
}

type NovelReaderParams = {
  novelId?: string;
  volumeId?: string;
  downloadUrl?: string;
  title?: string;
  volumeTitle?: string;
}

interface Chapter {
  id: string;
  title: string;
  content: string;
  href?: string;
  order?: number;
}

interface TableOfContents {
  id: string;
  label: string;
  href: string;
  subitems?: TableOfContents[];
}

type ParagraphItem = {
  id: string;
  type: 'title' | 'image' | 'text';
  content: string;
  imageUri?: string;
  imageAlt?: string;
};

interface ManifestItem {
  href: string;
  mediaType: string;
}

interface CachedVolumeMetadata {
  novelId: string;
  volumeId: string;
  title: string;
  downloadUrl: string;
  extractedAt: number;
  imageMap: Record<string, string>;
  chapters: Chapter[];
  toc: TableOfContents[];
  totalImages: number;
}

const getStoragePath = (novelId: string, volumeId: string, type: 'root' | 'epub' | 'images' | 'metadata' = 'root') => {
  const isExpoGo = Constants.default.appOwnership === 'expo';
  
  // Use documentDirectory for persistent storage (not cache which can be cleared)
  const baseDir = isExpoGo
    ? FileSystem.documentDirectory // Use document directory for Expo Go for persistence
    : Platform.OS === 'android'
      ? FileSystem.documentDirectory // Use document directory for standalone Android
      : FileSystem.documentDirectory; // Use document directory for iOS for persistence
  
  const novelDir = `${baseDir}novels/${novelId}_${volumeId}/`;
  
  switch (type) {
    case 'epub':
      return `${novelDir}volume.epub`;
    case 'images':
      return `${novelDir}images/`;
    case 'metadata':
      return `${novelDir}metadata.json`;
    default:
      return novelDir;
  }
};

// Check if volume is already cached and up to date
const checkCachedVolume = async (novelId: string, volumeId: string): Promise<CachedVolumeMetadata | null> => {
  try {
    const metadataPath = getStoragePath(novelId, volumeId, 'metadata');
    const metadataInfo = await FileSystem.getInfoAsync(metadataPath);
    
    if (!metadataInfo.exists) {
      console.log('📁 No cached metadata found');
      return null;
    }
    
    const metadataContent = await FileSystem.readAsStringAsync(metadataPath);
    const metadata: CachedVolumeMetadata = JSON.parse(metadataContent);
    
    // Check if images directory exists and has the expected number of images
    const imagesDir = getStoragePath(novelId, volumeId, 'images');
    const imagesDirInfo = await FileSystem.getInfoAsync(imagesDir);
    
    if (!imagesDirInfo.exists) {
      console.log('📁 Images directory missing, cache invalid');
      return null;
    }
    
    // Verify some images exist
    const imageFiles = await FileSystem.readDirectoryAsync(imagesDir);
    if (imageFiles.length !== metadata.totalImages) {
      console.log(`📁 Image count mismatch: expected ${metadata.totalImages}, found ${imageFiles.length}`);
      return null;
    }
    
    console.log(`📁 ✅ Found valid cache with ${metadata.chapters.length} chapters and ${metadata.totalImages} images`);
    return metadata;
    
  } catch (error) {
    console.log('📁 Error checking cached volume:', error);
    return null;
  }
};

// Save volume metadata to cache
const saveCachedVolume = async (metadata: CachedVolumeMetadata): Promise<void> => {
  try {
    const metadataPath = getStoragePath(metadata.novelId, metadata.volumeId, 'metadata');
    await FileSystem.writeAsStringAsync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`📁 💾 Saved volume metadata with ${metadata.chapters.length} chapters and ${metadata.totalImages} images`);
  } catch (error) {
    console.error('📁 Error saving cached volume:', error);
  }
};

const processChapterContent = (content: string, imageMap?: Map<string, string>) => {
  // Extract and format chapter title
  let chapterTitle = '';
  let processedContent = content;
  let isTitlePage = false;
  let isCoverPage = false;

  // Title page indicators
  const titlePageIndicators = [
    /book\s+title\s+page/i,
    /title\s+page/i,
    /copyright\s+page/i,
    /^title$/i
  ];

  // Check if this is a cover page
  if (/cover/i.test(processedContent)) {
    isCoverPage = true;
    chapterTitle = 'Cover';
    isTitlePage = true;
  } else if (titlePageIndicators.some((pattern: RegExp) => pattern.test(processedContent))) {
    isTitlePage = true;
    chapterTitle = 'Title Page';
  } else {
    // First try to find header tags
    const headerPatterns = [
      /<h1[^>]*>(.*?)<\/h1>/i,
      /<h2[^>]*>(.*?)<\/h2>/i,
      /<title[^>]*>(.*?)<\/title>/i,
    ];

    // Look for headers first
    const lines = processedContent.split('\n');
    let foundTitle = false;

    // Try to find chapter indicators first
    const chapterIndicators = [
      /^(?:chapter|ch\.?)\s*(\d+)(?:\s*[-:]\s*(.+))?/i,
      /^(?:prologue)(?:\s*[-:]\s*(.+))?/i,
      /^(?:epilogue)(?:\s*[-:]\s*(.+))?/i,
      /^(?:afterword)(?:\s*[-:]\s*(.+))?/i,
      /^(?:interlude)(?:\s*[-:]\s*(.+))?/i
    ];

    for (let i = 0; i < Math.min(10, lines.length) && !foundTitle; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Check for chapter indicators first
      for (const pattern of chapterIndicators) {
        const match = line.match(pattern);
        if (match) {
          if (match[0].toLowerCase().startsWith('chapter') || match[0].toLowerCase().startsWith('ch')) {
            chapterTitle = match[2] ? `Chapter ${match[1]}: ${match[2]}` : `Chapter ${match[1]}`;
          } else {
            // For prologue, epilogue, etc.
            chapterTitle = match[1] ? `${match[0]}: ${match[1]}` : match[0];
          }
          chapterTitle = chapterTitle.replace(/^\w/, c => c.toUpperCase()); // Capitalize first letter
          foundTitle = true;
          break;
        }
      }

      if (foundTitle) break;

      // Then try header tags
      for (const pattern of headerPatterns) {
        const match = line.match(pattern);
        if (match) {
          chapterTitle = match[1]
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&[a-z]+;/g, '')
            .trim();
          if (chapterTitle) {
            foundTitle = true;
            break;
          }
        }
      }
    }

    // If still no title found, look for the first meaningful line
    if (!chapterTitle) {
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i].trim()
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&[a-z]+;/g, '')
          .trim();

        if (!line) continue;

        // Skip lines that are just numbers or simple chapter indicators
        if (/^[\d\s]*$/.test(line) || /^chapter\s+\d+$/i.test(line)) continue;

        chapterTitle = line;
        break;
      }
    }
  }

  // First decode HTML entities
  processedContent = he.decode(processedContent);

  // Extract images before cleaning up HTML
  const images: Array<{ src: string; alt: string }> = [];
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(processedContent)) !== null) {
    const imgTag = imgMatch[0];
    let src = imgMatch[1];
    
    // Normalize the src path - remove leading ../ and path components
    src = src.replace(/^\.\.\//, '').replace(/^.*\//, '');
    
    const altMatch = imgTag.match(/alt="([^"]+)"/);
    const alt = altMatch ? altMatch[1] : '';
    images.push({ src, alt });
  }
  
  // Debug: Log found images in this chapter
  if (images.length > 0) {
    console.log(`📸 Found ${images.length} images in chapter:`, images.map(img => img.src));
  }

  // For cover pages, we want to keep it simple - just the image
  if (isCoverPage) {
    return {
      title: chapterTitle,
      paragraphs: [],
      images,
      isTitlePage: true,
      isCoverPage: true
    };
  }

  // Clean up the content
  processedContent = processedContent
    // Remove DOCTYPE declarations and XML declarations
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\?xml[^>]*\?>/gi, '')
    // Remove HTML, HEAD, BODY tags and their content for image pages
    .replace(/<html[^>]*>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<body[^>]*>/gi, '')
    .replace(/<\/body>/gi, '')
    // Remove style and script tags with their content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Remove meta tags
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
    // Handle common HTML elements
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n')
    // Handle emphasis and strong tags
    .replace(/<em>|<i>/gi, '_')
    .replace(/<\/em>|<\/i>/gi, '_')
    .replace(/<strong>|<b>/gi, '**')
    .replace(/<\/strong>|<\/b>/gi, '**')
    // Remove any remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Clean up whitespace and special characters
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/\s+([.,!?;:"])/g, '$1')
    .replace(/([.,!?;:"])(?!\s|$)/g, '$1 ') // Add space after punctuation if missing
    .trim();

  // Split into paragraphs and filter out unwanted content
  const paragraphs = processedContent
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => {
      if (p.length === 0) return false;
      
      // Keep all content if it's a title page
      if (isTitlePage) return true;
      
      // Skip unwanted content for regular chapters
      const skipPatterns = [
        /copyright/i,
        /all rights reserved/i,
        /translation by/i,
        /cover art by/i,
        /this book is a work of fiction/i,
        /published by/i,
        /first published/i,
        /newsletter/i,
        /sign up/i,
        /^[\s\d©]+$/,
        /^table of contents$/i,
        /^contents$/i,
        /^index$/i,
        /^navigation$/i,
        /^nav$/i,
        /^toc$/i,
        /^page \d+$/i,
        /^\d+$/,
        /^chapter \d+$/i,
        /^volume \d+$/i,
      ];
      
      if (!isTitlePage && skipPatterns.some(pattern => pattern.test(p))) return false;
      if (/^[\s\d©\-_=+\.]+$/.test(p)) return false;
      
      // Skip very short paragraphs that are likely navigation or metadata
      if (p.length < 10 && !/[a-zA-Z]{3,}/.test(p)) return false;
      
      return true;
    });

  return {
    title: chapterTitle || (isTitlePage ? 'Title Page' : 'Chapter'),
    paragraphs,
    images,
    isTitlePage,
    isCoverPage
  };
};



const processEpub = async (
  epubData: string,
  novelId: string,
  volumeId: string
): Promise<{ chapters: Chapter[], toc: TableOfContents[], imageMap: Map<string, string>, metadata: CachedVolumeMetadata }> => {
  try {
    // Convert base64 to ArrayBuffer
    const byteCharacters = atob(epubData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const arrayBuffer = new Uint8Array(byteNumbers).buffer;

    // Load the EPUB with JSZip
    const zip = new JSZip();
    await zip.loadAsync(arrayBuffer);
    
    // Find and parse container.xml to get OPF file path
    const containerXml = await zip.file('META-INF/container.xml')?.async('text');
    if (!containerXml) {
      throw new Error('Invalid EPUB: Missing container.xml');
    }
    
    const opfPathMatch = containerXml.match(/<rootfile[^>]+full-path="([^"]+)"/);
    if (!opfPathMatch) {
      throw new Error('Invalid EPUB: Cannot find OPF file path');
    }
    
    const opfPath = opfPathMatch[1];
    const opfDir = opfPath.split('/').slice(0, -1).join('/');
    
    // Parse OPF file to get spine and manifest
    const opfContent = await zip.file(opfPath)?.async('text');
    if (!opfContent) {
      throw new Error('Invalid EPUB: Missing OPF file');
    }
    
    // Parse manifest items
    const manifestItems = new Map<string, ManifestItem>();
    const manifestMatches = opfContent.matchAll(/<item[^>]+id="([^"]+)"[^>]+href="([^"]+)"[^>]+media-type="([^"]+)"/g);
    for (const match of manifestMatches) {
      manifestItems.set(match[1], {
        href: match[2],
        mediaType: match[3]
      });
    }

    // Find cover image
    let coverId = opfContent.match(/<meta[^>]+name="cover"[^>]+content="([^"]+)"/)?.[1];
    if (!coverId) {
      // Try alternate cover specification methods
      coverId = opfContent.match(/<item[^>]+id="cover"[^>]+href="([^"]+)"/)?.[1];
    }
    
    // Create directories and extract images as before
    const novelDir = getStoragePath(novelId, volumeId);
    const imageDir = getStoragePath(novelId, volumeId, 'images');

    const dirInfo = await FileSystem.getInfoAsync(novelDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(novelDir, { intermediates: true });
      await FileSystem.makeDirectoryAsync(imageDir, { intermediates: true });
    } else {
      const imageDirInfo = await FileSystem.getInfoAsync(imageDir);
      if (!imageDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(imageDir, { intermediates: true });
      }
    }

    // Extract and save images with comprehensive mapping
    const imageMap = new Map<string, string>();
    let totalImages = 0;
    const savedImagePaths = new Set<string>(); // Track all saved image paths for validation
    
    for (const [id, item] of manifestItems.entries()) {
      if (item.mediaType.startsWith('image/')) {
        totalImages++;
        const imagePath = opfDir ? `${opfDir}/${item.href}` : item.href;
        const imageFile = zip.file(imagePath);
        if (imageFile) {
          const imageData = await imageFile.async('base64');
          
          try {
            // Get the original filename from href, preserving the original name when possible
            let fileName = item.href.split('/').pop() || id;
            
            // Remove any double extensions and normalize
            fileName = fileName.replace(/\.(png|jpg|jpeg|gif|webp)\.(png|jpg|jpeg|gif|webp)$/i, '.$2');
            
            // Ensure we have an extension
            const hasExtension = /\.(png|jpg|jpeg|gif|webp)$/i.test(fileName);
            if (!hasExtension) {
              // Get extension from media type or item href
              let extension = 'jpg'; // default
              if (item.mediaType.includes('png')) extension = 'png';
              else if (item.mediaType.includes('jpeg') || item.mediaType.includes('jpg')) extension = 'jpg';
              else if (item.mediaType.includes('gif')) extension = 'gif';
              else if (item.mediaType.includes('webp')) extension = 'webp';
              fileName = `${fileName}.${extension}`;
            }
            
            // Normalize jpeg to jpg for consistency
            fileName = fileName.replace(/\.jpeg$/i, '.jpg');
            
            const localImagePath = `${imageDir}${fileName}`;
            
            await FileSystem.writeAsStringAsync(localImagePath, imageData, {
              encoding: FileSystem.EncodingType.Base64
            });
            
            // Store multiple mappings for this image to handle different reference patterns
            const fullPath = localImagePath;
            
            // Map the original href
            imageMap.set(item.href, fullPath);
            
            // Map just the filename (for references like "image1.png")
            imageMap.set(fileName, fullPath);
            
            // Map the id (for references that use the manifest id)
            imageMap.set(id, fullPath);
            
            // Map without path components (for references like "../Images/image1.png" -> "image1.png")
            const baseFileName = fileName.replace(/^.*[\/\\]/, '');
            imageMap.set(baseFileName, fullPath);
            
            savedImagePaths.add(fullPath);
            
            console.log(`🖼️ Saved image ${totalImages}:`, {
              id,
              href: item.href,
              fileName,
              localPath: localImagePath,
              mediaType: item.mediaType,
              mappings: [item.href, fileName, id, baseFileName]
            });
            
            // Only log cover image specifically
            if (id === coverId) {
              console.log('📚 Found cover image:', item.href);
            }
          } catch (err) {
            console.error(`Failed to save image ${id}:`, err);
          }
        } else {
          console.warn(`Image file not found in EPUB: ${imagePath}`);
        }
      }
    }
    
    console.log(`📁 💾 Extracted ${totalImages} images with ${imageMap.size} path mappings`);
    
    // Parse spine order
    const spineItems: string[] = [];
    const spineMatches = opfContent.matchAll(/<itemref[^>]+idref="([^"]+)"/g);
    for (const match of spineMatches) {
      const item = manifestItems.get(match[1]);
      if (item?.href) {
        spineItems.push(item.href);
      }
    }
    
    // Parse NCX file for table of contents to get chapter titles
    const tocId = opfContent.match(/spine[^>]+toc="([^"]+)"/)?.[1];
    const tocItem = tocId ? manifestItems.get(tocId) : null;
    let toc: TableOfContents[] = [];
    let tocTitleMap = new Map<string, string>();
    
    if (tocItem?.href) {
      const tocPath = opfDir ? `${opfDir}/${tocItem.href}` : tocItem.href;
      const tocContent = await zip.file(tocPath)?.async('text');
      if (tocContent) {
        const navPoints = tocContent.matchAll(/<navPoint[^>]+id="([^"]+)"[^>]*>(?:[^]*?<navLabel[^>]*>(?:[^]*?<text[^>]*>([^<]+)<\/text>)[^]*?<\/navLabel>)[^]*?<content[^>]+src="([^"]+)"/g);
        for (const point of navPoints) {
          const href = point[3].split('#')[0]; // Remove fragment identifier
          const title = point[2].trim();
          tocTitleMap.set(href, title);
          toc.push({
            id: point[1],
            label: title,
            href: href,
            subitems: []
          });
        }
      }
    }
    
    // Process chapters following spine order
    const chapters: Chapter[] = [];
    let order = 0;
    
    for (const href of spineItems) {
      try {
        const fullPath = opfDir ? `${opfDir}/${href}` : href;
        const content = await zip.file(fullPath)?.async('text');
        
        if (!content) continue;
        
        // Skip unwanted content by filename
        const skipFiles = [
          'copyright',
          'toc.',
          'nav.',
          'navigation',
          'contents',
          'index.',
          'titlepage',
          'title_page',
          'frontmatter',
          'backmatter',
          'acknowledgments',
          'acknowledgements',
          'dedication',
          'preface',
          'foreword',
          'about_author',
          'about-author',
          'aboutauthor',
          'colophon',
          'imprint',
          'publisher',
          'credits'
        ];
        
        const shouldSkipFile = skipFiles.some(skipFile => 
          href.toLowerCase().includes(skipFile)
        );
        
        if (shouldSkipFile || content.length < 50) {
          console.log(`Skipping file: ${href} (${shouldSkipFile ? 'unwanted file type' : 'too short'})`);
          continue;
        }

        // Replace image src attributes with local file paths
        let processedContent = content;
        for (const [originalSrc, localPath] of imageMap.entries()) {
          const escapedSrc = originalSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // Don't add file:// prefix if localPath already has it
          const finalPath = localPath.startsWith('file://') ? localPath : `file://${localPath}`;
          processedContent = processedContent.replace(
            new RegExp(`src=["'](?:\\.\\./)?${escapedSrc}["']`, 'g'),
            `src="${finalPath}"`
          );
        }
        
        // Get title from TOC if available, otherwise process content
        const tocTitle = tocTitleMap.get(href);
        const processedChapter = processChapterContent(processedContent, imageMap);
        
        // Check if the processed chapter has meaningful content
        const hasText = processedChapter.paragraphs && processedChapter.paragraphs.length > 0;
        const hasImages = processedChapter.images && processedChapter.images.length > 0;
        const hasTitle = processedChapter.title && processedChapter.title.trim().length > 0;
        
        // Skip if no meaningful content (no text, no images, or just whitespace)
        if (!hasText && !hasImages) {
          continue;
        }
        
        // Skip if only has very short text content (likely navigation or metadata)
        if (hasText && !hasImages && processedChapter.paragraphs.join('').trim().length < 100) {
          continue;
        }
        
        chapters.push({
          id: href,
          title: tocTitle || processedChapter.title,
          content: processedContent,
          href,
          order: order++
        });
        
      } catch (err) {
        console.warn(`Failed to process chapter ${href}:`, err);
      }
    }
    
    // Save the processed data to cache
    const metadata: CachedVolumeMetadata = {
      novelId,
      volumeId,
      title: '', // Will be set by caller
      downloadUrl: '', // Will be set by caller
      extractedAt: Date.now(),
      imageMap: Object.fromEntries(imageMap),
      chapters,
      toc,
      totalImages
    };

    return {
      chapters: chapters,
      toc,
      imageMap,
      metadata
    };
    
  } catch (error) {
    console.error('Error processing EPUB:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to process EPUB: ${errorMessage}`);
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 80,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterSelector: {
    flex: 1,
    marginLeft: 12,
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
    lineHeight: 20,
    marginBottom: 4,
  },
  chapterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingVertical: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    flexShrink: 1,
    marginRight: 4,
  },
  headerIcon: {
    marginLeft: 4,
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 120 : 100,
    paddingBottom: Platform.OS === 'ios' ? 160 : 140,
  },
  contentWrapper: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 120 : 100,
  },
  contentScrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: Platform.OS === 'ios' ? 20 : 20,
    paddingBottom: Platform.OS === 'ios' ? 160 : 140,
  },
  chapterTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 32,
  },
  paragraph: {
    fontSize: 18,
    marginBottom: 24,
  },
  imageContainer: {
    marginVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  chapterImage: {
    width: Dimensions.get('window').width - 32,
    height: 300,
    borderRadius: 8,
  },
  imageCaption: {
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  titlePageImage: {
    width: '100%',
    height: 400,
    borderRadius: 12,
    marginBottom: 32
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#02A9FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsContainer: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  settingsContent: {
    padding: 16,
  },
  settingSection: {
    marginBottom: 24,
  },
  settingSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  fontButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fontButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  fontButtonText: {
    fontSize: 16,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sliderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderValue: {
    fontSize: 16,
    minWidth: 60,
    textAlign: 'center',
  },
  progressBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 110 : 92,
    left: 24,
    right: 24,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    zIndex: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  quickActions: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 34 : 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 16,
    height: 60,
    alignItems: 'center',
    zIndex: 100,
  },
  quickActionsBackground: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 0,
    bottom: 0,
    borderRadius: 30,
    borderWidth: 1,
    opacity: 0.95,
  },
  quickActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  headerVolume: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
  },
  closeButton: {
    padding: 8,
  },
  radioButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radioButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  radioButtonText: {
    fontSize: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchButton: {
    width: 52,
    height: 32,
    borderRadius: 16,
    padding: 2,
  },
  switchCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
  },
  chapterListModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  chapterListContainer: {
    flex: 1,
    marginTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight,
    backgroundColor: 'transparent',
  },
  chapterListContent: {
    flex: 1,
    backgroundColor: 'transparent',
    padding: 16,
  },
  chapterListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  chapterListTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  chapterItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chapterItemContent: {
    flex: 1,
  },
  chapterItemTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  bookmarkButton: {
    padding: 8,
    marginLeft: 8,
  },
  currentChapter: {
    borderWidth: 2,
  },
  fullScreenImageContainer: {
    flex: 1,
    width: '100%',
    height: Dimensions.get('window').height,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 0,
    padding: 0,
  },
  fullScreenImageScrollContent: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    resizeMode: 'contain',
  },
  titlePageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 0,
    padding: 0,
  },
  saveProgressModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  saveProgressContainer: {
    width: '90%',
    padding: 24,
    borderRadius: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  saveProgressTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  saveProgressMessage: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  saveProgressButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  saveProgressButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveProgressButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dontAskContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  dontAskText: {
    fontSize: 14,
  },
  checkboxContainer: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
});

// Image component with retry logic and loading state
const ImageWithRetry = memo(({ 
  uri, 
  style, 
  resizeMode = 'contain' 
}: {
  uri: string;
  style: any;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [currentUri, setCurrentUri] = useState(uri);
  const maxRetries = 3;

  // Reset state when URI changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setRetryCount(0);
    setCurrentUri(uri);
  }, [uri]);

  const handleRetry = () => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      setIsLoading(true);
      setHasError(false);
      // Force image refresh by adding timestamp
      setCurrentUri(`${uri}?retry=${retryCount + 1}`);
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = (error: any) => {
    setIsLoading(false);
    setHasError(true);
    
    // Debug: Log image loading errors for the first few attempts
    if (retryCount === 0) {
      console.log(`❌ Image load failed:`, {
        uri: currentUri,
        error: error.nativeEvent?.error || error.message || 'Unknown error'
      });
    }
    
    // Auto-retry if under limit
    if (retryCount < maxRetries) {
      setTimeout(handleRetry, 1000 * (retryCount + 1)); // Exponential backoff
    }
  };

  return (
    <View style={style}>
      {isLoading && (
        <View style={[style, {
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.1)',
          position: 'absolute',
          zIndex: 1
        }]}>
          <ActivityIndicator size="large" color="#02A9FF" />
          <Text style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
            Loading image...
          </Text>
        </View>
      )}
      
      <Image
        source={{ uri: currentUri }}
        style={style}
        resizeMode={resizeMode}
        onLoad={handleLoad}
        onError={handleError}
      />
      
      {hasError && retryCount >= maxRetries && (
        <View style={[style, {
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.1)',
          position: 'absolute',
          zIndex: 1
        }]}>
          <Text style={{ color: '#999', fontSize: 12, textAlign: 'center', marginBottom: 8 }}>
            Image failed to load
          </Text>
          <TouchableOpacity
            onPress={handleRetry}
            style={{
              backgroundColor: '#02A9FF',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 4
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12 }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const ChapterContent = memo(({ 
  chapter, 
  colors, 
  fontSize, 
  lineHeight, 
  currentFont, 
  paragraphSpacing, 
  textAlign, 
  isTitlePage, 
  horizontalPadding,
  onScroll,
  imageMap,
  onTap,
  onSwipe
}: {
  chapter: Chapter;
  colors: typeof THEMES[Theme];
  fontSize: number;
  lineHeight: number;
  currentFont: string;
  paragraphSpacing: number;
  textAlign: 'left' | 'justify';
  isTitlePage: boolean;
  horizontalPadding: number;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  imageMap?: Map<string, string>;
  onTap?: (x: number) => void;
  onSwipe?: (direction: 'left' | 'right') => void;
}) => {
  // Memoize the processed content to prevent re-processing on every render
  const processedContent = React.useMemo(() => {
    return processChapterContent(chapter.content, imageMap);
  }, [chapter.content, imageMap]);
  
  if (!processedContent) return null;

  const { title, paragraphs, images, isCoverPage } = processedContent;

  // Check if this is primarily an image page
  const isImagePage = images.length > 0 && paragraphs.length === 0;
  
  const items: ParagraphItem[] = [
    // Only show title if it's not a title page, cover page, or image-only page
    ...(!isTitlePage && !isCoverPage && !isImagePage ? [{ id: 'title', type: 'title' as const, content: title }] : []),
    ...images.map((img: { src: string; alt: string }, idx: number) => {
      // Normalize the image path to match what's in imageMap
      let normalizedSrc = img.src;
      
      // Remove any leading path components and normalize
      const filename = img.src.replace(/^.*[\\/]/, '').replace(/^\.\.\//, '');
      
             // Try to find the matching image in imageMap
       let resolvedUri = img.src;
       let found = false;
       if (imageMap) {
         for (const [key, value] of imageMap.entries()) {
           const mapFilename = key.replace(/^.*[\\/]/, '');
           if (mapFilename === filename || key === filename || key.includes(filename)) {
             resolvedUri = value;
             found = true;
             break;
           }
         }
         
         if (!found) {
           console.warn(`⚠️ Image not found in imageMap:`, {
             originalSrc: img.src,
             filename,
             availableImages: Array.from(imageMap.keys())
           });
         }
       }
      
      return {
        id: `image-${idx}`,
        type: 'image' as const,
        content: '',
        imageUri: resolvedUri,
        imageAlt: img.alt
      };
    }),
    ...(!isTitlePage && !isCoverPage ? paragraphs.map((p: string, idx: number) => ({
      id: `p-${idx}`,
      type: 'text' as const,
      content: p.trim()
    })) : [])
  ];

  const renderItem = ({ item }: { item: ParagraphItem }) => {
    switch (item.type) {
      case 'title':
        return (
          <Text style={[styles.chapterTitle, { 
            color: colors.text,
            fontFamily: currentFont,
            fontSize: fontSize + 6,
            lineHeight: (fontSize + 6) * 1.2,
            marginBottom: 32,
            textAlign: 'center'
          }]}>
            {item.content}
          </Text>
        );
      case 'image':
        if (!item.imageUri) {
          return null;
        }
        
        // Check if this is an image-only page (no text content or only title)
        const textItems = items.filter(i => i.type === 'text');
        const hasOnlyTitle = items.length === 2 && items.some(i => i.type === 'title');
        const isImageOnlyPage = items.length === 1 || hasOnlyTitle || textItems.length === 0;
        const isFullScreen = isTitlePage || isCoverPage || isImageOnlyPage;
        
        // Only log the first few images to avoid spam
        if (item.id === 'image-0') {
          console.log(`🖼️ Rendering images in chapter`);
        }
        
        return (
          <TouchableWithoutFeedback
            onPress={(evt) => {
              // Handle tap on image
              const { locationX } = evt.nativeEvent;
              onTap?.(locationX);
            }}
          >
            <View style={[
              styles.imageContainer,
              isFullScreen && styles.fullScreenImageContainer
            ]}>
              <ImageWithRetry
                uri={item.imageUri}
                style={[
                  styles.chapterImage,
                  isFullScreen ? styles.fullScreenImage : undefined
                ]}
                resizeMode="contain"
              />
            </View>
          </TouchableWithoutFeedback>
        );
      case 'text':
        return (
          <Text 
            style={[
              styles.paragraph, 
              { 
                color: colors.text,
                fontSize: fontSize,
                lineHeight: fontSize * lineHeight,
                fontFamily: currentFont,
                marginBottom: paragraphSpacing,
                textAlign: textAlign,
              }
            ]}
          >
            {item.content}
          </Text>
        );
    }
  };

  const contentPanResponder = RNPanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Only capture clear horizontal swipes
      const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2 && Math.abs(gestureState.dx) > 30;
      return isHorizontalSwipe;
    },
    onPanResponderRelease: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      // Handle swipes
      if (Math.abs(gestureState.dx) > 50) {
        if (gestureState.dx > 0) {
          onSwipe?.('right');
        } else {
          onSwipe?.('left');
        }
      } else if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
        // Handle taps
        onTap?.(evt.nativeEvent.locationX);
      }
    }
  });

  return (
    <View style={{ flex: 1 }} {...contentPanResponder.panHandlers}>
      <ScrollView
        style={styles.contentScrollView}
        onScroll={onScroll}
        scrollEventThrottle={32}
        showsVerticalScrollIndicator={false}
      >
      <View style={[
        styles.contentContainer,
        { paddingHorizontal: isTitlePage || isCoverPage ? 0 : horizontalPadding },
        (isTitlePage || isCoverPage) && styles.titlePageContainer
      ]}>
        {items.map((item, index) => (
          <View key={`${item.type}-${item.id}-${index}`}>
            {renderItem({ item })}
          </View>
        ))}
      </View>
    </ScrollView>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  return (
    prevProps.chapter.id === nextProps.chapter.id &&
    prevProps.fontSize === nextProps.fontSize &&
    prevProps.lineHeight === nextProps.lineHeight &&
    prevProps.currentFont === nextProps.currentFont &&
    prevProps.paragraphSpacing === nextProps.paragraphSpacing &&
    prevProps.textAlign === nextProps.textAlign &&
    prevProps.horizontalPadding === nextProps.horizontalPadding &&
    prevProps.colors === nextProps.colors
  );
});

export default function NovelReader() {
  const router = useRouter();
  const { novelId, volumeId, downloadUrl, title, volumeTitle } = useLocalSearchParams<NovelReaderParams>();
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [error, setError] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [fontSize, setFontSize] = useState(18);
  const [theme, setTheme] = useState<Theme>('light');
  const [showControls, setShowControls] = useState(true);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [showChapterList, setShowChapterList] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [showSaveProgress, setShowSaveProgress] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const { isIncognito } = useIncognito();
  const [lineHeight, setLineHeight] = useState(1.6);
  const [fontFamily, setFontFamily] = useState('System');
  const [textAlign, setTextAlign] = useState<'left' | 'justify'>('left');
  const [paragraphSpacing, setParagraphSpacing] = useState(24);
  const [showUI, setShowUI] = useState(true);
  const [font, setFont] = useState<FontKey>('merriweather');
  const [marginSize, setMarginSize] = useState<'compact' | 'normal' | 'wide'>('normal');
  const [lastTapTime, setLastTapTime] = useState(0);
  const [bookmarkVisible, setBookmarkVisible] = useState(false);
  const [bookmarks, setBookmarks] = useState<Array<{chapter: number, scroll: number}>>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showBookmarksModal, setShowBookmarksModal] = useState(false);
  const [imageMap, setImageMap] = useState<Map<string, string>>(new Map());
  const hideUITimeout = useRef<NodeJS.Timeout | null>(null);

  const colors = THEMES[theme];
  const currentFont = FONTS[font].style;
  const horizontalPadding = {
    compact: 16,
    normal: 24,
    wide: 40
  }[marginSize];

  const scrollViewRef = useRef<ScrollView>(null);
  const screenHeight = Dimensions.get('window').height;

  const panResponder = RNPanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Only capture horizontal swipes that are clearly horizontal
      const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2 && Math.abs(gestureState.dx) > 20;
      return isHorizontalSwipe;
    },
    onPanResponderGrant: (evt: GestureResponderEvent) => {
      const now = Date.now();
      if (now - lastTapTime < 300) {
        handleDoubleTap(evt.nativeEvent.locationX);
      }
      setLastTapTime(now);
    },
    onPanResponderRelease: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      // Handle swipes
      if (Math.abs(gestureState.dx) > 50) { // Minimum swipe distance
        if (gestureState.dx > 0) {
          // Swipe right - go to previous chapter
          if (currentChapter > 0) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setCurrentChapter(prev => prev - 1);
          }
        } else {
          // Swipe left - go to next chapter
          if (currentChapter < chapters.length - 1) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setCurrentChapter(prev => prev + 1);
          }
        }
      } else if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
        // Handle taps
        handleSingleTap(evt.nativeEvent.locationX);
      }
    }
  });

  const resetHideUITimer = () => {
    if (hideUITimeout.current) {
      clearTimeout(hideUITimeout.current);
    }
    setShowUI(true);
    hideUITimeout.current = setTimeout(() => {
      setShowUI(false);
    }, 10000); // 10 seconds
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (hideUITimeout.current) {
        clearTimeout(hideUITimeout.current);
      }
    };
  }, []);

  const handleSingleTap = (x: number) => {
    const screenWidth = Dimensions.get('window').width;
    if (x < screenWidth * 0.3) {
      // Left side tap
      if (currentChapter > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCurrentChapter(prev => prev - 1);
        resetHideUITimer();
      }
    } else if (x > screenWidth * 0.7) {
      // Right side tap
      if (currentChapter < chapters.length - 1) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCurrentChapter(prev => prev + 1);
        resetHideUITimer();
      }
    } else {
      // Center tap - toggle UI visibility
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (!showUI) {
        resetHideUITimer();
      } else {
        setShowUI(false);
        if (hideUITimeout.current) {
          clearTimeout(hideUITimeout.current);
        }
      }
    }
  };

  const handleDoubleTap = (x: number) => {
    const screenWidth = Dimensions.get('window').width;
    if (x < screenWidth / 2) {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, (scrollY as any)._value - screenHeight * 0.9),
        animated: true
      });
    } else {
      scrollViewRef.current?.scrollTo({
        y: (scrollY as any)._value + screenHeight * 0.9,
        animated: true
      });
    }
    resetHideUITimer();
  };

  const moveToNextChapter = () => {
    if (currentChapter < chapters.length - 1) {
      setCurrentChapter(prev => prev + 1);
      // Reset scroll position for new chapter
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }
  };

  useEffect(() => {
    if (!downloadUrl) {
      setError('No download URL provided');
      setLoading(false);
      return;
    }

    const downloadAndExtractEpub = async () => {
      try {
        setLoading(true);
        setLoadingMessage('Checking cache...');
        
        // Check if we have a valid cached version first
        const cachedData = await checkCachedVolume(novelId || 'unknown', volumeId || 'unknown');
        if (cachedData) {
          console.log('📁 ✅ Loading from cache');
          setLoadingMessage('Loading from cache...');
          
          // Convert imageMap back to Map
          const imageMapFromCache = new Map(Object.entries(cachedData.imageMap));
          
          setChapters(cachedData.chapters);
          setImageMap(imageMapFromCache);
          setLoadingMessage('Ready to read!');
          setLoading(false);
          return;
        }

        console.log('📁 No valid cache found, processing...');
        setLoadingMessage('Preparing download...');
        const fileUri = getStoragePath(novelId || 'unknown', volumeId || 'unknown', 'epub');
        const imageDir = getStoragePath(novelId || 'unknown', volumeId || 'unknown', 'images');
        const novelDir = getStoragePath(novelId || 'unknown', volumeId || 'unknown');

        // Create novels directory if it doesn't exist
        const baseDir = getStoragePath(novelId || 'unknown', volumeId || 'unknown', 'root').split('novels')[0];
        const novelsDir = `${baseDir}novels`;
        const novelsDirInfo = await FileSystem.getInfoAsync(novelsDir);
        if (!novelsDirInfo.exists) {
          await FileSystem.makeDirectoryAsync(novelsDir, { intermediates: true });
        }

        // Create novel-specific directory if it doesn't exist
        const novelDirInfo = await FileSystem.getInfoAsync(novelDir);
        if (!novelDirInfo.exists) {
          await FileSystem.makeDirectoryAsync(novelDir, { intermediates: true });
        }

        // Create images directory if it doesn't exist
        const imageDirInfo = await FileSystem.getInfoAsync(imageDir);
        if (!imageDirInfo.exists) {
          await FileSystem.makeDirectoryAsync(imageDir, { intermediates: true });
        }

        // Check if we need to reprocess due to corrupted cache (double extension bug)
        let needsReprocessing = false;
        
        if (imageDirInfo.exists) {
          try {
            const imageFiles = await FileSystem.readDirectoryAsync(imageDir);
            // Check if any files have double extensions (indicates corrupted cache)
            const hasDoubleExtensions = imageFiles.some(file => 
              file.includes('.png.png') || file.includes('.jpg.jpg') || 
              file.includes('.jpeg.jpg') || file.includes('.gif.gif') || file.includes('.webp.webp')
            );
            if (hasDoubleExtensions) {
              console.log('🧹 Clearing corrupted cache with double extensions...');
              await FileSystem.deleteAsync(novelDir, { idempotent: true });
              needsReprocessing = true;
            }
          } catch (err) {
            console.log('Could not check image directory:', err);
          }
        }
        
        // For this specific volume, force reprocessing to fix the double extension issue
        if (volumeId === '15rowF9ZVQLnmKaFhA0wxno4XuRmUEiaR') {
          console.log('🔧 Force clearing cache for this volume to fix double extension bug...');
          try {
            await FileSystem.deleteAsync(novelDir, { idempotent: true });
            needsReprocessing = true;
          } catch (err) {
            console.log('Could not clear cache:', err);
          }
        }
        
        // Ensure all directories exist (recreate after clearing or create if missing)
        await FileSystem.makeDirectoryAsync(novelsDir, { intermediates: true });
        await FileSystem.makeDirectoryAsync(novelDir, { intermediates: true });
        await FileSystem.makeDirectoryAsync(imageDir, { intermediates: true });

        // Download the file if it doesn't exist or needs reprocessing
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (!fileInfo.exists || needsReprocessing) {
          setLoadingMessage('Downloading EPUB file...');
          // Handle Google Drive URLs better
          let processedUrl = decodeURIComponent(downloadUrl);
          if (processedUrl.includes('drive.google.com')) {
            // Convert Google Drive share links to direct download links
            const fileIdMatch = processedUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (fileIdMatch) {
              processedUrl = `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}&confirm=t`;
            }
          }
          
          // For Google Drive, we might need to handle redirects and confirmations
          let downloadSuccess = false;
          let attempts = 0;
          const maxAttempts = 3;
          
                      while (!downloadSuccess && attempts < maxAttempts) {
              attempts++;
              
              try {
                const downloadResumable = FileSystem.createDownloadResumable(
                  processedUrl,
                  fileUri,
                  {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                  }
                );

                const result = await downloadResumable.downloadAsync();
                if (result) {
                  downloadSuccess = true;
                } else {
                  throw new Error(`Download attempt ${attempts} failed`);
                }
              } catch (downloadError: unknown) {
                const errorMessage = downloadError instanceof Error ? downloadError.message : String(downloadError);
                
                // If it's a Google Drive file and we haven't tried the alternative URL
                if (attempts === 1 && processedUrl.includes('drive.google.com')) {
                  const fileIdMatch = processedUrl.match(/id=([a-zA-Z0-9-_]+)/);
                  if (fileIdMatch) {
                    // Try alternative Google Drive download URL
                    processedUrl = `https://drive.usercontent.google.com/download?id=${fileIdMatch[1]}&export=download&authuser=0&confirm=t`;
                    continue;
                  }
                }
                
                if (attempts === maxAttempts) {
                  throw new Error(`Download failed after ${maxAttempts} attempts: ${errorMessage}`);
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
              }
            }
          
          // Verify the downloaded file is valid
          const downloadedFileInfo = await FileSystem.getInfoAsync(fileUri);
          if (!downloadedFileInfo.exists || downloadedFileInfo.size === 0) {
            throw new Error('Downloaded file is empty or corrupted');
          }
        }

        // Read the epub file
        setLoadingMessage('Processing EPUB content...');
        const epubData = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
        
        // Process EPUB using epubjs
        setLoadingMessage('Extracting chapters and images...');
        const { chapters: processedChapters, toc, imageMap: extractedImageMap, metadata } = await processEpub(epubData, novelId || 'unknown', volumeId || 'unknown');

        // Update metadata with additional info and save to cache
        metadata.title = title || 'Unknown Title';
        metadata.downloadUrl = downloadUrl || '';
        await saveCachedVolume(metadata);

        setChapters(processedChapters);
        setImageMap(extractedImageMap);
        setLoadingMessage('Ready to read!');
        
        // Debug: Check if image files actually exist and log imageMap contents
        if (extractedImageMap.size > 0) {
          console.log(`🗺️ ImageMap contents (${extractedImageMap.size} images):`, Array.from(extractedImageMap.entries()));
          
          const firstImage = Array.from(extractedImageMap.values())[0];
          try {
            const fileInfo = await FileSystem.getInfoAsync(firstImage);
            console.log(`🔍 First image file check:`, {
              path: firstImage,
              exists: fileInfo.exists,
              size: fileInfo.exists ? (fileInfo as any).size : 'N/A',
              uri: fileInfo.uri
            });
          } catch (error) {
            console.log(`🔍 Error checking first image:`, error);
          }
        }

      } catch (err) {
        console.error('Error processing epub:', err);
        setError('Failed to process epub');
      } finally {
        setLoading(false);
      }
    };

    downloadAndExtractEpub();
  }, [novelId, volumeId, downloadUrl]);

  useEffect(() => {
    // Set system UI colors based on theme
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(colors.background);
      StatusBar.setBarStyle(theme === 'dark' || theme === 'amoled' ? 'light-content' : 'dark-content');
    }
  }, [theme, colors]);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Check if user is logged in to AniList
    SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN).then(token => {
      // If in incognito mode, not logged in to AniList, or don't ask is enabled, just save locally and go back
      if (isIncognito || !token || dontAskAgain) {
        saveLocalProgress();
        router.back();
        return;
      }
      
      setShowSaveProgress(true);
    });
  };

  const handleThemeChange = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTheme(current => {
      const themeOrder: Theme[] = ['light', 'dark', 'sepia', 'amoled', 'cream'];
      const currentIndex = themeOrder.indexOf(current);
      return themeOrder[(currentIndex + 1) % themeOrder.length];
    });
  };

  const handleFontSizeChange = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFontSize(prev => Math.max(12, Math.min(24, prev + delta)));
  };

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const contentHeight = event.nativeEvent.contentSize.height;
      const screenHeight = event.nativeEvent.layoutMeasurement.height;
      
      const progress = Math.min(offsetY / (contentHeight - screenHeight), 1);
      setReadingProgress(progress);
      scrollY.setValue(offsetY);
      resetHideUITimer();
    },
    [scrollY]
  );

  const handleLineHeightChange = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLineHeight(prev => Math.max(1.2, Math.min(2.0, prev + delta)));
  };

  const handleParagraphSpacingChange = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setParagraphSpacing(prev => Math.max(16, Math.min(48, prev + delta)));
  };

  const saveToAnilist = async () => {
    try {
      // Skip AniList sync if in incognito mode
      if (isIncognito) {
        console.log('Incognito mode is active - skipping AniList sync');
        return false;
      }

      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      if (!token) {
        console.log('No Anilist access token found');
        return false;
      }

      // First, get the last saved progress from AsyncStorage
      const lastProgressKey = `last_chapter_count_${novelId}`;
      let lastSavedCount = 0;
      try {
        const savedCount = await AsyncStorage.getItem(lastProgressKey);
        if (savedCount) {
          lastSavedCount = parseInt(savedCount, 10);
          console.log('📚 Last saved chapter count:', lastSavedCount);
        }
      } catch (error) {
        console.error('Error getting last saved count:', error);
      }

      // Count actual chapters up to current position in this volume
      let volumeChapterCount = 0;
      for (let i = 0; i <= currentChapter; i++) {
        const chapter = chapters[i];
        if (!chapter) continue;

        const processedContent = processChapterContent(chapter.content);
        const title = chapter.title.toLowerCase();

        // Skip if it's a cover page, title page, or image-only chapter
        if (processedContent.isCoverPage || processedContent.isTitlePage || 
            (processedContent.images.length > 0 && !processedContent.paragraphs.length)) {
          continue;
        }

        // Check if it's a real chapter (has "Chapter X" or "Prologue" etc.)
        const isChapterTitle = /chapter\s+\d+/i.test(title) || 
                             /^prologue/i.test(title) ||
                             /^epilogue/i.test(title) ||
                             /^afterword/i.test(title) ||
                             /^interlude/i.test(title);

        if (isChapterTitle) {
          volumeChapterCount++;
        }
      }

      // Calculate total chapters read (previous volumes + current volume)
      const totalChaptersRead = lastSavedCount + volumeChapterCount;
      console.log(`📚 Saving progress: ${volumeChapterCount} chapters in current volume, ${totalChaptersRead} total chapters read`);

      const mutation = `
        mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus) {
          SaveMediaListEntry (mediaId: $mediaId, progress: $progress, status: $status) {
            id
            progress
            status
          }
        }
      `;

      const variables = {
        mediaId: parseInt(novelId || '0'),
        progress: totalChaptersRead,
        status: 'CURRENT'
      };

      const response = await fetch('https://graphql.anilist.co/api/v2/mutation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: mutation,
          variables: variables
        })
      });

      const data = await response.json();
      console.log('Anilist update response:', data);
      
      if (data.errors) {
        console.error('Anilist API errors:', data.errors);
      } else {
        // Save the new total count for future reference
        try {
          await AsyncStorage.setItem(lastProgressKey, totalChaptersRead.toString());
          console.log('📚 Saved new chapter count:', totalChaptersRead);
        } catch (error) {
          console.error('Error saving new chapter count:', error);
        }
      }
    } catch (error) {
      console.error('Error saving to Anilist:', error);
    }
  };

  const saveLocalProgress = async () => {
    try {
      const progressKey = `novel_progress_${novelId}_${volumeId}`;
      await AsyncStorage.setItem(progressKey, JSON.stringify({
        chapter: currentChapter,
        timestamp: new Date().toISOString()
      }));
      console.log('Saved local progress:', { chapter: currentChapter });
    } catch (error) {
      console.error('Error saving local progress:', error);
    }
  };

  // Load saved settings and bookmarks
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [
          savedFontSize,
          savedTheme,
          savedFont,
          savedLineHeight,
          savedTextAlign,
          savedParagraphSpacing,
          savedMarginSize,
          savedDontAskAgain,
          savedBookmarks
        ] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.FONT_SIZE),
          AsyncStorage.getItem(STORAGE_KEYS.THEME),
          AsyncStorage.getItem(STORAGE_KEYS.FONT),
          AsyncStorage.getItem(STORAGE_KEYS.LINE_HEIGHT),
          AsyncStorage.getItem(STORAGE_KEYS.TEXT_ALIGN),
          AsyncStorage.getItem(STORAGE_KEYS.PARAGRAPH_SPACING),
          AsyncStorage.getItem(STORAGE_KEYS.MARGIN_SIZE),
          AsyncStorage.getItem(STORAGE_KEYS.DONT_ASK_SAVE),
          AsyncStorage.getItem(`bookmarks_${novelId}_${volumeId}`)
        ]);

        if (savedFontSize) setFontSize(Number(savedFontSize));
        if (savedTheme) setTheme(savedTheme as Theme);
        if (savedFont) setFont(savedFont as FontKey);
        if (savedLineHeight) setLineHeight(Number(savedLineHeight));
        if (savedTextAlign) setTextAlign(savedTextAlign as 'left' | 'justify');
        if (savedParagraphSpacing) setParagraphSpacing(Number(savedParagraphSpacing));
        if (savedMarginSize) setMarginSize(savedMarginSize as 'compact' | 'normal' | 'wide');
        if (savedDontAskAgain) setDontAskAgain(savedDontAskAgain === 'true');
        if (savedBookmarks) {
          try {
            const parsedBookmarks = JSON.parse(savedBookmarks);
            setBookmarks(parsedBookmarks);
          } catch (err) {
            console.error('Error parsing saved bookmarks:', err);
          }
        }
      } catch (error) {
        console.error('Error loading reader settings:', error);
      }
    };

    loadSettings();
  }, [novelId, volumeId]);

  // Save settings when they change
  useEffect(() => {
    const saveSettings = async () => {
      try {
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.FONT_SIZE, fontSize.toString()),
          AsyncStorage.setItem(STORAGE_KEYS.THEME, theme),
          AsyncStorage.setItem(STORAGE_KEYS.FONT, font),
          AsyncStorage.setItem(STORAGE_KEYS.LINE_HEIGHT, lineHeight.toString()),
          AsyncStorage.setItem(STORAGE_KEYS.TEXT_ALIGN, textAlign),
          AsyncStorage.setItem(STORAGE_KEYS.PARAGRAPH_SPACING, paragraphSpacing.toString()),
          AsyncStorage.setItem(STORAGE_KEYS.MARGIN_SIZE, marginSize),
          AsyncStorage.setItem(STORAGE_KEYS.DONT_ASK_SAVE, dontAskAgain.toString())
        ]);
      } catch (error) {
        console.error('Error saving reader settings:', error);
      }
    };

    saveSettings();
  }, [fontSize, theme, font, lineHeight, textAlign, paragraphSpacing, marginSize, dontAskAgain]);

  // Save bookmarks when they change
  useEffect(() => {
    const saveBookmarks = async () => {
      try {
        await AsyncStorage.setItem(`bookmarks_${novelId}_${volumeId}`, JSON.stringify(bookmarks));
      } catch (error) {
        console.error('Error saving bookmarks:', error);
      }
    };

    if (novelId && volumeId) {
      saveBookmarks();
    }
  }, [bookmarks, novelId, volumeId]);

  // Add back handler
  useEffect(() => {
    const backHandler = () => {
      if (isIncognito) {
        saveLocalProgress();
        router.back();
        return true;
      }

      if (!dontAskAgain) {
        setShowSaveProgress(true);
        return true;
      } else {
        saveLocalProgress();
        router.back();
        return true;
      }
    };

    if (Platform.OS === 'android') {
      const subscription = BackHandler.addEventListener('hardwareBackPress', backHandler);
      return () => subscription.remove();
    }
  }, [dontAskAgain, isIncognito]);

  const handleSaveAndExit = async () => {
    await saveToAnilist();
    await saveLocalProgress();
    router.back();
  };

  const handleExitWithoutSaving = () => {
    router.back();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#02A9FF" />
        <Text style={[styles.loadingText, { color: colors.text }]}>{loadingMessage}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleBack}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        {/* Header */}
        <Animated.View 
          style={[
            styles.header,
            { 
              backgroundColor: colors.headerBg,
              borderBottomColor: colors.border,
              opacity: showUI ? 1 : 0,
              transform: [{ 
                translateY: showUI ? 0 : -100
              }]
            }
          ]}
          pointerEvents={showUI ? 'auto' : 'none'}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <FontAwesome5 name="arrow-left" size={20} color={colors.text} />
            </TouchableOpacity>
            
            <View style={styles.chapterSelector}>
              <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>
                {title || 'Untitled Novel'}
                {volumeTitle && (
                <Text style={[styles.headerVolume, { color: colors.secondary }]}>
                  {'\n'}{volumeTitle}
                </Text>
                )}
              </Text>
              {chapters.length > 0 && (
                <TouchableOpacity 
                  style={styles.chapterInfo}
                  onPress={() => {
                    console.log('Opening pages modal');
                    console.log('Number of chapters:', chapters.length);
                    console.log('Chapters:', chapters.map((chapter, index) => ({
                      index,
                      id: chapter.id,
                      title: chapter.title,
                      contentPreview: chapter.content.substring(0, 100)
                    })));
                    setShowChapterList(true);
                  }}
                >
                  <Text style={[styles.headerSubtitle, { color: colors.secondary }]}>
                    {chapters[currentChapter]?.title?.toLowerCase().includes('chapter') 
                      ? `${currentChapter + 1} of ${chapters.length}`
                      : `Chapter ${currentChapter + 1} of ${chapters.length}`
                    }
                  </Text>
                  <FontAwesome5 
                    name="chevron-down" 
                    size={12} 
                    color={colors.secondary}
                    style={styles.headerIcon}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Content */}
        <View style={styles.contentWrapper}>
          {chapters.length > 0 && chapters[currentChapter] && (
            <ChapterContent
              chapter={chapters[currentChapter]}
              colors={colors}
              fontSize={fontSize}
              lineHeight={lineHeight}
              currentFont={currentFont}
              paragraphSpacing={paragraphSpacing}
              textAlign={textAlign}
              isTitlePage={processChapterContent(chapters[currentChapter].content)?.isTitlePage}
              horizontalPadding={horizontalPadding}
              onScroll={handleScroll}
              imageMap={imageMap}
              onTap={handleSingleTap}
              onSwipe={(direction) => {
                if (direction === 'right' && currentChapter > 0) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCurrentChapter(prev => prev - 1);
                } else if (direction === 'left' && currentChapter < chapters.length - 1) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCurrentChapter(prev => prev + 1);
                }
              }}
            />
          )}
        </View>

        {/* Progress Bar */}
        <Animated.View 
          style={[
            styles.progressBar, 
            { 
              backgroundColor: `${colors.text}20`,
              opacity: showUI ? 1 : 0
            }
          ]}
          pointerEvents={showUI ? 'auto' : 'none'}
        >
          <Animated.View 
            style={[
              styles.progressFill, 
              { 
                backgroundColor: colors.tint,
                width: `${readingProgress * 100}%`,
                height: 6,  // Make it slightly thicker
                borderRadius: 3,
              }
            ]} 
          />
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View 
          style={[
            styles.quickActions,
            {
              opacity: showUI ? 1 : 0,
              transform: [{ translateY: showUI ? 0 : 100 }]
            }
          ]}
          pointerEvents={showUI ? 'auto' : 'none'}
        >
          {/* Add a background panel */}
          <View style={[styles.quickActionsBackground, {
            backgroundColor: colors.background,
            borderColor: colors.border,
            zIndex: -1 // Ensure background is below buttons
          }]} pointerEvents="none" />
          
          <TouchableOpacity
            style={[
              styles.quickActionButton, 
              { 
                backgroundColor: colors.tint,
                opacity: currentChapter > 0 ? 1 : 0 
              }
            ]}
            onPress={() => {
              if (currentChapter > 0) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setCurrentChapter(prev => prev - 1);
              }
            }}
          >
            <FontAwesome5 name="chevron-left" size={16} color="#FFFFFF" />
          </TouchableOpacity>

        

          <TouchableOpacity
            style={[
              styles.quickActionButton,
              { backgroundColor: colors.tint }
            ]}
            onPress={() => setShowSettings(true)}
          >
            <FontAwesome5 name="sliders-h" size={16} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.quickActionButton,
              { 
                backgroundColor: colors.tint,
                opacity: currentChapter < chapters.length - 1 ? 1 : 0.5 
              }
            ]}
            onPress={() => {
              if (currentChapter < chapters.length - 1) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setCurrentChapter(prev => prev + 1);
              }
            }}
          >
            <FontAwesome5 name="chevron-right" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>

        {/* Settings Modal */}
        <Modal
          visible={showSettings}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowSettings(false)}
        >
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
            <View style={[styles.settingsContainer, { backgroundColor: colors.background }]}>
              <View style={styles.settingsHeader}>
                <Text style={[styles.settingsTitle, { color: colors.text }]}>Reader Settings</Text>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setShowSettings(false)}
                >
                  <FontAwesome5 name="times" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Font Section */}
              <ScrollView style={styles.settingsContent}>
                <View style={styles.settingSection}>
                  <Text style={[styles.settingSectionTitle, { color: colors.text }]}>Font</Text>
                  <View style={styles.fontButtons}>
                    {Object.entries(FONTS).map(([key, value]) => (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.fontButton,
                          { 
                            backgroundColor: font === key ? colors.tint : `${colors.tint}10`,
                            borderColor: colors.border
                          }
                        ]}
                        onPress={() => {
                          setFont(key as FontKey);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <Text 
                          style={[
                            styles.fontButtonText, 
                            { 
                              color: font === key ? '#fff' : colors.text,
                              fontFamily: value.style
                            }
                          ]}
                        >
                          {value.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Font Size Section */}
                <View style={styles.settingSection}>
                  <Text style={[styles.settingSectionTitle, { color: colors.text }]}>Font Size</Text>
                  <View style={styles.sliderContainer}>
                    <TouchableOpacity 
                      style={[styles.sliderButton, { backgroundColor: `${colors.tint}10` }]}
                      onPress={() => handleFontSizeChange(-1)}
                    >
                      <FontAwesome5 name="minus" size={14} color={colors.tint} />
                    </TouchableOpacity>
                    <Text style={[styles.sliderValue, { color: colors.text }]}>{fontSize}px</Text>
                    <TouchableOpacity 
                      style={[styles.sliderButton, { backgroundColor: `${colors.tint}10` }]}
                      onPress={() => handleFontSizeChange(1)}
                    >
                      <FontAwesome5 name="plus" size={14} color={colors.tint} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Line Height Section */}
                <View style={styles.settingSection}>
                  <Text style={[styles.settingSectionTitle, { color: colors.text }]}>Line Height</Text>
                  <View style={styles.sliderContainer}>
                    <TouchableOpacity 
                      style={[styles.sliderButton, { backgroundColor: `${colors.tint}10` }]}
                      onPress={() => handleLineHeightChange(-0.1)}
                    >
                      <FontAwesome5 name="minus" size={14} color={colors.tint} />
                    </TouchableOpacity>
                    <Text style={[styles.sliderValue, { color: colors.text }]}>{lineHeight.toFixed(1)}</Text>
                    <TouchableOpacity 
                      style={[styles.sliderButton, { backgroundColor: `${colors.tint}10` }]}
                      onPress={() => handleLineHeightChange(0.1)}
                    >
                      <FontAwesome5 name="plus" size={14} color={colors.tint} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Text Align Section */}
                <View style={styles.settingSection}>
                  <Text style={[styles.settingSectionTitle, { color: colors.text }]}>Text Align</Text>
                  <View style={styles.radioButtons}>
                    {['left', 'justify'].map((align) => (
                      <TouchableOpacity
                        key={align}
                        style={[
                          styles.radioButton,
                          { 
                            backgroundColor: textAlign === align ? colors.tint : `${colors.tint}10`,
                            borderColor: colors.border
                          }
                        ]}
                        onPress={() => {
                          setTextAlign(align as 'left' | 'justify');
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <Text 
                          style={[
                            styles.radioButtonText, 
                            { 
                              color: textAlign === align ? '#fff' : colors.text,
                            }
                          ]}
                        >
                          {align.charAt(0).toUpperCase() + align.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Paragraph Spacing Section */}
                <View style={styles.settingSection}>
                  <Text style={[styles.settingSectionTitle, { color: colors.text }]}>Paragraph Spacing</Text>
                  <View style={styles.sliderContainer}>
                    <TouchableOpacity 
                      style={[styles.sliderButton, { backgroundColor: `${colors.tint}10` }]}
                      onPress={() => handleParagraphSpacingChange(-2)}
                    >
                      <FontAwesome5 name="minus" size={14} color={colors.tint} />
                    </TouchableOpacity>
                    <Text style={[styles.sliderValue, { color: colors.text }]}>{paragraphSpacing}px</Text>
                    <TouchableOpacity 
                      style={[styles.sliderButton, { backgroundColor: `${colors.tint}10` }]}
                      onPress={() => handleParagraphSpacingChange(2)}
                    >
                      <FontAwesome5 name="plus" size={14} color={colors.tint} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Margin Size Section */}
                <View style={styles.settingSection}>
                  <Text style={[styles.settingSectionTitle, { color: colors.text }]}>Margin Size</Text>
                  <View style={styles.radioButtons}>
                    {['compact', 'normal', 'wide'].map((size) => (
                      <TouchableOpacity
                        key={size}
                        style={[
                          styles.radioButton,
                          { 
                            backgroundColor: marginSize === size ? colors.tint : `${colors.tint}10`,
                            borderColor: colors.border
                          }
                        ]}
                        onPress={() => {
                          setMarginSize(size as 'compact' | 'normal' | 'wide');
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <Text 
                          style={[
                            styles.radioButtonText, 
                            { 
                              color: marginSize === size ? '#fff' : colors.text,
                            }
                          ]}
                        >
                          {size.charAt(0).toUpperCase() + size.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Theme Section in Settings */}
                <View style={styles.settingSection}>
                  <Text style={[styles.settingSectionTitle, { color: colors.text }]}>Theme</Text>
                  <View style={styles.radioButtons}>
                    {['light', 'dark', 'sepia', 'amoled', 'cream'].map((themeOption) => (
                      <TouchableOpacity
                        key={themeOption}
                        style={[
                          styles.radioButton,
                          { 
                            backgroundColor: theme === themeOption ? colors.tint : `${colors.tint}10`,
                            borderColor: colors.border
                          }
                        ]}
                        onPress={() => {
                          setTheme(themeOption as Theme);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <Text 
                          style={[
                            styles.radioButtonText, 
                            { 
                              color: theme === themeOption ? '#fff' : colors.text,
                            }
                          ]}
                        >
                          {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Chapter List Modal */}
        <Modal
          visible={showChapterList}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowChapterList(false)}
        >
          <View style={styles.chapterListModal}>
            <View style={styles.chapterListContainer}>
              <View style={[styles.chapterListContent, { backgroundColor: colors.background }]}>
                <View style={styles.chapterListHeader}>
                  <Text style={[styles.chapterListTitle, { color: colors.text }]}>
                    Chapters
                  </Text>
                  <TouchableOpacity 
                    onPress={() => setShowChapterList(false)}
                    style={styles.closeButton}
                  >
                    <FontAwesome5 name="times" size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                >
                  {chapters
                    .map((item, index) => ({ item, originalIndex: index }))
                    .filter(({ item }) => {
                      // Simple filter without re-processing content
                      const hasHTMLTitle = item.title.includes('DOCTYPE') || 
                                         item.title.includes('W3C//DTD') || 
                                         item.title.includes('XHTML') ||
                                         item.title.includes('<?xml');
                      
                      // Hide if it has HTML artifacts in title
                      return !hasHTMLTitle;
                    })
                    .map(({ item, originalIndex }) => {
                      const isBookmarked = bookmarks.some(b => b.chapter === originalIndex);
                      
                      return (
                        <View
                          key={`${item.id}-${originalIndex}`}
                          style={[
                            styles.chapterItem,
                            { backgroundColor: `${colors.tint}10` },
                            currentChapter === originalIndex && [
                              styles.currentChapter,
                              { borderColor: colors.tint }
                            ]
                          ]}
                        >
                          <TouchableOpacity
                            style={styles.chapterItemContent}
                            onPress={() => {
                              setCurrentChapter(originalIndex);
                              setShowChapterList(false);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                          >
                            <Text 
                              style={[
                                styles.chapterItemTitle,
                                { color: colors.text }
                              ]}
                              numberOfLines={2}
                            >
                              {item.title}
                            </Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            style={styles.bookmarkButton}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              if (isBookmarked) {
                                // Remove bookmark
                                setBookmarks(prev => prev.filter(b => b.chapter !== originalIndex));
                              } else {
                                // Add bookmark
                                setBookmarks(prev => [...prev, { chapter: originalIndex, scroll: 0 }]);
                              }
                            }}
                          >
                            <FontAwesome5 
                              name="bookmark" 
                              size={16} 
                              color={isBookmarked ? colors.tint : colors.secondary}
                              solid={isBookmarked}
                            />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                </ScrollView>
              </View>
            </View>
          </View>
        </Modal>

        {/* Bookmarks Modal */}
        <Modal
          visible={showBookmarksModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowBookmarksModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.settingsContainer}>
              <View style={styles.settingsHeader}>
                <Text style={[styles.settingsTitle, { color: colors.text }]}>Bookmarks</Text>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setShowBookmarksModal(false)}
                >
                  <FontAwesome5 name="times" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {bookmarks.map((item) => (
                  <TouchableOpacity
                    key={`${item.chapter}-${item.scroll}`}
                    style={[
                      styles.chapterItem,
                      { backgroundColor: `${colors.tint}10` }
                    ]}
                    onPress={() => {
                      setCurrentChapter(item.chapter);
                      setShowBookmarksModal(false);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text 
                      style={[
                        styles.chapterItemTitle,
                        { color: colors.text }
                      ]}
                      numberOfLines={2}
                    >
                      {chapters[item.chapter]?.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Save Progress Modal */}
        <Modal
          visible={showSaveProgress}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSaveProgress(false)}
        >
          <View style={styles.saveProgressModal}>
            <View style={[styles.saveProgressContainer, { backgroundColor: colors.background }]}>
              <Text style={[styles.saveProgressTitle, { color: colors.text }]}>
                Save Progress?
              </Text>
              <Text style={[styles.saveProgressMessage, { color: colors.text }]}>
                Would you like to save your reading progress to your AniList account? Your current progress will be saved as Chapter {currentChapter + 1}.
              </Text>

              <View style={styles.dontAskContainer}>
                <TouchableOpacity
                  style={[
                    styles.checkboxContainer,
                    { 
                      borderColor: colors.tint,
                      backgroundColor: dontAskAgain ? colors.tint : 'transparent'
                    }
                  ]}
                  onPress={() => setDontAskAgain(!dontAskAgain)}
                >
                  {dontAskAgain && (
                    <FontAwesome5 name="check" size={14} color="#fff" />
                  )}
                </TouchableOpacity>
                <Text style={[styles.dontAskText, { color: colors.text }]}>
                  Don't ask again
                </Text>
              </View>

              <View style={styles.saveProgressButtons}>
                <TouchableOpacity
                  style={[styles.saveProgressButton, { backgroundColor: `${colors.tint}20` }]}
                  onPress={() => {
                    setShowSaveProgress(false);
                    handleExitWithoutSaving();
                  }}
                >
                  <Text style={[styles.saveProgressButtonText, { color: colors.text }]}>
                    Exit
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveProgressButton, { backgroundColor: colors.tint }]}
                  onPress={() => {
                    setShowSaveProgress(false);
                    handleSaveAndExit();
                  }}
                >
                  <Text style={[styles.saveProgressButtonText, { color: '#fff' }]}>
                    Save & Exit
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}
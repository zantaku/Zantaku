/**
 * ChapterPagesContext - Store for chapter pages to avoid URL mutation through navigation params
 * 
 * This context stores chapter page URLs and headers in memory, preventing URL corruption
 * that occurs when passing URLs through navigation parameters.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { PageWithHeaders } from '../api/proxy/providers/manga/MangaProviderService';

interface ChapterPagesData {
  pages: PageWithHeaders[];
  chapterId: string;
  timestamp: number;
}

interface ChapterPagesContextType {
  setChapterPages: (chapterId: string, pages: PageWithHeaders[]) => void;
  getChapterPages: (chapterId: string) => PageWithHeaders[] | null;
  clearChapterPages: (chapterId: string) => void;
  clearAllPages: () => void;
}

const ChapterPagesContext = createContext<ChapterPagesContextType | undefined>(undefined);

export function ChapterPagesProvider({ children }: { children: React.ReactNode }) {
  // Store pages by chapter ID
  const [pagesStore, setPagesStore] = useState<Map<string, ChapterPagesData>>(new Map());

  const setChapterPages = useCallback((chapterId: string, pages: PageWithHeaders[]) => {
    console.log(`📦 [ChapterPagesStore] Storing ${pages.length} pages for chapter: ${chapterId}`);
    console.log(`📦 [ChapterPagesStore] First URL (unmodified):`, pages[0]?.url);
    
    setPagesStore(prev => {
      const newStore = new Map(prev);
      newStore.set(chapterId, {
        pages,
        chapterId,
        timestamp: Date.now()
      });
      
      // Clean up old entries (older than 5 minutes)
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      for (const [id, data] of newStore.entries()) {
        if (data.timestamp < fiveMinutesAgo) {
          console.log(`🧹 [ChapterPagesStore] Cleaning up old entry: ${id}`);
          newStore.delete(id);
        }
      }
      
      return newStore;
    });
  }, []);

  const getChapterPages = useCallback((chapterId: string): PageWithHeaders[] | null => {
    const data = pagesStore.get(chapterId);
    if (data) {
      console.log(`📖 [ChapterPagesStore] Retrieved ${data.pages.length} pages for chapter: ${chapterId}`);
      console.log(`📖 [ChapterPagesStore] First URL (unmodified):`, data.pages[0]?.url);
      return data.pages;
    }
    console.warn(`⚠️ [ChapterPagesStore] No pages found for chapter: ${chapterId}`);
    return null;
  }, [pagesStore]);

  const clearChapterPages = useCallback((chapterId: string) => {
    setPagesStore(prev => {
      const newStore = new Map(prev);
      newStore.delete(chapterId);
      console.log(`🗑️ [ChapterPagesStore] Cleared pages for chapter: ${chapterId}`);
      return newStore;
    });
  }, []);

  const clearAllPages = useCallback(() => {
    setPagesStore(new Map());
    console.log(`🗑️ [ChapterPagesStore] Cleared all stored pages`);
  }, []);

  return (
    <ChapterPagesContext.Provider
      value={{
        setChapterPages,
        getChapterPages,
        clearChapterPages,
        clearAllPages
      }}
    >
      {children}
    </ChapterPagesContext.Provider>
  );
}

export function useChapterPages() {
  const context = useContext(ChapterPagesContext);
  if (context === undefined) {
    throw new Error('useChapterPages must be used within a ChapterPagesProvider');
  }
  return context;
}


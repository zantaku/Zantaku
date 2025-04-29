import React, { createContext, useContext, useCallback, useEffect } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';

interface OrientationContextType {
  unlockOrientation: () => Promise<void>;
  lockPortrait: () => Promise<void>;
}

const OrientationContext = createContext<OrientationContextType | undefined>(undefined);

export function OrientationProvider({ children }: { children: React.ReactNode }) {
  const unlockOrientation = useCallback(async () => {
    try {
      await ScreenOrientation.unlockAsync();
    } catch (error) {
      console.error('Error unlocking orientation:', error);
    }
  }, []);

  const lockPortrait = useCallback(async () => {
    try {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP
      );
    } catch (error) {
      console.error('Error locking orientation:', error);
    }
  }, []);

  // Lock portrait orientation by default when the provider mounts
  useEffect(() => {
    lockPortrait();
  }, []);

  const value = React.useMemo(() => ({
    unlockOrientation,
    lockPortrait,
  }), [unlockOrientation, lockPortrait]);

  return (
    <OrientationContext.Provider value={value}>
      {children}
    </OrientationContext.Provider>
  );
}

export function useOrientation() {
  const context = useContext(OrientationContext);
  if (!context) {
    throw new Error('useOrientation must be used within an OrientationProvider');
  }
  return context;
} 
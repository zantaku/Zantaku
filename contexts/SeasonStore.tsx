import React, { createContext, useContext, useMemo, useState } from 'react';
import type { SeasonEntry } from '../hooks/useSeasons';

export type SeasonSelection = 'ALL' | SeasonEntry;

interface SeasonContextValue {
  selected: SeasonSelection;
  setSelected: (s: SeasonSelection) => void;
}

const SeasonContext = createContext<SeasonContextValue | undefined>(undefined);

export const SeasonProvider: React.FC<{ children: React.ReactNode; initial?: SeasonSelection }>
  = ({ children, initial = 'ALL' }) => {
  const [selected, setSelected] = useState<SeasonSelection>(initial);
  const value = useMemo(() => ({ selected, setSelected }), [selected]);
  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
};

export function useSeasonSelection(): SeasonContextValue {
  const ctx = useContext(SeasonContext);
  if (!ctx) throw new Error('useSeasonSelection must be used within SeasonProvider');
  return ctx;
}



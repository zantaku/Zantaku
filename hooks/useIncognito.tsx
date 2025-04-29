import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type IncognitoContextType = {
  isIncognito: boolean;
  toggleIncognito: () => void;
};

const IncognitoContext = createContext<IncognitoContextType | undefined>(undefined);

export function IncognitoProvider({ children }: { children: React.ReactNode }) {
  const [isIncognito, setIsIncognito] = useState(false);

  useEffect(() => {
    // Load saved incognito state
    AsyncStorage.getItem('incognito_mode').then(async value => {
      console.log('Loading saved incognito state:', value);
      if (value === null) {
        // Set default value to false if no value exists
        await AsyncStorage.setItem('incognito_mode', 'false');
        setIsIncognito(false);
      } else {
        setIsIncognito(value === 'true');
      }
    }).catch(error => {
      console.error('Error loading incognito state:', error);
      // Set to false on error as well
      setIsIncognito(false);
    });
  }, []);

  const toggleIncognito = async () => {
    try {
      console.log('Toggling incognito mode. Current state:', isIncognito);
      const newState = !isIncognito;
      console.log('New state will be:', newState);
      
      await AsyncStorage.setItem('incognito_mode', String(newState));
      console.log('Successfully saved new state to AsyncStorage');
      
      setIsIncognito(newState);
      console.log('State updated in component');
    } catch (error) {
      console.error('Error toggling incognito mode:', error);
    }
  };

  return (
    <IncognitoContext.Provider value={{ isIncognito, toggleIncognito }}>
      {children}
    </IncognitoContext.Provider>
  );
}

export function useIncognito() {
  const context = useContext(IncognitoContext);
  if (context === undefined) {
    throw new Error('useIncognito must be used within an IncognitoProvider');
  }
  return context;
} 
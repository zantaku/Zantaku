import { useState, useEffect } from 'react';
import ImageColors from 'react-native-image-colors';
import { Platform } from 'react-native';

type ImageColorsResponse = {
  platform: 'android';
  dominant: string;
  average: string;
  vibrant: string;
  darkVibrant: string;
  lightVibrant: string;
  darkMuted: string;
  lightMuted: string;
  muted: string;
} | {
  platform: 'ios';
  primary: string;
  secondary: string;
  background: string;
  detail: string;
};

export const useImageColors = (imageUrl: string) => {
  const [colors, setColors] = useState<ImageColorsResponse | null>(null);

  useEffect(() => {
    const fetchColors = async () => {
      if (!imageUrl) {
        setColors(null);
        return;
      }
      
      try {
        const result = await ImageColors.getColors(imageUrl, {
          fallback: '#000000',
          cache: true,
          key: imageUrl,
        });

        if (result) {
          setColors(result as ImageColorsResponse);
        }
      } catch (error) {
        console.error('Error fetching image colors:', error);
        // Provide fallback colors based on platform
        if (Platform.OS === 'ios') {
          setColors({
            platform: 'ios',
            primary: '#000000',
            secondary: '#000000',
            background: '#000000',
            detail: '#000000',
          });
        } else {
          setColors({
            platform: 'android',
            dominant: '#000000',
            average: '#000000',
            vibrant: '#000000',
            darkVibrant: '#000000',
            lightVibrant: '#000000',
            darkMuted: '#000000',
            lightMuted: '#000000',
            muted: '#000000',
          });
        }
      }
    };

    fetchColors();
  }, [imageUrl]);

  return { colors };
}; 
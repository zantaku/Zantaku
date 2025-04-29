import { Share } from 'react-native';

export const shareContent = async (title: string, url: string) => {
  try {
    await Share.share({
      message: `${title}\n${url}`,
      url,
    });
  } catch (error) {
    console.error('Error sharing content:', error);
  }
}; 
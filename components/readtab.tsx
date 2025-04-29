import React from 'react';
import { View, StyleSheet } from 'react-native';
import ChapterList from './chapterlist';
import NovelVolumeList from './NovelVolumeList';

interface ReadTabProps {
  chapters?: number;
  volumes?: number;
  mangaTitle: {
    english: string;
    userPreferred: string;
  };
  anilistId?: string;
  countryOfOrigin?: string;
  coverImage?: string;
  format?: string;
}

// Define the component function
const ReadTab = ({ 
  mangaTitle, 
  anilistId, 
  countryOfOrigin, 
  coverImage,
  format,
  chapters,
  volumes
}: ReadTabProps) => {
  return (
    <View style={styles.container}>
      {(format === 'LIGHT_NOVEL' || format === 'NOVEL') ? (
        <NovelVolumeList 
          mangaTitle={mangaTitle}
          anilistId={anilistId}
        />
      ) : (
        <ChapterList 
          mangaTitle={mangaTitle}
          anilistId={anilistId}
          countryOfOrigin={countryOfOrigin}
          coverImage={coverImage}
        />
      )}
    </View>
  );
};

// Export both as named and default
export { ReadTab };
export default ReadTab;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 100, // Add padding for the bottom tab bar
    backgroundColor: 'transparent' // Make sure container is transparent
  }
});

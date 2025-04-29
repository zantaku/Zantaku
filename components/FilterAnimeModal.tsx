import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';

interface FilterAnimeModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilters: (filters: AnimeFilters) => void;
  currentFilters: AnimeFilters;
}

export interface AnimeFilters {
  genres: string[];
  year: number[];
  season: string;
  format: string;
  status: string;
  episodes: number[];
  isAdult: boolean;
  minimumTagRank: number;
}

const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Horror',
  'Mahou Shoujo', 'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance',
  'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller',
];

const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
const FORMATS = ['TV', 'MOVIE', 'TV_SHORT', 'OVA', 'ONA', 'SPECIAL', 'MUSIC'];
const STATUS = ['FINISHED', 'RELEASING', 'NOT_YET_RELEASED', 'CANCELLED', 'HIATUS'];

const FilterAnimeModal: React.FC<FilterAnimeModalProps> = ({
  visible,
  onClose,
  onApplyFilters,
  currentFilters,
}) => {
  const [filters, setFilters] = useState<AnimeFilters>(currentFilters);

  const toggleGenre = (genre: string) => {
    setFilters((prev) => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter((g) => g !== genre)
        : [...prev.genres, genre],
    }));
  };

  const handleReset = () => {
    setFilters({
      genres: [],
      year: [1940, new Date().getFullYear()],
      season: '',
      format: '',
      status: '',
      episodes: [0, 150],
      isAdult: false,
      minimumTagRank: 0,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.contentContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Filters</Text>
            <TouchableOpacity onPress={onClose}>
              <FontAwesome5 name="times" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Scrollable Content */}
          <ScrollView style={styles.scrollContainer}>
            {/* Genres Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Genres</Text>
              <View style={styles.genreContainer}>
                {GENRES.map((genre) => (
                  <TouchableOpacity
                    key={genre}
                    style={[
                      styles.genreButton,
                      filters.genres.includes(genre) && styles.genreButtonActive,
                    ]}
                    onPress={() => toggleGenre(genre)}
                  >
                    <Text
                      style={[
                        styles.genreButtonText,
                        filters.genres.includes(genre) && styles.genreButtonTextActive,
                      ]}
                    >
                      {genre}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Year Range Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Year Range</Text>
              <Slider
                minimumValue={1940}
                maximumValue={new Date().getFullYear()}
                step={1}
                value={filters.year[0]}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, year: [value, prev.year[1]] }))
                }
              />
              <Text style={styles.sliderValue}>{`${filters.year[0]} - ${filters.year[1]}`}</Text>
              <Slider
                minimumValue={1940}
                maximumValue={new Date().getFullYear()}
                step={1}
                value={filters.year[1]}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, year: [prev.year[0], value] }))
                }
              />
            </View>

            {/* Season Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Season</Text>
              <View style={styles.buttonGroup}>
                {SEASONS.map((season) => (
                  <TouchableOpacity
                    key={season}
                    style={[
                      styles.button,
                      filters.season === season && styles.buttonActive,
                    ]}
                    onPress={() =>
                      setFilters((prev) => ({
                        ...prev,
                        season: prev.season === season ? '' : season,
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        filters.season === season && styles.buttonTextActive,
                      ]}
                    >
                      {season}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Format Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Format</Text>
              <View style={styles.buttonGroup}>
                {FORMATS.map((format) => (
                  <TouchableOpacity
                    key={format}
                    style={[
                      styles.button,
                      filters.format === format && styles.buttonActive,
                    ]}
                    onPress={() =>
                      setFilters((prev) => ({
                        ...prev,
                        format: prev.format === format ? '' : format,
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        filters.format === format && styles.buttonTextActive,
                      ]}
                    >
                      {format}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Episodes Range Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Episodes</Text>
              <Slider
                minimumValue={0}
                maximumValue={150}
                step={1}
                value={filters.episodes[0]}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, episodes: [value, prev.episodes[1]] }))
                }
              />
              <Text style={styles.sliderValue}>
                {`${filters.episodes[0]} - ${filters.episodes[1]} episodes`}
              </Text>
              <Slider
                minimumValue={0}
                maximumValue={150}
                step={1}
                value={filters.episodes[1]}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, episodes: [prev.episodes[0], value] }))
                }
              />
            </View>

            {/* Adult Content Toggle */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Show Adult Content</Text>
              <Switch
                value={filters.isAdult}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, isAdult: value }))
                }
              />
            </View>

            {/* Minimum Tag Rank */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Minimum Tag Rank ({filters.minimumTagRank}%)
              </Text>
              <Slider
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={filters.minimumTagRank}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, minimumTagRank: value }))
                }
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => {
                onApplyFilters(filters);
                onClose();
              }}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  contentContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  scrollContainer: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  genreContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  genreButton: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    margin: 4,
  },
  genreButtonActive: {
    backgroundColor: '#02A9FF',
  },
  genreButtonText: {
    fontSize: 14,
    color: '#666',
  },
  genreButtonTextActive: {
    color: '#fff',
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  button: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    margin: 4,
  },
  buttonActive: {
    backgroundColor: '#02A9FF',
  },
  buttonText: {
    fontSize: 14,
    color: '#666',
  },
  buttonTextActive: {
    color: '#fff',
  },
  sliderValue: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    marginVertical: 8,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  resetButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  resetButtonText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 2,
    backgroundColor: '#02A9FF',
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  applyButtonText: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FilterAnimeModal;

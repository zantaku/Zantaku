import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, Platform, StyleSheet, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { shareContent } from '../../utils/share';
import { useAuth } from '../../hooks/useAuth';
import axios from 'axios';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

interface CharacterDetails {
  id: number;
  name: {
    userPreferred: string;
    native: string;
    alternative: string[];
    alternativeSpoiler: string[];
  };
  image: {
    large: string;
  };
  description: string | null;
  gender?: string;
  dateOfBirth?: {
    year?: number;
    month?: number;
    day?: number;
  };
  age?: string;
  bloodType?: string;
  siteUrl: string;
  favourites: number;
  modNotes?: string;
  media: {
    edges: Array<{
      id: number;
      characterRole: string;
      node: {
        id: number;
        type: string;
        title: {
          userPreferred: string;
        };
        coverImage: {
          medium: string;
        };
      };
      voiceActors: Array<{
        id: number;
        name: {
          userPreferred: string;
        };
        image: {
          medium: string;
        };
        languageV2: string;
        siteUrl: string;
      }>;
    }>;
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  headerGradient: {
    position: 'absolute',
    height: 300,
    left: 0,
    right: 0,
    top: 0,
  },
  header: {
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    marginBottom: 20,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 16,
    zIndex: 10,
  },
  shareButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 16,
    zIndex: 10,
  },
  blurButton: {
    borderRadius: 24,
    padding: 12,
    overflow: 'hidden',
  },
  coverImage: {
    width: 180,
    height: 270,
    borderRadius: 16,
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
    elevation: 16,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    marginTop: -20,
  },
  nameContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  fullName: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  nativeName: {
    fontSize: 16,
    marginTop: 4,
    textAlign: 'center',
    opacity: 0.8,
  },
  favoriteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  favoriteCount: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  infoSection: {
    marginBottom: 24,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  infoItem: {
    flex: 1,
    minWidth: 140,
    padding: 16,
    borderRadius: 12,
  },
  infoLabel: {
    fontSize: 13,
    marginBottom: 6,
    opacity: 0.7,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginTop: 24,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  descriptionContainer: {
    padding: 16,
    borderRadius: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
  },
  readMore: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  alternativeNames: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  altName: {
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  spoilerContainer: {
    overflow: 'hidden',
    borderRadius: 20,
  },
  blur: {
    padding: 8,
  },
  horizontalScrollContent: {
    paddingBottom: 16,
  },
  mediaCard: {
    width: 140,
    marginRight: 16,
    borderRadius: 12,
    overflow: 'hidden',
    padding: 8,
  },
  mediaCover: {
    width: 124,
    height: 180,
    borderRadius: 8,
  },
  mediaTitle: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 4,
    fontWeight: '600',
  },
  roleTag: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  pickerContainer: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    height: 50,
  },
  voiceActorCard: {
    width: 120,
    marginRight: 16,
    borderRadius: 12,
    overflow: 'hidden',
    padding: 8,
  },
  voiceActorImage: {
    width: 104,
    height: 160,
    borderRadius: 8,
  },
  voiceActorName: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  languageTag: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  returnButton: {
    backgroundColor: '#02A9FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  returnButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  headerButton: {
    padding: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

const CharacterDetailsScreen = () => {
  const { id } = useLocalSearchParams();
  const { isDarkMode, currentTheme } = useTheme();
  const { user } = useAuth();
  
  const [details, setDetails] = useState<CharacterDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDescription, setExpandedDescription] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<number[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const query = `
          query ($id: Int) {
            Character(id: $id) {
              id
              name {
                userPreferred
                native
                alternative
                alternativeSpoiler
              }
              image {
                large
              }
              description(asHtml: false)
              gender
              dateOfBirth {
                year
                month
                day
              }
              age
              bloodType
              siteUrl
              favourites
              modNotes
              media(sort: POPULARITY_DESC) {
                edges {
                  id
                  characterRole
                  node {
                    id
                    type
                    title {
                      userPreferred
                    }
                    coverImage {
                      medium
                    }
                  }
                  voiceActors(sort: RELEVANCE) {
                    id
                    name {
                      userPreferred
                    }
                    image {
                      medium
                    }
                    languageV2
                    siteUrl
                  }
                }
              }
            }
          }
        `;

        const response = await axios.post('https://graphql.anilist.co', {
          query,
          variables: { id: parseInt(id as string) }
        });

        if (response.data.errors) {
          throw new Error(response.data.errors[0].message);
        }

        setDetails(response.data.data.Character);
        setLoading(false);
        setIsLiked(response.data.data.Character.favourites > 0);
      } catch (error) {
        console.error('Error fetching character details:', error);
        setLoading(false);
      }
    };

    fetchDetails();

    // Listen for share event from header
    const shareSubscription = DeviceEventEmitter.addListener('shareCharacter', handleShare);
    
    return () => {
      shareSubscription.remove();
    };
  }, [id]);

  const handleShare = () => {
    if (details) {
      shareContent(details.name.userPreferred, `https://anilist.co/character/${details.id}`);
    }
  };

  const handleLikePress = () => {
    // Implement the logic to like the character
  };

  const toggleSpoiler = (index: number) => {
    if (revealedSpoilers.includes(index)) {
      setRevealedSpoilers(revealedSpoilers.filter(i => i !== index));
    } else {
      setRevealedSpoilers([...revealedSpoilers, index]);
    }
  };

  const formatDate = (date?: { year?: number; month?: number; day?: number }) => {
    if (!date) return null;
    const parts = [];
    if (date.month) parts.push(new Date(0, date.month - 1).toLocaleString('default', { month: 'long' }));
    if (date.day) parts.push(date.day);
    if (date.year) parts.push(date.year);
    return parts.join(' ');
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.colors.background }]}>
        <ActivityIndicator size="large" color="#02A9FF" />
        <Text style={[styles.loadingText, { color: currentTheme.colors.textSecondary }]}>Loading character details...</Text>
      </View>
    );
  }

  if (!details) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: currentTheme.colors.background }]}>
        <FontAwesome5 name="exclamation-circle" size={48} color="#02A9FF" />
        <Text style={[styles.errorText, { color: currentTheme.colors.text }]}>Could not load character details</Text>
        <TouchableOpacity 
          style={styles.returnButton}
          onPress={() => router.back()}
        >
          <Text style={styles.returnButtonText}>Return to previous page</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const languages = [...new Set(details.media.edges.flatMap(edge => 
    edge.voiceActors.map(actor => actor.languageV2)
  ))].filter(Boolean);

  const filteredRoles = selectedLanguage
    ? details.media.edges.map(edge => ({
        ...edge,
        voiceActors: edge.voiceActors.filter(actor => actor.languageV2 === selectedLanguage)
      }))
    : details.media.edges;

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: details?.name?.userPreferred || '',
          headerLeft: () => (
            <TouchableOpacity 
              style={[styles.headerButton, { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }]}
              onPress={() => router.back()}
            >
              <FontAwesome5 
                name="chevron-left" 
                size={20} 
                color="white" 
              />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleShare}
              >
                <FontAwesome5 name="share-alt" size={20} color={currentTheme.colors.text} />
              </TouchableOpacity>
              {user && !user.isAnonymous && (
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={handleLikePress}
                >
                  <FontAwesome5 
                    name="heart" 
                    solid={isLiked}
                    size={20} 
                    color={isLiked ? '#FF2E51' : currentTheme.colors.text} 
                  />
                </TouchableOpacity>
              )}
            </View>
          ),
        }}
      />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View>
          <LinearGradient
            colors={isDarkMode ? 
              ['rgba(2, 169, 255, 0.8)', 'rgba(0, 0, 0, 0.9)'] : 
              ['rgba(2, 169, 255, 0.7)', 'rgba(255, 255, 255, 0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.headerGradient}
          />
          
          <View style={styles.header}>
            <ExpoImage
              source={{ uri: details?.image?.large }}
              style={styles.coverImage}
              contentFit="cover"
              transition={500}
            />
          </View>
        </View>
        
        <View style={styles.contentContainer}>
          <View style={styles.nameContainer}>
            <Text style={[styles.fullName, { color: currentTheme.colors.text }]}>
              {details.name.userPreferred}
            </Text>
            {details.name.native && (
              <Text style={[styles.nativeName, { color: currentTheme.colors.textSecondary }]}>
                {details.name.native}
              </Text>
            )}
            <View style={styles.favoriteContainer}>
              <FontAwesome5 name="heart" size={16} color="#FF6B6B" solid />
              <Text style={[styles.favoriteCount, { color: currentTheme.colors.textSecondary }]}>
                {details.favourites.toLocaleString()} favorites
              </Text>
            </View>
          </View>
          
          {/* Bio & Info Section */}
          <View style={styles.infoSection}>
            <View style={styles.infoGrid}>
              {details.gender && (
                <View style={[styles.infoItem, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(2, 169, 255, 0.08)' }]}>
                  <Text style={[styles.infoLabel, { color: currentTheme.colors.textSecondary }]}>Gender</Text>
                  <Text style={[styles.infoValue, { color: currentTheme.colors.text }]}>{details.gender}</Text>
                </View>
              )}
              
              {details.dateOfBirth && (details.dateOfBirth.month || details.dateOfBirth.day) && (
                <View style={[styles.infoItem, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(2, 169, 255, 0.08)' }]}>
                  <Text style={[styles.infoLabel, { color: currentTheme.colors.textSecondary }]}>Birthday</Text>
                  <Text style={[styles.infoValue, { color: currentTheme.colors.text }]}>{formatDate(details.dateOfBirth)}</Text>
                </View>
              )}
              
              {details.age && (
                <View style={[styles.infoItem, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(2, 169, 255, 0.08)' }]}>
                  <Text style={[styles.infoLabel, { color: currentTheme.colors.textSecondary }]}>Age</Text>
                  <Text style={[styles.infoValue, { color: currentTheme.colors.text }]}>{details.age}</Text>
                </View>
              )}
              
              {details.bloodType && (
                <View style={[styles.infoItem, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(2, 169, 255, 0.08)' }]}>
                  <Text style={[styles.infoLabel, { color: currentTheme.colors.textSecondary }]}>Blood Type</Text>
                  <Text style={[styles.infoValue, { color: currentTheme.colors.text }]}>{details.bloodType}</Text>
                </View>
              )}
            </View>
          </View>
          
          {/* Description Section */}
          {details.description && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>About</Text>
              <View style={[styles.descriptionContainer, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(2, 169, 255, 0.05)' }]}>
                <Text 
                  style={[styles.description, { color: currentTheme.colors.text }]}
                  numberOfLines={expandedDescription ? undefined : 5}
                >
                  {details.description?.replace(/<[^>]*>?/gm, '') || ''}
                </Text>
                {details.description && details.description.length > 200 && (
                  <TouchableOpacity onPress={() => setExpandedDescription(!expandedDescription)}>
                    <Text style={[styles.readMore, { color: "#02A9FF" }]}>
                      {expandedDescription ? 'Show Less' : 'Read More'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          
          {/* Alternative Names Section */}
          {details.name.alternative?.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Alternative Names</Text>
              <View style={styles.alternativeNames}>
                {details.name.alternative.map((name, index) => (
                  <Text 
                    key={index} 
                    style={[
                      styles.altName, 
                      { 
                        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(2, 169, 255, 0.08)',
                        color: currentTheme.colors.text
                      }
                    ]}
                  >
                    {name}
                  </Text>
                ))}
              </View>
            </View>
          )}
          
          {/* Spoiler Names Section */}
          {details.name.alternativeSpoiler?.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Spoiler Names</Text>
              <View style={styles.alternativeNames}>
                {details.name.alternativeSpoiler.map((name, index) => (
                  <Pressable
                    key={index}
                    onPress={() => toggleSpoiler(index)}
                    style={styles.spoilerContainer}
                  >
                    {revealedSpoilers.includes(index) ? (
                      <Text 
                        style={[
                          styles.altName, 
                          { 
                            backgroundColor: isDarkMode ? 'rgba(255, 0, 0, 0.1)' : 'rgba(255, 0, 0, 0.08)',
                            color: currentTheme.colors.text
                          }
                        ]}
                      >
                        {name}
                      </Text>
                    ) : (
                      <BlurView intensity={20} tint={isDarkMode ? "dark" : "light"} style={styles.blur}>
                        <Text style={[styles.altName, { color: 'transparent' }]}>SPOILER</Text>
                      </BlurView>
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          
          {/* Appearances Section */}
          {details.media.edges.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Appearances</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {details.media.edges.map((media, index) => (
                  <TouchableOpacity 
                    key={index}
                    style={[
                      styles.mediaCard, 
                      { 
                        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(2, 169, 255, 0.05)',
                      }
                    ]}
                    onPress={() => router.push(`/anime/${media.node.id}`)}
                    activeOpacity={0.7}
                  >
                    <ExpoImage
                      source={{ uri: media.node.coverImage.medium }}
                      style={styles.mediaCover}
                      contentFit="cover"
                      transition={500}
                    />
                    <Text 
                      style={[styles.mediaTitle, { color: currentTheme.colors.text }]} 
                      numberOfLines={2}
                    >
                      {media.node.title.userPreferred}
                    </Text>
                    <Text 
                      style={[
                        styles.roleTag, 
                        { 
                          color: media.characterRole === 'MAIN' ? '#02A9FF' : 
                                 media.characterRole === 'SUPPORTING' ? '#4CAF50' : currentTheme.colors.textSecondary 
                        }
                      ]}
                    >
                      {media.characterRole.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          
          {/* Voice Actors Section */}
          {details.media.edges.some(edge => edge.voiceActors?.length > 0) && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Voice Actors</Text>
              
              {languages.length > 0 && (
                <View style={[styles.pickerContainer, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(2, 169, 255, 0.08)' }]}>
                  <Picker
                    selectedValue={selectedLanguage}
                    onValueChange={(itemValue) => setSelectedLanguage(itemValue)}
                    style={[styles.picker, { color: currentTheme.colors.text }]}
                    dropdownIconColor={currentTheme.colors.text}
                  >
                    <Picker.Item label="All Languages" value="" />
                    {languages.map((language, index) => (
                      <Picker.Item key={index} label={language} value={language} />
                    ))}
                  </Picker>
                </View>
              )}
              
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {filteredRoles.flatMap((media, mediaIndex) => 
                  media.voiceActors.map((actor, actorIndex) => (
                    <TouchableOpacity 
                      key={`${mediaIndex}-${actorIndex}`}
                      style={[
                        styles.voiceActorCard, 
                        { 
                          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(2, 169, 255, 0.05)',
                        }
                      ]}
                      onPress={() => router.push(`/staff/${actor.id}`)}
                      activeOpacity={0.7}
                    >
                      <ExpoImage
                        source={{ uri: actor.image.medium }}
                        style={styles.voiceActorImage}
                        contentFit="cover"
                        transition={500}
                      />
                      <Text style={[styles.voiceActorName, { color: currentTheme.colors.text }]} numberOfLines={2}>
                        {actor.name.userPreferred}
                      </Text>
                      <Text style={[styles.languageTag, { color: "#02A9FF" }]}>
                        {actor.languageV2}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default CharacterDetailsScreen; 
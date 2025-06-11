import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, StyleSheet, ActivityIndicator, Linking, DeviceEventEmitter } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { shareContent } from '../../utils/share';
import { useAuth } from '../../hooks/useAuth';
import { FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

interface StaffDetails {
  id: number;
  name: {
    userPreferred: string;
    native: string;
    alternative: string[];
  };
  image: {
    large: string;
  };
  description: string | null;
  primaryOccupations: string[];
  gender: string;
  dateOfBirth: {
    year: number;
    month: number;
    day: number;
  };
  dateOfDeath: {
    year: number;
    month: number;
    day: number;
  } | null;
  age: number;
  yearsActive: number[];
  homeTown: string;
  bloodType: string;
  language: string;
  favourites: number;
  siteUrl: string;
  twitterUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  websiteUrl?: string;
  staffMedia: {
    edges: Array<{
      node: {
        id: number;
        type: string;
        title: {
          userPreferred: string;
        };
        coverImage: {
          large: string;
        };
        startDate: {
          year: number;
        };
        format: string;
      };
      staffRole: string;
    }>;
  };
  characters: {
    edges: Array<{
      node: {
        id: number;
        name: {
          userPreferred: string;
        };
        image: {
          large: string;
        };
        media: {
          nodes: Array<{
            id: number;
            title: {
              userPreferred: string;
            };
          }>;
        };
      };
      role: string;
    }>;
  };
}

const StaffDetailsScreen = () => {
  const { id } = useLocalSearchParams();
  const { isDarkMode, currentTheme } = useTheme();
  const { user } = useAuth();
  const [staffDetails, setStaffDetails] = useState<StaffDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDescription, setExpandedDescription] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    fetchDetails();
    
    // Listen for share event from header
    const shareSubscription = DeviceEventEmitter.addListener('shareStaff', handleShare);
    
    return () => {
      shareSubscription.remove();
    };
  }, [id]);

  const fetchDetails = async () => {
    try {
      const { data } = await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query: `
            query ($id: Int) {
              Staff(id: $id) {
                id
                name {
                  userPreferred
                  native
                  alternative
                }
                image {
                  large
                }
                description(asHtml: false)
                primaryOccupations
                gender
                dateOfBirth {
                  year
                  month
                  day
                }
                dateOfDeath {
                  year
                  month
                  day
                }
                age
                yearsActive
                homeTown
                bloodType
                languageV2
                favourites
                isFavourite
                siteUrl
                staffMedia(page: 1, perPage: 25, sort: [START_DATE_DESC]) {
                  edges {
                    node {
                      id
                      type
                      title {
                        userPreferred
                      }
                      coverImage {
                        large
                      }
                      startDate {
                        year
                      }
                      format
                    }
                    staffRole
                  }
                }
                characters(page: 1, perPage: 25, sort: [FAVOURITES_DESC]) {
                  edges {
                    node {
                      id
                      name {
                        userPreferred
                      }
                      image {
                        large
                      }
                      media(sort: [POPULARITY_DESC]) {
                        nodes {
                          id
                          title {
                            userPreferred
                          }
                        }
                      }
                    }
                    role
                  }
                }
              }
            }
          `,
          variables: {
            id: parseInt(id as string),
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
        }
      );

      if (!data?.data?.Staff) {
        throw new Error('Staff data not found');
      }

      setStaffDetails(data.data.Staff);
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching staff details:', error?.response?.data || error);
      setLoading(false);
      setStaffDetails(null);
    }
  };

  const handleShare = async () => {
    if (staffDetails) {
      try {
        await shareContent(staffDetails.name.userPreferred, staffDetails.siteUrl);
      } catch (error) {
        console.error('Error sharing:', error);
      }
    }
  };

  const formatBirthday = (dateOfBirth: { year?: number; month?: number; day?: number }) => {
    if (!dateOfBirth) return null;
    
    const month = dateOfBirth.month ? String(dateOfBirth.month).padStart(2, '0') : null;
    const day = dateOfBirth.day ? String(dateOfBirth.day).padStart(2, '0') : null;
    const year = dateOfBirth.year;

    if (month && day && year) {
      return `${month}/${day}/${year}`;
    } else if (month && day) {
      return `${month}/${day}`;
    } else if (year) {
      return `${year}`;
    }
    return null;
  };

  const handleSocialLink = (url?: string) => {
    if (url) {
      Linking.openURL(url);
    }
  };

  const handleLikePress = () => {
    // Implement the logic to like the staff member
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.colors.background }]}>
        <ActivityIndicator size="large" color="#02A9FF" />
        <Text style={[styles.loadingText, { color: currentTheme.colors.textSecondary }]}>Loading staff details...</Text>
      </View>
    );
  }

  if (!staffDetails) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: currentTheme.colors.background }]}>
        <FontAwesome5 name="exclamation-circle" size={48} color="#02A9FF" />
        <Text style={[styles.errorText, { color: currentTheme.colors.text }]}>Could not load staff details</Text>
        <TouchableOpacity 
          style={styles.returnButton}
          onPress={() => router.back()}
        >
          <Text style={styles.returnButtonText}>Return to previous page</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const calculateAge = () => {
    if (!staffDetails.dateOfBirth?.year) return null;
    
    const birthYear = staffDetails.dateOfBirth.year;
    const deathYear = staffDetails.dateOfDeath?.year;
    
    if (deathYear) {
      return `${deathYear - birthYear} years (${birthYear}-${deathYear})`;
    }
    
    const currentYear = new Date().getFullYear();
    return `${currentYear - birthYear} years`;
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: staffDetails?.name?.userPreferred || '',
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
              source={{ uri: staffDetails?.image?.large }}
              style={styles.profileImage}
              contentFit="cover"
              transition={500}
            />
          </View>
        </View>
        
        <View style={styles.contentContainer}>
          <View style={styles.nameContainer}>
            <Text style={[styles.fullName, { color: currentTheme.colors.text }]}>
              {staffDetails.name.userPreferred}
            </Text>
            {staffDetails.name.native && (
              <Text style={[styles.nativeName, { color: currentTheme.colors.textSecondary }]}>
                {staffDetails.name.native}
              </Text>
            )}
            <View style={styles.favoriteContainer}>
              <FontAwesome5 name="heart" size={16} color="#FF6B6B" solid />
              <Text style={[styles.favoriteCount, { color: currentTheme.colors.textSecondary }]}>
                {staffDetails.favourites.toLocaleString()} favorites
              </Text>
            </View>

            {/* Social Links */}
            {(staffDetails.twitterUrl || staffDetails.instagramUrl || staffDetails.youtubeUrl || staffDetails.websiteUrl) && (
              <View style={styles.socialLinksContainer}>
                {staffDetails.twitterUrl && (
                  <TouchableOpacity 
                    style={[styles.socialButton, { backgroundColor: '#1DA1F2' }]}
                    onPress={() => handleSocialLink(staffDetails.twitterUrl)}
                  >
                    <FontAwesome5 name="twitter" size={16} color="#fff" />
                  </TouchableOpacity>
                )}
                
                {staffDetails.instagramUrl && (
                  <TouchableOpacity 
                    style={[styles.socialButton, { backgroundColor: '#E1306C' }]}
                    onPress={() => handleSocialLink(staffDetails.instagramUrl)}
                  >
                    <FontAwesome5 name="instagram" size={16} color="#fff" />
                  </TouchableOpacity>
                )}
                
                {staffDetails.youtubeUrl && (
                  <TouchableOpacity 
                    style={[styles.socialButton, { backgroundColor: '#FF0000' }]}
                    onPress={() => handleSocialLink(staffDetails.youtubeUrl)}
                  >
                    <FontAwesome5 name="youtube" size={16} color="#fff" />
                  </TouchableOpacity>
                )}
                
                {staffDetails.websiteUrl && (
                  <TouchableOpacity 
                    style={[styles.socialButton, { backgroundColor: '#757575' }]}
                    onPress={() => handleSocialLink(staffDetails.websiteUrl)}
                  >
                    <FontAwesome5 name="globe" size={16} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
          
          {/* Bio & Info Section */}
          <View style={styles.infoSection}>
            <View style={styles.infoGrid}>
              {staffDetails.primaryOccupations && staffDetails.primaryOccupations.length > 0 && (
                <View style={[styles.infoItem, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(2, 169, 255, 0.08)' }]}>
                  <Text style={[styles.infoLabel, { color: currentTheme.colors.textSecondary }]}>Occupation</Text>
                  <Text style={[styles.infoValue, { color: currentTheme.colors.text }]}>
                    {staffDetails.primaryOccupations.join(', ')}
                  </Text>
                </View>
              )}
              
              {formatBirthday(staffDetails.dateOfBirth) && (
                <View style={[styles.infoItem, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(2, 169, 255, 0.08)' }]}>
                  <Text style={[styles.infoLabel, { color: currentTheme.colors.textSecondary }]}>Birthday</Text>
                  <Text style={[styles.infoValue, { color: currentTheme.colors.text }]}>
                    {formatBirthday(staffDetails.dateOfBirth)}
                  </Text>
                </View>
              )}
              
              {calculateAge() && (
                <View style={[styles.infoItem, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(2, 169, 255, 0.08)' }]}>
                  <Text style={[styles.infoLabel, { color: currentTheme.colors.textSecondary }]}>Age</Text>
                  <Text style={[styles.infoValue, { color: currentTheme.colors.text }]}>{calculateAge()}</Text>
                </View>
              )}
              
              {staffDetails.gender && (
                <View style={[styles.infoItem, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(2, 169, 255, 0.08)' }]}>
                  <Text style={[styles.infoLabel, { color: currentTheme.colors.textSecondary }]}>Gender</Text>
                  <Text style={[styles.infoValue, { color: currentTheme.colors.text }]}>{staffDetails.gender}</Text>
                </View>
              )}
              
              {staffDetails.yearsActive && staffDetails.yearsActive.length > 0 && (
                <View style={[styles.infoItem, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(2, 169, 255, 0.08)' }]}>
                  <Text style={[styles.infoLabel, { color: currentTheme.colors.textSecondary }]}>Years Active</Text>
                  <Text style={[styles.infoValue, { color: currentTheme.colors.text }]}>
                    {staffDetails.yearsActive.length === 2 
                      ? `${staffDetails.yearsActive[0]} - ${staffDetails.yearsActive[1] || 'Present'}` 
                      : staffDetails.yearsActive.join(', ')}
                  </Text>
                </View>
              )}
              
              {staffDetails.homeTown && (
                <View style={[styles.infoItem, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(2, 169, 255, 0.08)' }]}>
                  <Text style={[styles.infoLabel, { color: currentTheme.colors.textSecondary }]}>Hometown</Text>
                  <Text style={[styles.infoValue, { color: currentTheme.colors.text }]}>{staffDetails.homeTown}</Text>
                </View>
              )}
              
              {staffDetails.bloodType && (
                <View style={[styles.infoItem, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(2, 169, 255, 0.08)' }]}>
                  <Text style={[styles.infoLabel, { color: currentTheme.colors.textSecondary }]}>Blood Type</Text>
                  <Text style={[styles.infoValue, { color: currentTheme.colors.text }]}>{staffDetails.bloodType}</Text>
                </View>
              )}
              
              {staffDetails.language && (
                <View style={[styles.infoItem, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(2, 169, 255, 0.08)' }]}>
                  <Text style={[styles.infoLabel, { color: currentTheme.colors.textSecondary }]}>Language</Text>
                  <Text style={[styles.infoValue, { color: currentTheme.colors.text }]}>{staffDetails.language}</Text>
                </View>
              )}
            </View>
          </View>
          
          {/* Description Section */}
          {staffDetails.description && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>About</Text>
              <View style={[styles.descriptionContainer, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(2, 169, 255, 0.05)' }]}>
                <Text 
                  style={[styles.description, { color: currentTheme.colors.text }]}
                  numberOfLines={expandedDescription ? undefined : 5}
                >
                  {staffDetails.description?.replace(/<[^>]*>?/gm, '') || ''}
                </Text>
                {staffDetails.description && staffDetails.description.length > 200 && (
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
          {staffDetails.name.alternative && staffDetails.name.alternative.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Alternative Names</Text>
              <View style={styles.alternativeNames}>
                {staffDetails.name.alternative.map((name, index) => (
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
          
          {/* Staff Media Section */}
          {staffDetails.staffMedia.edges.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Works</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {staffDetails.staffMedia.edges.map((media, index) => (
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
                      source={{ uri: media.node.coverImage.large }}
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
                    <View style={styles.mediaMetaContainer}>
                      <Text style={styles.mediaYear}>
                        {media.node.startDate?.year || 'TBA'}
                      </Text>
                      <Text style={styles.mediaFormat}>
                        {media.node.format || 'Unknown'}
                      </Text>
                    </View>
                    <Text 
                      style={[styles.roleTag, { color: "#02A9FF" }]}
                    >
                      {media.staffRole}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          
          {/* Characters Section */}
          {staffDetails.characters.edges.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Characters</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {staffDetails.characters.edges.map((character, index) => (
                  <TouchableOpacity 
                    key={index}
                    style={[
                      styles.characterCard, 
                      { 
                        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(2, 169, 255, 0.05)',
                      }
                    ]}
                    onPress={() => router.push(`/character/${character.node.id}`)}
                    activeOpacity={0.7}
                  >
                    <ExpoImage
                      source={{ uri: character.node.image.large }}
                      style={styles.characterImage}
                      contentFit="cover"
                      transition={500}
                    />
                    <Text 
                      style={[styles.characterName, { color: currentTheme.colors.text }]} 
                      numberOfLines={2}
                    >
                      {character.node.name.userPreferred}
                    </Text>
                    <Text style={[styles.roleTag, { color: "#02A9FF" }]}>
                      {character.role}
                    </Text>
                    {character.node.media.nodes.length > 0 && (
                      <Text 
                        style={[styles.mediaReference, { color: currentTheme.colors.textSecondary }]} 
                        numberOfLines={1}
                      >
                        {character.node.media.nodes[0].title.userPreferred}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

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
  profileImage: {
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
  socialLinksContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  socialButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
  mediaMetaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  mediaYear: {
    fontSize: 12,
    color: '#02A9FF',
    fontWeight: '600',
  },
  mediaFormat: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  roleTag: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  characterCard: {
    width: 140,
    marginRight: 16,
    borderRadius: 12,
    overflow: 'hidden',
    padding: 8,
  },
  characterImage: {
    width: 124,
    height: 180,
    borderRadius: 8,
  },
  characterName: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  mediaReference: {
    fontSize: 12,
    fontStyle: 'italic',
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

export default StaffDetailsScreen; 
import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    padding: 20,
  },
  coverImage: {
    width: width - 40,
    height: (width - 40) * 1.5,
    borderRadius: 12,
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: 15,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  nativeTitle: {
    fontSize: 16,
    marginTop: 5,
    textAlign: 'center',
  },
  shareButton: {
    padding: 8,
  },
  infoContainer: {
    padding: 15,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoItem: {
    width: '50%',
    marginBottom: 15,
    paddingRight: 10,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  appearancesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
  },
  appearanceCard: {
    width: width / 2 - 15,
    margin: 5,
    borderRadius: 8,
    overflow: 'hidden',
  },
  appearanceCover: {
    width: '100%',
    height: 150,
  },
  appearanceTitle: {
    fontSize: 14,
    padding: 8,
  },
  voiceActorsContainer: {
    padding: 15,
  },
  languageSection: {
    marginBottom: 20,
  },
  languageHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  voiceActorsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    margin: -5,
  },
  voiceActorCard: {
    width: width / 3 - 20,
    margin: 5,
    borderRadius: 8,
    overflow: 'hidden',
  },
  voiceActorImage: {
    width: '100%',
    aspectRatio: 1,
  },
  voiceActorName: {
    fontSize: 12,
    padding: 8,
    textAlign: 'center',
  },
}); 
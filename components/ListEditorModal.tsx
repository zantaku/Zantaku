import { View, Text, StyleSheet, TouchableOpacity, TextInput, Switch, Modal, Pressable, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';
import { useState } from 'react';

interface ListEditorModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    status: string;
    progress: number;
    score: number;
    private: boolean;
    hideFromStatusLists: boolean;
    customLists: {
      watched: boolean;
    };
    notes: string;
    repeat: number;
    startedAt?: {
      year?: number;
      month?: number;
      day?: number;
    };
    completedAt?: {
      year?: number;
      month?: number;
      day?: number;
    };
  }) => void;
  initialData: {
    status: string;
    progress: number;
    score: number;
    private?: boolean;
    hideFromStatusLists?: boolean;
    customLists?: {
      watched: boolean;
    };
    notes?: string;
    repeat?: number;
    startedAt?: {
      year?: number;
      month?: number;
      day?: number;
    };
    completedAt?: {
      year?: number;
      month?: number;
      day?: number;
    };
  };
  totalEpisodes?: number;
}

export default function ListEditorModal({ 
  visible, 
  onClose, 
  onSave,
  initialData,
  totalEpisodes
}: ListEditorModalProps) {
  const [status, setStatus] = useState(initialData.status);
  const [progress, setProgress] = useState(initialData.progress);
  const [score, setScore] = useState(initialData.score);
  const [isPrivate, setIsPrivate] = useState(initialData.private || false);
  const [hideFromStatusLists, setHideFromStatusLists] = useState(initialData.hideFromStatusLists || false);
  const [customLists, setCustomLists] = useState(initialData.customLists || { watched: false });
  const [notes, setNotes] = useState(initialData.notes || '');
  const [repeat, setRepeat] = useState(initialData.repeat || 0);
  const [startedAt, setStartedAt] = useState<{ year?: number; month?: number; day?: number; } | undefined>(initialData.startedAt);
  const [completedAt, setCompletedAt] = useState<{ year?: number; month?: number; day?: number; } | undefined>(initialData.completedAt);

  const handleSave = () => {
    onSave({
      status,
      progress,
      score,
      private: isPrivate,
      hideFromStatusLists,
      customLists,
      notes,
      repeat,
      startedAt,
      completedAt
    });
    onClose();
  };

  const formatDate = (date: { year?: number; month?: number; day?: number; } | undefined) => {
    if (!date || !date.year || !date.month || !date.day) return '';
    return new Date(date.year, date.month - 1, date.day).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.modalContent}>
          <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
            <View style={styles.content}>
              <Text style={styles.title}>List Editor</Text>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>STATUS</Text>
                <TouchableOpacity style={styles.statusButton}>
                  <Text style={styles.statusButtonText}>{status}</Text>
                  <FontAwesome5 name="chevron-down" size={12} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>PROGRESS</Text>
                <View style={styles.progressContainer}>
                  <TouchableOpacity 
                    style={styles.progressButton}
                    onPress={() => setProgress(Math.max(0, progress - 1))}
                  >
                    <FontAwesome5 name="minus" size={12} color="#fff" />
                  </TouchableOpacity>
                  <View style={styles.progressInput}>
                    <Text style={styles.progressText}>{progress}</Text>
                    <Text style={styles.progressTotal}>/ {totalEpisodes || '?'}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.progressButton}
                    onPress={() => setProgress(progress + 1)}
                  >
                    <FontAwesome5 name="plus" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>SCORE</Text>
                <TouchableOpacity style={styles.scoreButton}>
                  <Text style={styles.scoreButtonText}>{score || 'No Score'}</Text>
                  <FontAwesome5 name="star" size={12} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>STARTED AT</Text>
                <TouchableOpacity style={styles.dateButton}>
                  <Text style={styles.dateButtonText}>
                    {formatDate(startedAt) || 'Not Set'}
                  </Text>
                  <FontAwesome5 name="calendar" size={12} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>COMPLETED AT</Text>
                <TouchableOpacity style={styles.dateButton}>
                  <Text style={styles.dateButtonText}>
                    {formatDate(completedAt) || 'Not Set'}
                  </Text>
                  <FontAwesome5 name="calendar" size={12} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Other</Text>
                <View style={styles.otherSection}>
                  <View style={styles.repeatContainer}>
                    <Text style={styles.repeatLabel}>TOTAL REPEATS</Text>
                    <View style={styles.repeatInput}>
                      <FontAwesome5 name="redo" size={12} color="#fff" style={styles.repeatIcon} />
                      <Text style={styles.repeatText}>{repeat}</Text>
                    </View>
                  </View>

                  <View style={styles.notesContainer}>
                    <Text style={styles.notesLabel}>NOTE</Text>
                    <TextInput
                      style={styles.notesInput}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Add note..."
                      placeholderTextColor="#666"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Private</Text>
                <Switch
                  value={isPrivate}
                  onValueChange={setIsPrivate}
                  trackColor={{ false: '#333', true: '#FF6B6B' }}
                  thumbColor={isPrivate ? '#fff' : '#fff'}
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Hide in Home Screen</Text>
                <Switch
                  value={hideFromStatusLists}
                  onValueChange={setHideFromStatusLists}
                  trackColor={{ false: '#333', true: '#FF6B6B' }}
                  thumbColor={hideFromStatusLists ? '#fff' : '#fff'}
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Custom Lists</Text>
                <View style={styles.customListsContainer}>
                  <Text style={styles.customListLabel}>Watched using Moopa</Text>
                  <Switch
                    value={customLists.watched}
                    onValueChange={(value) => setCustomLists({ ...customLists, watched: value })}
                    trackColor={{ false: '#333', true: '#FF6B6B' }}
                    thumbColor={customLists.watched ? '#fff' : '#fff'}
                  />
                </View>
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.deleteButton} onPress={onClose}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  scrollView: {
    maxHeight: '100%',
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
    fontWeight: '500',
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  progressTotal: {
    color: '#666',
    fontSize: 16,
  },
  scoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
  },
  scoreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
  },
  dateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  otherSection: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
  },
  repeatContainer: {
    marginBottom: 12,
  },
  repeatLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  repeatInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  repeatIcon: {
    opacity: 0.7,
  },
  repeatText: {
    color: '#fff',
    fontSize: 16,
  },
  notesContainer: {
    marginTop: 12,
  },
  notesLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  notesInput: {
    color: '#fff',
    fontSize: 16,
    padding: 0,
  },
  customListsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customListLabel: {
    color: '#fff',
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF6B6B',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#FF6B6B',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 
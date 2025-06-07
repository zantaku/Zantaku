import { View, Text, StyleSheet, TouchableOpacity, TextInput, Switch, Modal, Pressable, ScrollView, Alert, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';

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
  }) => Promise<void>;
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

const STATUS_OPTIONS = [
  { value: 'CURRENT', label: 'Watching/Reading' },
  { value: 'PLANNING', label: 'Planning' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'DROPPED', label: 'Dropped' },
  { value: 'REPEATING', label: 'Repeating' }
];

const SCORE_OPTIONS = [
  { value: 0, label: 'No Score' },
  { value: 1, label: '1 - Appalling' },
  { value: 2, label: '2 - Horrible' },
  { value: 3, label: '3 - Very Bad' },
  { value: 4, label: '4 - Bad' },
  { value: 5, label: '5 - Average' },
  { value: 6, label: '6 - Fine' },
  { value: 7, label: '7 - Good' },
  { value: 8, label: '8 - Very Good' },
  { value: 9, label: '9 - Great' },
  { value: 10, label: '10 - Masterpiece' }
];



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
  
  // UI state
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showScorePicker, setShowScorePicker] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showCompletedDatePicker, setShowCompletedDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setStatus(initialData.status);
      setProgress(initialData.progress);
      setScore(initialData.score);
      setIsPrivate(initialData.private || false);
      setHideFromStatusLists(initialData.hideFromStatusLists || false);
      setCustomLists(initialData.customLists || { watched: false });
      setNotes(initialData.notes || '');
      setRepeat(initialData.repeat || 0);
      setStartedAt(initialData.startedAt);
      setCompletedAt(initialData.completedAt);
    }
  }, [visible, initialData]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await onSave({
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
    } catch (error) {
      console.error('Error saving list entry:', error);
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: { year?: number; month?: number; day?: number; } | undefined) => {
    if (!date || !date.year || !date.month || !date.day) return '';
    return new Date(date.year, date.month - 1, date.day).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleDateChange = (event: any, selectedDate: Date | undefined, type: 'start' | 'completed') => {
    // On Android, always hide the picker after interaction
    if (Platform.OS === 'android') {
      if (type === 'start') {
        setShowStartDatePicker(false);
      } else {
        setShowCompletedDatePicker(false);
      }
    }

    // Only update if user confirmed the selection and we have a valid date
    if (selectedDate && (event.type === 'set' || Platform.OS === 'ios')) {
      const dateObj = {
        year: selectedDate.getFullYear(),
        month: selectedDate.getMonth() + 1,
        day: selectedDate.getDate()
      };
      
      if (type === 'start') {
        setStartedAt(dateObj);
      } else {
        setCompletedAt(dateObj);
      }
    }

    // On iOS, hide picker when dismissed
    if (Platform.OS === 'ios' && event.type === 'dismissed') {
      if (type === 'start') {
        setShowStartDatePicker(false);
      } else {
        setShowCompletedDatePicker(false);
      }
    }
  };

  const clearDate = (type: 'start' | 'completed') => {
    if (type === 'start') {
      setStartedAt(undefined);
    } else {
      setCompletedAt(undefined);
    }
  };

  const getStatusLabel = (statusValue: string) => {
    return STATUS_OPTIONS.find(option => option.value === statusValue)?.label || statusValue;
  };

  const getScoreLabel = (scoreValue: number) => {
    return SCORE_OPTIONS.find(option => option.value === scoreValue)?.label || 'No Score';
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

              {/* Status Section */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>STATUS</Text>
                <TouchableOpacity 
                  style={styles.statusButton}
                  onPress={() => setShowStatusPicker(true)}
                >
                  <Text style={styles.statusButtonText}>{getStatusLabel(status)}</Text>
                  <FontAwesome5 name="chevron-down" size={12} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Progress Section */}
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

              {/* Score Section */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>SCORE</Text>
                <TouchableOpacity 
                  style={styles.scoreButton}
                  onPress={() => setShowScorePicker(true)}
                >
                  <Text style={styles.scoreButtonText}>{getScoreLabel(score)}</Text>
                  <FontAwesome5 name="star" size={12} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Started At Section */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>STARTED AT</Text>
                <View style={styles.dateContainer}>
                  <TouchableOpacity 
                    style={[styles.dateButton, { flex: 1 }]}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Text style={styles.dateButtonText}>
                      {formatDate(startedAt) || 'Not Set'}
                    </Text>
                    <FontAwesome5 name="calendar" size={12} color="#fff" />
                  </TouchableOpacity>
                  {startedAt && (
                    <TouchableOpacity 
                      style={styles.clearDateButton}
                      onPress={() => clearDate('start')}
                    >
                      <FontAwesome5 name="times" size={12} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Completed At Section */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>COMPLETED AT</Text>
                <View style={styles.dateContainer}>
                  <TouchableOpacity 
                    style={[styles.dateButton, { flex: 1 }]}
                    onPress={() => setShowCompletedDatePicker(true)}
                  >
                    <Text style={styles.dateButtonText}>
                      {formatDate(completedAt) || 'Not Set'}
                    </Text>
                    <FontAwesome5 name="calendar" size={12} color="#fff" />
                  </TouchableOpacity>
                  {completedAt && (
                    <TouchableOpacity 
                      style={styles.clearDateButton}
                      onPress={() => clearDate('completed')}
                    >
                      <FontAwesome5 name="times" size={12} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Other Section */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Other</Text>
                <View style={styles.otherSection}>
                  <View style={styles.repeatContainer}>
                    <Text style={styles.repeatLabel}>TOTAL REPEATS</Text>
                    <View style={styles.repeatControls}>
                      <TouchableOpacity 
                        style={styles.repeatButton}
                        onPress={() => setRepeat(Math.max(0, repeat - 1))}
                      >
                        <FontAwesome5 name="minus" size={10} color="#fff" />
                      </TouchableOpacity>
                      <View style={styles.repeatInput}>
                        <FontAwesome5 name="redo" size={12} color="#fff" style={styles.repeatIcon} />
                        <Text style={styles.repeatText}>{repeat}</Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.repeatButton}
                        onPress={() => setRepeat(repeat + 1)}
                      >
                        <FontAwesome5 name="plus" size={10} color="#fff" />
                      </TouchableOpacity>
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
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </View>
              </View>

              {/* Private Section */}
              <View style={styles.section}>
                <View style={styles.switchContainer}>
                  <Text style={styles.sectionLabel}>Private</Text>
                  <Switch
                    value={isPrivate}
                    onValueChange={setIsPrivate}
                    trackColor={{ false: '#333', true: '#FF6B6B' }}
                    thumbColor={isPrivate ? '#fff' : '#fff'}
                  />
                </View>
              </View>

              {/* Hide in Home Screen Section */}
              <View style={styles.section}>
                <View style={styles.switchContainer}>
                  <Text style={styles.sectionLabel}>Hide in Home Screen</Text>
                  <Switch
                    value={hideFromStatusLists}
                    onValueChange={setHideFromStatusLists}
                    trackColor={{ false: '#333', true: '#FF6B6B' }}
                    thumbColor={hideFromStatusLists ? '#fff' : '#fff'}
                  />
                </View>
              </View>

              {/* Custom Lists Section */}
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

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.deleteButton} onPress={onClose}>
                  <Text style={styles.deleteButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} 
                  onPress={handleSave}
                  disabled={isLoading}
                >
                  <Text style={styles.saveButtonText}>
                    {isLoading ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Status Picker Modal */}
      <Modal
        visible={showStatusPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusPicker(false)}
      >
        <View style={styles.pickerModalContainer}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setShowStatusPicker(false)} />
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Select Status</Text>
            {STATUS_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.pickerOption,
                  status === option.value && styles.pickerOptionSelected
                ]}
                onPress={() => {
                  setStatus(option.value);
                  setShowStatusPicker(false);
                }}
              >
                <Text style={[
                  styles.pickerOptionText,
                  status === option.value && styles.pickerOptionTextSelected
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Score Picker Modal */}
      <Modal
        visible={showScorePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScorePicker(false)}
      >
        <View style={styles.pickerModalContainer}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setShowScorePicker(false)} />
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Select Score</Text>
            <ScrollView style={styles.pickerScrollView}>
              {SCORE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.pickerOption,
                    score === option.value && styles.pickerOptionSelected
                  ]}
                  onPress={() => {
                    setScore(option.value);
                    setShowScorePicker(false);
                  }}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    score === option.value && styles.pickerOptionTextSelected
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      {showStartDatePicker && (
        <DateTimePicker
          value={startedAt ? new Date(startedAt.year!, startedAt.month! - 1, startedAt.day!) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => handleDateChange(event, selectedDate, 'start')}
        />
      )}

      {showCompletedDatePicker && (
        <DateTimePicker
          value={completedAt ? new Date(completedAt.year!, completedAt.month! - 1, completedAt.day!) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => handleDateChange(event, selectedDate, 'completed')}
        />
      )}
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
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  clearDateButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
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
  repeatControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  repeatButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
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
    padding: 8,
    backgroundColor: '#555',
    borderRadius: 6,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  saveButtonDisabled: {
    backgroundColor: '#666',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Picker Modal Styles
  pickerModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxHeight: '70%',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerScrollView: {
    maxHeight: 300,
  },
  pickerOption: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerOptionSelected: {
    backgroundColor: '#FF6B6B',
  },
  pickerOptionText: {
    color: '#fff',
    fontSize: 16,
  },
  pickerOptionTextSelected: {
    fontWeight: '600',
  },
}); 
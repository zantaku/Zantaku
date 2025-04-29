import React, { useEffect, useState } from 'react';
import { BackHandler, View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SettingsLayout, SettingsSection, SettingsToggle } from '../../components/SettingsComponents';
import { FontAwesome5 } from '@expo/vector-icons';

export default function CommonSettingsScreen() {
  const [showProgressModal, setShowProgressModal] = useState(true);
  const [showPlayerExitModal, setShowPlayerExitModal] = useState(true);

  useEffect(() => {
    // Load the saved preferences when component mounts
    const loadPreferences = async () => {
      try {
        const savedProgressModalPreference = await AsyncStorage.getItem('showProgressModal');
        setShowProgressModal(savedProgressModalPreference !== 'false'); // Default to true if not set
        
        const savedPlayerExitPreference = await AsyncStorage.getItem('player_exit_dont_ask_again');
        setShowPlayerExitModal(savedPlayerExitPreference !== 'true'); // Default to true if not set
      } catch (error) {
        console.error('Error loading preferences:', error);
      }
    };
    loadPreferences();
  }, []);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      return true;
    });

    return () => backHandler.remove();
  }, []);

  const handleProgressModalToggle = async (value: boolean) => {
    try {
      await AsyncStorage.setItem('showProgressModal', value.toString());
      setShowProgressModal(value);
    } catch (error) {
      console.error('Error saving progress modal preference:', error);
    }
  };

  const handlePlayerExitModalToggle = async (value: boolean) => {
    try {
      await AsyncStorage.setItem('player_exit_dont_ask_again', (!value).toString());
      setShowPlayerExitModal(value);
    } catch (error) {
      console.error('Error saving player exit modal preference:', error);
    }
  };

  // Custom header icon component
  const SectionIcon = ({ name, color }: { name: string; color: string }) => (
    <View style={{ 
      width: 32, 
      height: 32, 
      borderRadius: 8, 
      backgroundColor: color,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <FontAwesome5 name={name} size={16} color="#fff" solid />
    </View>
  );

  return (
    <SettingsLayout title="Common Settings">
      <SettingsSection 
        title="Reader Settings" 
        icon="book-reader" 
        iconColor="#9C27B0"
      >
        <SettingsToggle
          title="Show Progress Modal"
          description="Show a confirmation dialog when exiting to save your reading progress"
          value={showProgressModal}
          onValueChange={handleProgressModalToggle}
        />
      </SettingsSection>
      
      <SettingsSection 
        title="Player Settings" 
        icon="play-circle" 
        iconColor="#2196F3"
      >
        <SettingsToggle
          title="Show Exit Confirmation"
          description="Show a confirmation dialog when exiting the video player to save your progress"
          value={showPlayerExitModal}
          onValueChange={handlePlayerExitModalToggle}
        />
      </SettingsSection>
      
      <Text style={{ 
        marginTop: 8, 
        marginBottom: 24, 
        marginLeft: 8,
        fontSize: 13, 
        opacity: 0.7 
      }}>
        More settings will be added in future updates
      </Text>
    </SettingsLayout>
  );
}

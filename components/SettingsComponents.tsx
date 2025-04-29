/*
 * SettingsComponents.tsx
 * 
 * A unified set of components for creating consistent settings screens across the app.
 * These components follow a shared design language and handle common patterns like:
 * - Consistent headers with back navigation
 * - Section grouping with optional icons
 * - Standardized typography and spacing
 * - Uniform toggle, slider, and selection controls
 * - Dark/light theme support
 * 
 * Usage:
 * 
 * import { SettingsLayout, SettingsSection, SettingsToggle } from '../../components/SettingsComponents';
 * 
 * export default function MySettingsScreen() {
 *   return (
 *     <SettingsLayout title="My Settings">
 *       <SettingsSection title="General" icon="sliders-h">
 *         <SettingsToggle 
 *           title="Enable Feature" 
 *           description="Description of what this does"
 *           value={enabled}
 *           onValueChange={setEnabled}
 *         />
 *       </SettingsSection>
 *     </SettingsLayout>
 *   );
 * }
 */

import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Switch, Animated, ViewStyle, TextStyle } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { DeviceEventEmitter } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import Slider from '@react-native-community/slider';

// Types
interface SettingsLayoutProps {
  title: string;
  children: ReactNode;
  onBack?: () => void;
}

interface SettingsSectionProps {
  title?: string;
  icon?: string;
  iconColor?: string;
  children: ReactNode;
  style?: ViewStyle;
}

interface SettingsTileProps {
  title: string;
  description?: string;
  rightComponent?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

interface SettingsToggleProps {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  style?: ViewStyle;
}

interface SettingsSliderProps {
  title: string;
  description?: string;
  value: number;
  onValueChange: (value: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  showValue?: boolean;
  valueFormatter?: (value: number) => string;
  style?: ViewStyle;
}

interface SettingsRadioGroupProps {
  title: string;
  description?: string;
  options: { label: string; value: string }[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  style?: ViewStyle;
}

interface SettingsButtonProps {
  title: string;
  onPress: () => void;
  icon?: string;
  primary?: boolean;
  style?: ViewStyle;
}

// Main layout component for all settings screens
export const SettingsLayout = ({ title, children, onBack }: SettingsLayoutProps) => {
  const router = useRouter();
  const { currentTheme } = useTheme();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      // Default behavior: go back to settings page
      DeviceEventEmitter.emit('showSettings');
      router.replace('/settings');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { 
        backgroundColor: currentTheme.colors.background,
        borderBottomColor: currentTheme.colors.border 
      }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color={currentTheme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>{title}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

// Section component to group related settings
export const SettingsSection = ({ title, icon, iconColor, children, style }: SettingsSectionProps) => {
  const { currentTheme } = useTheme();

  return (
    <View style={[styles.section, { backgroundColor: currentTheme.colors.surface }, style]}>
      {title && (
        <View style={styles.sectionHeader}>
          {icon && (
            <FontAwesome5 
              name={icon} 
              size={18} 
              color={iconColor || currentTheme.colors.primary} 
              solid 
            />
          )}
          <Text style={[
            styles.sectionTitle, 
            { 
              color: currentTheme.colors.text,
              marginLeft: icon ? 12 : 0 
            }
          ]}>
            {title}
          </Text>
        </View>
      )}
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );
};

// Basic tile component for settings items
export const SettingsTile = ({ 
  title, 
  description, 
  rightComponent, 
  onPress, 
  style,
  icon,
  iconBgColor,
}: SettingsTileProps & { icon?: string; iconBgColor?: string }) => {
  const { currentTheme } = useTheme();

  return (
    <TouchableOpacity 
      style={[
        styles.settingItem, 
        { borderBottomColor: currentTheme.colors.border },
        onPress ? styles.pressable : undefined,
        style
      ]} 
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingItemInner}>
        {icon && (
          <View style={[styles.iconContainer, { backgroundColor: iconBgColor || currentTheme.colors.primary }]}>
            <FontAwesome5 name={icon} size={20} color="#fff" solid />
          </View>
        )}
        <View style={[styles.settingInfo, { marginLeft: icon ? 0 : 0 }]}>
          <Text style={[styles.settingTitle, { color: currentTheme.colors.text }]}>
            {title}
          </Text>
          {description && (
            <Text style={[styles.settingDescription, { color: currentTheme.colors.textSecondary }]}>
              {description}
            </Text>
          )}
        </View>
        {rightComponent && (
          <View style={styles.settingRight}>
            {rightComponent}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// Toggle component for boolean settings
export const SettingsToggle = ({ title, description, value, onValueChange, style }: SettingsToggleProps) => {
  const { currentTheme } = useTheme();

  return (
    <SettingsTile
      title={title}
      description={description}
      style={style}
      onPress={() => onValueChange(!value)}
      rightComponent={
        <View style={styles.toggleContainer}>
          <Switch
            value={value}
            onValueChange={onValueChange}
            trackColor={{ 
              false: 'rgba(120, 120, 128, 0.16)', 
              true: currentTheme.colors.primary + '80' 
            }}
            thumbColor={value ? currentTheme.colors.primary : '#FFFFFF'}
            ios_backgroundColor="rgba(120, 120, 128, 0.16)"
          />
        </View>
      }
    />
  );
};

// Slider component for numeric settings
export const SettingsSlider = ({ 
  title, 
  description, 
  value, 
  onValueChange, 
  minimumValue = 0, 
  maximumValue = 100, 
  step = 1,
  showValue = true,
  valueFormatter = (val: number) => val.toString(),
  style 
}: SettingsSliderProps) => {
  const { currentTheme } = useTheme();

  return (
    <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }, style]}>
      <View style={styles.settingHeader}>
        <Text style={[styles.settingTitle, { color: currentTheme.colors.text }]}>
          {title}
        </Text>
        {showValue && (
          <Text style={[styles.sliderValue, { color: currentTheme.colors.textSecondary }]}>
            {valueFormatter(value)}
          </Text>
        )}
      </View>
      {description && (
        <Text style={[styles.settingDescription, { color: currentTheme.colors.textSecondary, marginBottom: 12 }]}>
          {description}
        </Text>
      )}
      <View style={styles.sliderContainer}>
        <Slider
          value={value}
          onValueChange={onValueChange}
          minimumValue={minimumValue}
          maximumValue={maximumValue}
          step={step}
          style={styles.slider}
          thumbTintColor={currentTheme.colors.primary}
          minimumTrackTintColor={currentTheme.colors.primary}
          maximumTrackTintColor={currentTheme.colors.border}
        />
      </View>
    </View>
  );
};

// Radio group component for selection settings
export const SettingsRadioGroup = ({ 
  title, 
  description, 
  options, 
  selectedValue, 
  onValueChange,
  style 
}: SettingsRadioGroupProps) => {
  const { currentTheme } = useTheme();

  return (
    <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }, style]}>
      <Text style={[styles.settingTitle, { color: currentTheme.colors.text }]}>
        {title}
      </Text>
      {description && (
        <Text style={[styles.settingDescription, { color: currentTheme.colors.textSecondary, marginBottom: 12 }]}>
          {description}
        </Text>
      )}
      <View style={styles.radioOptions}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.radioOption,
              { 
                backgroundColor: selectedValue === option.value 
                  ? currentTheme.colors.primary 
                  : 'rgba(0,0,0,0.05)', 
                borderColor: selectedValue === option.value 
                  ? currentTheme.colors.primary 
                  : currentTheme.colors.border
              }
            ]}
            onPress={() => onValueChange(option.value)}
          >
            <Text 
              style={[
                styles.radioText, 
                { 
                  color: selectedValue === option.value 
                    ? '#fff' 
                    : currentTheme.colors.text
                }
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// Button component for actions
export const SettingsButton = ({ title, onPress, icon, primary = false, style }: SettingsButtonProps) => {
  const { currentTheme } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { 
          backgroundColor: primary ? currentTheme.colors.primary : 'transparent',
          borderColor: primary ? currentTheme.colors.primary : currentTheme.colors.border,
          borderWidth: 1,
        },
        style
      ]}
      onPress={onPress}
    >
      {icon && (
        <FontAwesome5 
          name={icon} 
          size={16} 
          color={primary ? '#fff' : currentTheme.colors.text} 
          style={styles.buttonIcon} 
        />
      )}
      <Text 
        style={[
          styles.buttonText, 
          { 
            color: primary ? '#fff' : currentTheme.colors.text
          }
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 10,
    marginRight: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionContent: {
    // No additional styles needed
  },
  settingItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  settingItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressable: {
    opacity: 1,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingRight: {
    minWidth: 60,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 18,
    opacity: 0.8,
  },
  sliderContainer: {
    width: '100%',
    marginTop: 8,
  },
  slider: {
    height: 40,
  },
  sliderValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  radioOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  radioOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  radioText: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    marginVertical: 10,
  },
  buttonIcon: {
    marginRight: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  toggleContainer: {
    width: 52,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(120, 120, 128, 0.16)',
  },
}); 
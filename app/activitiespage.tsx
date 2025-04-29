import { View } from 'react-native';
import ActivitiesPage from '../components/ActivitiesPage';
import { useRouter } from 'expo-router';

export default function ActivitiesScreen() {
  const router = useRouter();
  
  // Create a handler to close and navigate back
  const handleClose = () => {
    router.back();
  };
  
  return (
    <View style={{ flex: 1 }}>
      <ActivitiesPage onClose={handleClose} />
    </View>
  );
} 
import { supabase } from '../lib/supabase';

export const refreshSupabaseAuth = async (): Promise<boolean> => {
  try {
    console.log('Refreshing Supabase authentication...');
    
    // Try to refresh the session
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('Failed to refresh Supabase session:', error);
      return false;
    }
    
    if (data.session) {
      console.log('✅ Supabase session refreshed successfully');
      return true;
    }
    
    console.log('No active Supabase session to refresh');
    return false;
    
  } catch (error) {
    console.error('Error refreshing Supabase auth:', error);
    return false;
  }
};

export const handleSupabaseJWTError = async (error: any): Promise<boolean> => {
  // Check if it's a JWT signature error
  if (error.code === 'PGRST301' || error.message?.includes('JWSInvalidSignature')) {
    console.log('Detected JWT signature error, attempting to refresh...');
    
    // Try to refresh the session
    const refreshed = await refreshSupabaseAuth();
    
    if (refreshed) {
      console.log('✅ Successfully refreshed Supabase auth');
      return true;
    } else {
      console.log('❌ Could not refresh Supabase auth, continuing without it');
      return false;
    }
  }
  
  return false;
}; 
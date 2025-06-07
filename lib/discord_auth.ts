import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Official Supabase client specifically for Discord OAuth
const SUPABASE_URL = 'https://luxqxvpksmjwfxfqwvub.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1eHF4dnBrc21qd2Z4ZnF3dnViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc1NDIwMzUsImV4cCI6MjA1MzExODAzNX0.2vEa8LQ_1toVFyoRdMwwzIEKVa9azY1C0KY6YeyY66I';

export const discordSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

console.log('🔷 Discord Supabase client initialized:', SUPABASE_URL); 
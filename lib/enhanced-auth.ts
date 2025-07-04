import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { STORAGE_KEY } from '../constants/auth';

// AniList OAuth2 Configuration
const ANILIST_CLIENT_ID = process.env.EXPO_PUBLIC_ANILIST_CLIENT_ID || 'your_client_id';
const ANILIST_REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: 'kamilist',
  path: 'auth/callback'
});

const ANILIST_AUTH_URL = 'https://anilist.co/api/v2/oauth/authorize';
const ANILIST_TOKEN_URL = 'https://anilist.co/api/v2/oauth/token';

WebBrowser.maybeCompleteAuthSession();

interface AuthTokens {
  accessToken: string;
  tokenType: string;
  expiresIn?: number;
  refreshToken?: string;
  scope?: string;
}

interface UserProfile {
  id: number;
  name: string;
  avatar?: {
    large: string;
    medium: string;
  };
  bannerImage?: string;
  about?: string;
  options?: {
    titleLanguage: string;
    staffNameLanguage: string;
    activityMergeTime: number;
    timezone: string;
  };
  mediaListOptions?: {
    scoreFormat: string;
    rowOrder: string;
    animeList?: {
      sectionOrder: string[];
      splitCompletedSectionByFormat: boolean;
      customLists: string[];
      advancedScoring: string[];
      advancedScoringEnabled: boolean;
    };
  };
  statistics?: {
    anime: {
      count: number;
      meanScore: number;
      minutesWatched: number;
      episodesWatched: number;
    };
  };
}

class EnhancedAuthService {
  private static instance: EnhancedAuthService;
  private userProfile: UserProfile | null = null;
  private authTokens: AuthTokens | null = null;

  static getInstance(): EnhancedAuthService {
    if (!EnhancedAuthService.instance) {
      EnhancedAuthService.instance = new EnhancedAuthService();
    }
    return EnhancedAuthService.instance;
  }

  // Generate PKCE challenge for secure OAuth
  private async generatePKCEChallenge(): Promise<{ codeVerifier: string; codeChallenge: string }> {
    const codeVerifier = AuthSession.AuthRequest.createRandomCodeChallenge();
    const codeChallenge = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      codeVerifier,
      { encoding: Crypto.CryptoEncoding.BASE64URL }
    );
    
    return { codeVerifier, codeChallenge };
  }

  // Start OAuth2 PKCE flow
  async startAuthFlow(): Promise<{ success: boolean; error?: string }> {
    try {
      const { codeVerifier, codeChallenge } = await this.generatePKCEChallenge();
      
      // Store code verifier securely
      await SecureStore.setItemAsync(STORAGE_KEY.PKCE_VERIFIER, codeVerifier);

      const authUrl = `${ANILIST_AUTH_URL}?` +
        `client_id=${ANILIST_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(ANILIST_REDIRECT_URI)}&` +
        `response_type=code&` +
        `code_challenge=${codeChallenge}&` +
        `code_challenge_method=S256&` +
        `scope=user:read`;

      console.log('Starting auth flow with URL:', authUrl);
      console.log('Redirect URI:', ANILIST_REDIRECT_URI);

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        ANILIST_REDIRECT_URI,
        {
          preferEphemeralSession: true,
          showInRecents: false,
        }
      );

      if (result.type === 'success' && result.url) {
        return this.handleAuthCallback(result.url);
      } else if (result.type === 'cancel') {
        return { success: false, error: 'Authentication cancelled' };
      } else {
        return { success: false, error: 'Authentication failed' };
      }
    } catch (error) {
      console.error('Auth flow error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Handle OAuth callback
  private async handleAuthCallback(url: string): Promise<{ success: boolean; error?: string }> {
    try {
      const urlParams = new URLSearchParams(url.split('?')[1]);
      const authCode = urlParams.get('code');
      const error = urlParams.get('error');

      if (error) {
        return { success: false, error: `OAuth error: ${error}` };
      }

      if (!authCode) {
        return { success: false, error: 'No authorization code received' };
      }

      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(authCode);
      if (!tokens) {
        return { success: false, error: 'Failed to exchange code for tokens' };
      }

      // Store tokens securely
      await this.storeTokens(tokens);

      // Fetch user profile
      const profile = await this.fetchUserProfile();
      if (profile) {
        this.userProfile = profile;
        await SecureStore.setItemAsync(STORAGE_KEY.USER_PROFILE, JSON.stringify(profile));
        await SecureStore.setItemAsync(STORAGE_KEY.USER_ID, profile.id.toString());
      }

      return { success: true };
    } catch (error) {
      console.error('Auth callback error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Exchange authorization code for access token
  private async exchangeCodeForTokens(authCode: string): Promise<AuthTokens | null> {
    try {
      const codeVerifier = await SecureStore.getItemAsync(STORAGE_KEY.PKCE_VERIFIER);
      if (!codeVerifier) {
        throw new Error('PKCE verifier not found');
      }

      const response = await fetch(ANILIST_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: ANILIST_CLIENT_ID,
          code: authCode,
          redirect_uri: ANILIST_REDIRECT_URI,
          code_verifier: codeVerifier,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token exchange failed:', response.status, errorText);
        throw new Error(`Token exchange failed: ${response.status}`);
      }

      const tokens: AuthTokens = await response.json();
      
      // Clean up PKCE verifier
      await SecureStore.deleteItemAsync(STORAGE_KEY.PKCE_VERIFIER);

      return tokens;
    } catch (error) {
      console.error('Token exchange error:', error);
      return null;
    }
  }

  // Store tokens securely
  private async storeTokens(tokens: AuthTokens): Promise<void> {
    this.authTokens = tokens;
    await SecureStore.setItemAsync(STORAGE_KEY.AUTH_TOKEN, tokens.accessToken);
    
    if (tokens.refreshToken) {
      await SecureStore.setItemAsync(STORAGE_KEY.REFRESH_TOKEN, tokens.refreshToken);
    }

    if (tokens.expiresIn) {
      const expirationTime = Date.now() + (tokens.expiresIn * 1000);
      await SecureStore.setItemAsync(STORAGE_KEY.TOKEN_EXPIRATION, expirationTime.toString());
    }

    // Store token metadata
    await SecureStore.setItemAsync(STORAGE_KEY.TOKEN_METADATA, JSON.stringify({
      tokenType: tokens.tokenType,
      scope: tokens.scope,
      issuedAt: Date.now(),
    }));
  }

  // Fetch user profile from AniList
  private async fetchUserProfile(): Promise<UserProfile | null> {
    try {
      const accessToken = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      if (!accessToken) {
        throw new Error('No access token available');
      }

      const query = `
        query {
          Viewer {
            id
            name
            avatar {
              large
              medium
            }
            bannerImage
            about
            options {
              titleLanguage
              staffNameLanguage
              activityMergeTime
              timezone
            }
            mediaListOptions {
              scoreFormat
              rowOrder
              animeList {
                sectionOrder
                splitCompletedSectionByFormat
                customLists
                advancedScoring
                advancedScoringEnabled
              }
            }
            statistics {
              anime {
                count
                meanScore
                minutesWatched
                episodesWatched
              }
            }
          }
        }
      `;

      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Profile fetch failed: ${response.status}`);
      }

      const data = await response.json();
      if (data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
      }

      return data.data.Viewer;
    } catch (error) {
      console.error('Profile fetch error:', error);
      return null;
    }
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      if (!token) return false;

      // Check if token is expired
      const expirationStr = await SecureStore.getItemAsync(STORAGE_KEY.TOKEN_EXPIRATION);
      if (expirationStr) {
        const expiration = parseInt(expirationStr);
        if (Date.now() > expiration) {
          console.log('Token expired, attempting refresh...');
          return await this.refreshToken();
        }
      }

      return true;
    } catch (error) {
      console.error('Auth check error:', error);
      return false;
    }
  }

  // Refresh access token
  private async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = await SecureStore.getItemAsync(STORAGE_KEY.REFRESH_TOKEN);
      if (!refreshToken) {
        console.log('No refresh token available');
        return false;
      }

      const response = await fetch(ANILIST_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: ANILIST_CLIENT_ID,
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        console.error('Token refresh failed:', response.status);
        await this.logout();
        return false;
      }

      const newTokens: AuthTokens = await response.json();
      await this.storeTokens(newTokens);

      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      await this.logout();
      return false;
    }
  }

  // Get current user profile
  async getUserProfile(): Promise<UserProfile | null> {
    if (this.userProfile) {
      return this.userProfile;
    }

    try {
      const profileStr = await SecureStore.getItemAsync(STORAGE_KEY.USER_PROFILE);
      if (profileStr) {
        this.userProfile = JSON.parse(profileStr);
        return this.userProfile;
      }

      // Fetch fresh profile if not cached
      const isAuth = await this.isAuthenticated();
      if (isAuth) {
        return await this.fetchUserProfile();
      }

      return null;
    } catch (error) {
      console.error('Get profile error:', error);
      return null;
    }
  }

  // Get current access token
  async getAccessToken(): Promise<string | null> {
    const isAuth = await this.isAuthenticated();
    if (!isAuth) return null;

    return await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
  }

  // Logout user
  async logout(): Promise<void> {
    try {
      // Clear all stored auth data
      await Promise.all([
        SecureStore.deleteItemAsync(STORAGE_KEY.AUTH_TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEY.REFRESH_TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEY.TOKEN_EXPIRATION),
        SecureStore.deleteItemAsync(STORAGE_KEY.TOKEN_METADATA),
        SecureStore.deleteItemAsync(STORAGE_KEY.USER_PROFILE),
        SecureStore.deleteItemAsync(STORAGE_KEY.USER_ID),
        SecureStore.deleteItemAsync(STORAGE_KEY.PKCE_VERIFIER),
      ]);

      // Clear in-memory data
      this.userProfile = null;
      this.authTokens = null;

      console.log('User logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  // Get authentication headers for API requests
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    if (!token) {
      return {};
    }

    return {
      'Authorization': `Bearer ${token}`,
    };
  }

  // Check if specific permissions are granted
  async hasPermission(permission: string): Promise<boolean> {
    try {
      const metadataStr = await SecureStore.getItemAsync(STORAGE_KEY.TOKEN_METADATA);
      if (!metadataStr) return false;

      const metadata = JSON.parse(metadataStr);
      const scopes = metadata.scope?.split(' ') || [];
      
      return scopes.includes(permission);
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }
}

// Export singleton instance
export const authService = EnhancedAuthService.getInstance();

// React hook for authentication
export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(false);
  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      const isAuth = await authService.isAuthenticated();
      setIsAuthenticated(isAuth);

      if (isAuth) {
        const profile = await authService.getUserProfile();
        setUser(profile);
      }
    } catch (error) {
      console.error('Auth status check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      setLoading(true);
      const result = await authService.startAuthFlow();
      
      if (result.success) {
        await checkAuthStatus();
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await authService.logout();
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    isAuthenticated,
    user,
    loading,
    login,
    logout,
    checkAuthStatus,
  };
};

export default authService; 
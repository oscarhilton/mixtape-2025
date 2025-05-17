'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface User {
  id: number;
  spotify_id: string;
  display_name: string;
  email?: string;
  // Add other user properties as needed
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  devLogin?: (devUserId: string) => Promise<void>;
  accessToken: string | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const fetchUser = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
      console.log('[AuthContext] fetchUser: /auth/me response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('[AuthContext] fetchUser: /auth/me raw data received:', data);
        const userToSet = data.user || null;
        const tokenToSet = data.accessToken || null;
        console.log('[AuthContext] fetchUser: User object to set:', userToSet);
        console.log('[AuthContext] fetchUser: AccessToken to set:', tokenToSet);
        setUser(userToSet);
        setAccessToken(tokenToSet);
      } else {
        const errorText = await response.text();
        console.error('[AuthContext] fetchUser: /auth/me failed. Status:', response.status, 'Response Text:', errorText);
        setUser(null);
        setAccessToken(null);
      }
    } catch (error) {
      console.error("[AuthContext] fetchUser: Error during fetch operation:", error);
      setUser(null);
      setAccessToken(null);
    } finally {
      setIsLoading(false);
      console.log('[AuthContext] fetchUser: finished, isLoading set to false.');
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = () => {
    // Redirect to backend Spotify login route
    window.location.href = `${API_URL}/auth/spotify`;
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await fetch(`${API_URL}/auth/logout`, { method: 'GET', credentials: 'include' });
      setUser(null);
      setAccessToken(null);
    } catch (error) {
      console.error("Failed to logout:", error);
    } finally {
      // fetchUser(); // Re-check auth status after logout attempt, or simply clear user
      setIsLoading(false);
    }
  };

  const devLogin = async (devUserId: string) => {
    if (process.env.NODE_ENV !== 'development') {
      console.warn('Dev login is only available in development mode.');
      return;
    }
    setIsLoading(true);
    try {
      // For dev login, we might expect the backend to set a cookie/session
      // and then we fetch the user details like a normal login.
      const response = await fetch(`${API_URL}/auth/dev-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: devUserId }), // Or however your dev endpoint expects it
        credentials: 'include',
      });

      if (response.ok) {
        // After successful dev login, fetch user details (which should include token)
        await fetchUser();
      } else {
        console.error("Dev login failed:", await response.text());
        setUser(null);
        setAccessToken(null);
      }
    } catch (error) {
      console.error("Failed to execute dev login:", error);
      setUser(null);
      setAccessToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const contextValue: AuthContextType = {
    user,
    isLoading,
    login,
    logout,
    accessToken,
  };

  useEffect(() => {
    console.log('[AuthContext] Context value updated:', { user, isLoading, accessToken });
  }, [user, isLoading, accessToken]);

  if (process.env.NODE_ENV === 'development') {
    contextValue.devLogin = devLogin;
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 
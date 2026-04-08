import React, { createContext, useContext, useEffect, useState } from 'react';
import apiClient from '../api/apiClient';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('auth_token');
      if (storedToken) {
        // If it's a mock token, restore user from localStorage without network call
        if (storedToken.startsWith('mock_')) {
          const storedUser = localStorage.getItem('auth_user');
          if (storedUser) {
            setUser(JSON.parse(storedUser));
            setToken(storedToken);
          } else {
            // Mock token but no user data — clear it
            localStorage.removeItem('auth_token');
            setToken(null);
          }
          setIsLoading(false);
          return;
        }

        // Real token — verify with backend
        try {
          const response = await apiClient.get('/api/v1/profile');
          setUser(response.data);
          setToken(storedToken);
        } catch (error: any) {
          // Only logout on 401 (invalid token), NOT on network errors
          if (error.response?.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
            setToken(null);
            setUser(null);
          }
          // On network error, keep the token — user is "optimistically" authenticated
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, isLoading, login, logout }}>
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

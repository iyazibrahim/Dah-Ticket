import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authAPI } from '../services/api';
import {
  clearAuthStorage,
  getAuthToken,
  setAuthToken,
  setAuthUserRaw,
} from '../lib/storage';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { first_name: string; last_name: string; email: string; password: string }) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState(true);

  // On mount, validate the stored token
  useEffect(() => {
    const validateToken = async () => {
      const storedToken = getAuthToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await authAPI.getMe();
        setUser(response.data.user);
        setToken(storedToken);
      } catch {
        clearAuthStorage();
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authAPI.login(email, password);
    const { token: newToken, user: newUser } = response.data;

    setAuthToken(newToken);
    setAuthUserRaw(JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    return newUser as User;
  };

  const register = async (data: { first_name: string; last_name: string; email: string; password: string }) => {
    const response = await authAPI.register(data);
    const { token: newToken, user: newUser } = response.data;

    setAuthToken(newToken);
    setAuthUserRaw(JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    return newUser as User;
  };

  const refreshUser = async () => {
    try {
      const response = await authAPI.getMe();
      const next = response.data.user as User;
      setUser(next);
      setAuthUserRaw(JSON.stringify(next));
      return next;
    } catch {
      return null;
    }
  };

  const logout = () => {
    clearAuthStorage();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        isAuthenticated: !!token && !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

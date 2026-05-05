import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { User } from '../lib/api';
import { deriveWrappingKey, unwrapPrivateKey } from '../lib/crypto';
import { socketManager } from '../lib/socket';

interface AuthContextType {
  user: User | null;
  privateKey: CryptoKey | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, displayName: string, password: string, keys: { publicKey: string, wrappedPrivateKey: string, salt: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const restore = async () => {
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        try {
          const success = await api.refresh();
          if (success) {
            const profile = await api.getMe();
            setUser(profile);
            // Note: We can't restore the private key without the password.
            // In a real app, we might ask for the password again or store it securely.
            // For this app, if they refresh the page, they might need to re-enter password to unlock.
          }
        } catch (e) {
          console.error("Restore failed", e);
        }
      }
      setIsLoading(false);
    };
    restore();
  }, []);

  // Connect socket when user and token are available
  useEffect(() => {
    const token = api.getAccessToken();
    if (user && token) {
      socketManager.connect(token);
    } else {
      socketManager.disconnect();
    }
  }, [user]);

  const login = async (username: string, password: string) => {
    const res = await api.login({ username, password });
    setUser(res.user);
    
    // Unwrap private key
    if (res.user.wrapped_private_key && res.user.pbkdf2_salt) {
      const wrappingKey = await deriveWrappingKey(password, res.user.pbkdf2_salt);
      const unwrapped = await unwrapPrivateKey(res.user.wrapped_private_key, wrappingKey);
      setPrivateKey(unwrapped);
    }
  };

  const register = async (username: string, displayName: string, password: string, keys: { publicKey: string, wrappedPrivateKey: string, salt: string }) => {
    const res = await api.register({
      username,
      display_name: displayName,
      password,
      public_key: keys.publicKey,
      wrapped_private_key: keys.wrappedPrivateKey,
      pbkdf2_salt: keys.salt
    });
    setUser(res.user);
    
    // We already have the keys during registration
    // We'll need to re-derive the wrapping key to unwrap if we want to store it in memory
    const wrappingKey = await deriveWrappingKey(password, keys.salt);
    const unwrapped = await unwrapPrivateKey(keys.wrappedPrivateKey, wrappingKey);
    setPrivateKey(unwrapped);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setPrivateKey(null);
  };

  return (
    <AuthContext.Provider value={{ user, privateKey, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

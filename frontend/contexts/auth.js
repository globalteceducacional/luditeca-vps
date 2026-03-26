import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { apiFetch, clearAccessToken, getAccessToken, setAccessToken } from '../lib/apiClient';

const AuthContext = createContext();

function mapUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    user_metadata: {
      name: u.name,
      avatar_url: u.avatar_url ?? null,
    },
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const json = await apiFetch('/auth/me');
    setUser(mapUser(json.user));
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      try {
        if (!getAccessToken()) {
          setUser(null);
          return;
        }
        await fetchMe();
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, [fetchMe]);

  const login = async (email, password) => {
    try {
      setLoading(true);
      const json = await apiFetch('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      if (json.access_token) setAccessToken(json.access_token);
      setUser(mapUser(json.user));
      return { success: true, data: json };
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      clearAccessToken();
      setUser(null);
      return { success: true };
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const updateUserData = async () => {
    try {
      setLoading(true);
      if (!getAccessToken()) {
        setUser(null);
        return { success: false, error: 'Não autenticado' };
      }
      await fetchMe();
      return { success: true };
    } catch (error) {
      console.error('Erro ao atualizar dados do usuário:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        updateUserData,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

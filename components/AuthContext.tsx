
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User, AuthContextType, UserRole, PlayerTeam } from '../types';
import ApiService from './ApiService'; // Mocked API

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // For initial check
  const [userProgress, setUserProgress] = useState<any[]>([]);
  const [pausedSession, setPausedSession] = useState<any | null>(null);


  useEffect(() => {
    const checkLoggedInUser = async () => {
      setLoading(true);
      try {
        const user = await ApiService.getCurrentUser(); // Check if a user session exists
        setCurrentUser(user);
        // ←←← SI HAY USUARIO, CARGA SU PROGRESO Y PAUSA ↓↓↓
        if (user) {
          const [progs, pause] = await Promise.all([
            ApiService.fetchUserProgress(),
            ApiService.fetchPausedSession()
          ]);
          setUserProgress(progs);
          setPausedSession(pause);
            // —> aquí compruebas en la consola:
            console.log('🔄 Progreso cargado:', progs);
            console.log('🔄 Pausa cargada:', pause);
        }
        // ↑↑↑ FIN CARGA AUTOMÁTICA ←←←
      } catch (error) {
        console.error("Error checking logged in user:", error);
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkLoggedInUser();
  }, []);

  const login = async (email: string, password_DO_NOT_USE_IN_REAL_APP: string): Promise<User | null> => {
    setLoading(true);
    try {
      const user = await ApiService.login(email, password_DO_NOT_USE_IN_REAL_APP);
      setCurrentUser(user);
      // ←←← TRAS LOGIN, VUELVE A CARGAR PROGRESO Y PAUSA ↓↓↓
      if (user) {
        const [progs, pause] = await Promise.all([
          ApiService.fetchUserProgress(),
          ApiService.fetchPausedSession()
        ]);
        setUserProgress(progs);
        setPausedSession(pause);
      }
      // ↑↑↑ FIN RECARGA TRAS LOGIN ←←←
      return user;
    } catch (error) {
      console.error("Login failed:", error);
      setCurrentUser(null); 
      throw error; 
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    email: string,
    password_DO_NOT_USE_IN_REAL_APP: string,
    role: UserRole,
    details: {
      firstName?: string;
      lastName?: string;
      team?: PlayerTeam;
      adminCode?: string;
      playerAccessCode?: string;
    }
  ): Promise<User | null> => {
    setLoading(true);
    try {
      const user = await ApiService.register(email, password_DO_NOT_USE_IN_REAL_APP, role, details);
      setCurrentUser(user);
      return user;
    } catch (error) {
      console.error("Registration failed:", error);
      setCurrentUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await ApiService.logout();
      setCurrentUser(null);
      // ←←← LIMPIA PROGRESO Y PAUSA AL LOGOUT ↓↓↓
      setUserProgress([]);
      setPausedSession(null);
      // ↑↑↑ FIN LIMPIEZA ←←←
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider 
          value={{
            currentUser,
            userProgress,
            pausedSession,
            login,
            register,
            logout,
            loading
          }}
        >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
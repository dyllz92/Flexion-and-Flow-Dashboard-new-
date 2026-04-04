import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: any | null;
  isAdmin: boolean;
  loading: boolean;
  login: () => Promise<void>;
  demoLogin: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSession = async (session: any) => {
    const currentUser = session?.user;
    if (currentUser) {
      setUser(currentUser);
      try {
        const isDefaultAdmin = currentUser.email?.toLowerCase() === 'dyllz92@gmail.com';
        
        const { data: userDoc } = await supabase
          .from('users')
          .select('*')
          .eq('email', currentUser.email)
          .single();
        
        if (isDefaultAdmin && !userDoc) {
          await supabase.from('users').insert({
            email: currentUser.email,
            role: 'admin',
            createdAt: new Date().toISOString()
          });
        }
        
        const isSupabaseAdmin = userDoc?.role === 'admin';
        setIsAdmin(isDefaultAdmin || isSupabaseAdmin);
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(currentUser.email?.toLowerCase() === 'dyllz92@gmail.com');
      }
    } else {
      // Don't clear user if it's a demo user
      setUser((prev: any) => prev?.isDemo ? prev : null);
      setIsAdmin((prev: boolean) => user?.isDemo ? true : false);
    }
    setLoading(false);
  };

  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
  };

  const demoLogin = () => {
    setUser({
      id: 'demo-admin-id',
      email: 'dyllz92@gmail.com',
      user_metadata: { full_name: 'Demo Admin' },
      isDemo: true
    });
    setIsAdmin(true);
  };

  const logout = async () => {
    if (user?.isDemo) {
      setUser(null);
      setIsAdmin(false);
    } else {
      await supabase.auth.signOut();
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, login, demoLogin, logout }}>
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

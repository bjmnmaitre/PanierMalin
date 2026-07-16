import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { apiClient } from '@/services/api/client';
import { getMyProfile } from '@/services/api';
import type { UserProfile } from '@/types';

export interface AuthContextType {
  session: Session | null;
  user: SupabaseUser | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = apiClient.getSupabase();

  const fetchProfile = useCallback(async () => {
    try {
      const data = await getMyProfile();
      setProfile(data);
    } catch (err) {
      // Transient network errors must NOT erase the profile — the user stays logged in.
      // Only signOut() is allowed to null the profile explicitly.
      console.warn('[Auth] fetchProfile failed (kept existing profile):', err);
    }
  }, []);

  useEffect(() => {
    // ── 1. Resolve the initial session synchronously from the stored token ──────
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      if (initialSession?.user) {
        void fetchProfile();
      }
      setIsLoading(false);
    }).catch(() => {
      // getSession failure is non-fatal — treat as unauthenticated
      setIsLoading(false);
    });

    // ── 2. Listen for auth events STRICTLY ───────────────────────────────────────
    // CRITICAL: we only clear session on explicit SIGNED_OUT.
    // TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION, etc. must never erase
    // an existing session — they arrive with a valid (or null) session and we
    // only act when that session is present.
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'SIGNED_OUT') {
        // The only code path that is allowed to erase the session.
        setSession(null);
        setProfile(null);
        return;
      }

      // For every other event (TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION,
      // PASSWORD_RECOVERY…), only update when Supabase gives us a valid session.
      // A null session here means the event is informational / not yet resolved —
      // never clear an existing authenticated session because of it.
      if (newSession) {
        setSession(newSession);
        void fetchProfile();
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, [supabase]);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    return { error };
  }, [supabase]);

  const signOut = useCallback(async () => {
    // Eagerly clear local state before the Supabase call so the UI reacts instantly.
    setSession(null);
    setProfile(null);
    await supabase.auth.signOut();
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    // Guard: only refresh when we have a confirmed session.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await fetchProfile();
    }
  }, [supabase, fetchProfile]);

  const value: AuthContextType = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isLoading,
      isAuthenticated: !!session,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [session, profile, isLoading, signIn, signUp, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;

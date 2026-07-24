import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// Types
// ============================================================================

export type AuthMode = 'guest' | 'authenticated' | 'unauthenticated' | 'loading';

interface AuthState {
  mode: AuthMode;
  user: User | null;
  session: Session | null;
  localUserId: string | null;
  isExpoGo: boolean;
}

interface AuthContextValue extends AuthState {
  /** Sign up with email/password via Supabase Auth (FR-1.3) */
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  /** Sign in with email/password via Supabase Auth */
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  /** Sign out and return to welcome screen */
  signOut: () => Promise<void>;
  /** Send password reset email */
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  /** Activate guest mode with a persistent local_user_id (FR-1.5) */
  activateGuestMode: () => Promise<void>;
  /** Migrate guest data to a real account (FR-1.6) */
  migrateGuestToAccount: (email: string, password: string) => Promise<{ error: Error | null }>;
  /** Sign in with Google (FR-1.7) */
  signInWithGoogle?: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ============================================================================
// Constants
// ============================================================================

const LOCAL_USER_ID_KEY = '@the75project:local_user_id';
const GUEST_MODE_KEY = '@the75project:guest_mode';

// ============================================================================
// Provider
// ============================================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    mode: 'loading',
    user: null,
    session: null,
    localUserId: null,
    isExpoGo: false,
  });

  // Detect Expo Go environment (FR-1.7)
  // Google Sign-In cannot run in Expo Go — hide the button there
  useEffect(() => {
    const appOwnership = Constants.appOwnership;
    const isExpoGo = appOwnership === 'expo';
    setState(prev => ({ ...prev, isExpoGo }));
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setState(prev => ({
          ...prev,
          mode: 'authenticated',
          user: session.user,
          session,
        }));
      } else {
        // Check if guest mode was previously activated
        checkGuestMode();
      }
    }).catch((err) => {
      console.error("Session retrieval error:", err);
      checkGuestMode();
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          setState(prev => ({
            ...prev,
            mode: 'authenticated',
            user: session.user,
            session,
          }));
        } else {
          // If signed out, check guest mode
          checkGuestMode();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const checkGuestMode = async () => {
    try {
      const guestMode = await AsyncStorage.getItem(GUEST_MODE_KEY);
      const localUserId = await AsyncStorage.getItem(LOCAL_USER_ID_KEY);
      if (guestMode === 'true' && localUserId) {
        setState(prev => ({
          ...prev,
          mode: 'guest',
          localUserId,
          user: null,
          session: null,
        }));
      } else {
        // No session, no guest mode — show welcome screen
        setState(prev => ({
          ...prev,
          mode: 'unauthenticated',
          user: null,
          session: null,
        }));
      }
    } catch {
      setState(prev => ({ ...prev, mode: 'unauthenticated' }));
    }
  };

  // ── Sign Up ────────────────────────────────────────────────────────────
  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (e: any) {
      return { error: new Error(e.message) };
    }
  }, []);

  // ── Sign In ────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (e: any) {
      return { error: new Error(e.message) };
    }
  }, []);

  // ── Sign Out ───────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState(prev => ({
      ...prev,
      mode: 'unauthenticated',
      user: null,
      session: null,
    }));
  }, []);

  // ── Reset Password ─────────────────────────────────────────────────────
  const resetPassword = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (e: any) {
      return { error: new Error(e.message) };
    }
  }, []);

  // ── Sign In With Google (FR-1.7) ───────────────────────────────────────
  const signInWithGoogle = useCallback(async () => {
    if (state.isExpoGo) {
      return { error: new Error('Google Sign-In is not supported inside Expo Go. Please use a development build.') };
    }
    
    // Placeholder for native Google Sign-In integration using @react-native-google-signin/google-signin
    // This will be implemented fully once ejected to a native dev client.
    return { error: new Error('Native Google Sign-In requires native modules not yet installed.') };
  }, [state.isExpoGo]);

  // ── Activate Guest Mode (FR-1.5) ──────────────────────────────────────
  // Generates a persistent local_user_id once per install
  const activateGuestMode = useCallback(async () => {
    let localUserId = await AsyncStorage.getItem(LOCAL_USER_ID_KEY);
    if (!localUserId) {
      localUserId = Crypto.randomUUID();
      await AsyncStorage.setItem(LOCAL_USER_ID_KEY, localUserId);
    }
    await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
    setState(prev => ({
      ...prev,
      mode: 'guest',
      localUserId,
      user: null,
      session: null,
    }));
  }, []);

  // ── Guest-to-Account Migration (FR-1.6) ───────────────────────────────
  // Re-tags every local row from local_user_id to real auth.uid()
  // and enqueues all data fresh into the sync outbox
  const migrateGuestToAccount = useCallback(async (email: string, password: string) => {
    try {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) return { error: new Error(signUpError.message) };

      // After successful sign-up, the onAuthStateChange listener will update state.
      // The actual data re-keying (local_user_id → auth.uid()) happens in the
      // database layer (sync.ts) which watches for this transition.

      // Clear guest mode flags
      await AsyncStorage.removeItem(GUEST_MODE_KEY);

      return { error: null };
    } catch (e: any) {
      return { error: new Error(e.message) };
    }
  }, []);

  const value: AuthContextValue = {
    ...state,
    signUp,
    signIn,
    signOut,
    resetPassword,
    activateGuestMode,
    migrateGuestToAccount,
    signInWithGoogle,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

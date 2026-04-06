import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;

  initialize: () => Promise<void>;
  signInWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    set({
      user: session?.user ?? null,
      session,
      initialized: true,
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null, session });
    });
  },

  signInWithEmail: async (email, password) => {
    set({ loading: true });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    set({ loading: false });
    return { error: error?.message };
  },

  signUpWithEmail: async (email, password) => {
    set({ loading: true });
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });
    set({ loading: false });
    return { error: error?.message };
  },

  signInWithGoogle: async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  },

  signOut: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },
}));

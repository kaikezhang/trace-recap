import { create } from "zustand";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { track, identifyUser, resetUser } from "@/lib/analytics";
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
  deleteAccount: () => Promise<{ error?: string }>;
}

let initPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: false,
  initialized: false,

  initialize: () => {
    if (get().initialized) return Promise.resolve();

    // Deduplicate concurrent calls (React StrictMode double-mount)
    if (initPromise) return initPromise;

    initPromise = (async () => {
      if (!isSupabaseConfigured()) {
        set({ initialized: true });
        return;
      }

      const supabase = createClient();
      if (!supabase) {
        set({ initialized: true });
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      set({
        user: session?.user ?? null,
        session,
        initialized: true,
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        set({ user: session?.user ?? null, session });
        if (session?.user) {
          identifyUser(session.user.id);
        } else {
          resetUser();
        }
      });

      // Cleanup on page unload to prevent leaked subscriptions
      if (typeof window !== "undefined") {
        window.addEventListener("beforeunload", () => subscription.unsubscribe(), { once: true });
      }
    })();

    return initPromise;
  },

  signInWithEmail: async (email, password) => {
    const supabase = createClient();
    if (!supabase) return { error: "Auth is not configured" };
    set({ loading: true });
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    set({ loading: false });
    if (error) {
      track("auth_failed", { method: "email", error_code: error.message });
    } else {
      track("auth_succeeded", { method: "email" });
    }
    return { error: error?.message };
  },

  signUpWithEmail: async (email, password) => {
    const supabase = createClient();
    if (!supabase) return { error: "Auth is not configured" };
    set({ loading: true });
    const { error } = await supabase.auth.signUp({ email, password });
    set({ loading: false });
    return { error: error?.message };
  },

  signInWithGoogle: async () => {
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      console.error("[auth] Google sign-in failed:", error.message);
    }
  },

  signOut: async () => {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ user: null, session: null });

    // Soft-clear: reset UI state, keep IDB photo cache for next login
    const { useProjectStore } = await import("@/stores/projectStore");
    await useProjectStore.getState().resetForSignOut();
  },

  deleteAccount: async () => {
    const supabase = createClient();
    if (!supabase) return { error: "Auth is not configured" };

    const user = get().user;
    if (!user) return { error: "Not signed in" };

    try {
      // Delete user feedback from cloud
      const { error: feedbackError } = await supabase
        .from("feedback")
        .delete()
        .eq("user_id", user.id);
      if (feedbackError) {
        console.error("[auth] Failed to delete feedback:", feedbackError.message);
      }

      // Delete user photo storage objects
      const { data: photoFiles } = await supabase.storage
        .from("photos")
        .list(user.id);
      if (photoFiles && photoFiles.length > 0) {
        await supabase.storage
          .from("photos")
          .remove(photoFiles.map((f) => `${user.id}/${f.name}`));
      }

      // Delete all user projects from cloud (fail fast)
      const { error: deleteError } = await supabase
        .from("projects")
        .delete()
        .eq("user_id", user.id);
      if (deleteError) {
        return { error: `Failed to delete cloud data: ${deleteError.message}` };
      }

      // Only sign out and clear local state after remote cleanup succeeds
      await supabase.auth.signOut();
      set({ user: null, session: null });

      const { useProjectStore } = await import("@/stores/projectStore");
      await useProjectStore.getState().resetForSignOut();

      // Clear local photo cache
      try {
        const { openDB } = await import("idb");
        const db = await openDB("trace-recap", 2);
        const tx = db.transaction("photo-assets", "readwrite");
        await tx.store.clear();
        await tx.done;
      } catch {
        // Best effort — local cache cleanup is non-critical
      }

      track("account_deleted");
      return {};
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete account";
      return { error: msg };
    }
  },
}));

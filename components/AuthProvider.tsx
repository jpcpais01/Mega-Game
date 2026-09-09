"use client";

import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  authError: string | null;
  signIn: () => void;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured());
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const auth = getFirebaseAuth();

    // Surfaces errors from a completed signInWithRedirect round-trip (e.g.
    // "this domain isn't authorized") — onAuthStateChanged alone never fires
    // on failure, so without this a failed sign-in looks like nothing happened.
    getRedirectResult(auth).catch((err) => {
      console.error("getRedirectResult error:", err);
      setAuthError(describeAuthError(err));
    });

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signIn() {
    if (!isFirebaseConfigured()) {
      console.warn("Sign-in unavailable: Firebase is not configured (missing NEXT_PUBLIC_FIREBASE_* env vars).");
      return;
    }
    setAuthError(null);
    const auth = getFirebaseAuth();

    // Popup resolves directly in this same page load — no cross-origin
    // round-trip to lose state over, which is what made signInWithRedirect
    // unreliable inside an installed PWA (it can come back with no user and
    // no error, looking like nothing happened). Only fall back to redirect
    // if the environment genuinely can't do a popup.
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        return; // the user closed it themselves — not an error
      }
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        signInWithRedirect(auth, new GoogleAuthProvider()).catch((redirectErr) => {
          console.error("signInWithRedirect fallback error:", redirectErr);
          setAuthError(describeAuthError(redirectErr));
        });
        return;
      }
      console.error("signInWithPopup error:", err);
      setAuthError(describeAuthError(err));
    }
  }

  async function signOut() {
    if (!isFirebaseConfigured()) return;
    const auth = getFirebaseAuth();
    await firebaseSignOut(auth);
  }

  async function getIdToken() {
    if (!isFirebaseConfigured()) return null;
    const auth = getFirebaseAuth();
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, configured: isFirebaseConfigured(), authError, signIn, signOut, getIdToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function describeAuthError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code;
  if (code === "auth/unauthorized-domain") {
    return "This domain isn't authorized for sign-in yet (Firebase console → Authentication → Settings → Authorized domains).";
  }
  if (code === "auth/operation-not-allowed") {
    return "Google sign-in isn't enabled for this project yet (Firebase console → Authentication → Sign-in method).";
  }
  if (code === "auth/network-request-failed") {
    return "Network error during sign-in — check your connection and try again.";
  }
  return err instanceof Error ? err.message : "Sign-in failed — please try again.";
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

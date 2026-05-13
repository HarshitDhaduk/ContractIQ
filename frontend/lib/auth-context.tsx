"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  idToken: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  idToken: null,
  signInWithGoogle: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [idToken, setIdToken] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const token = await u.getIdToken();
        setIdToken(token);
        
        // Sync user profile to Firestore
        try {
          const { api } = await import("@/lib/api");
          await api.syncUser({
            display_name: u.displayName,
            photo_url: u.photoURL,
            email: u.email || "",
          }, token);
          console.log("[Auth] User profile synced to Firestore");
        } catch (err) {
          console.error("[Auth] Failed to sync user profile:", err);
        }
      } else {
        setIdToken(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === "auth/unauthorized-domain") {
        console.error(
          "[ContractIQ] Firebase Auth: Unauthorized domain.\n" +
          "Go to Firebase Console → Authentication → Settings → Authorized Domains\n" +
          "and add your current domain (e.g. localhost)."
        );
      } else {
        console.error("[ContractIQ] Sign-in error:", error.message);
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, idToken, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

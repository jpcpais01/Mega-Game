"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "./AuthProvider";

export default function AppHeader({ active }: { active: "home" | "collection" }) {
  const { user, loading, configured, authError, signIn, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="w-full max-w-md flex flex-col items-center gap-1 mb-6">
      <div className="w-full flex items-center justify-between">
        <Link
          href="/collection"
          className={`text-xs font-semibold px-3 py-1.5 rounded-full glass-panel ${
            active === "collection" ? "text-white" : "text-[var(--text-dim)]"
          }`}
        >
          🗂️ Collection
        </Link>

        <div className="relative">
          {!configured ? null : loading ? (
            <div className="w-8 h-8 rounded-full shimmer" />
          ) : user ? (
            <button onClick={() => setMenuOpen((v) => !v)} className="block">
              {user.photoURL ? (
                <Image
                  src={user.photoURL}
                  alt={user.displayName ?? "Account"}
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full border-2 border-[var(--accent)]"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-xs font-bold">
                  {(user.displayName ?? user.email ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
            </button>
          ) : (
            <button
              onClick={signIn}
              className="text-xs font-semibold px-3 py-1.5 rounded-full glow-btn text-white"
            >
              Sign in
            </button>
          )}

          {menuOpen && user && (
            <div className="absolute right-0 mt-2 w-40 glass-panel rounded-xl p-2 z-10 flex flex-col gap-1">
              <p className="text-xs text-[var(--text-dim)] px-2 py-1 truncate">{user.displayName ?? user.email}</p>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  signOut();
                }}
                className="text-left text-xs font-semibold px-2 py-1.5 rounded-lg hover:bg-white/5"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {authError && (
        <p className="text-[11px] text-[var(--danger)] text-center max-w-xs mt-1">{authError}</p>
      )}

      <Link href="/" className="flex flex-col items-center gap-1 mt-2">
        <div className="text-3xl">🥚</div>
        <h1 className="text-xl font-extrabold tracking-tight">Mega Game</h1>
        <p className="text-xs text-[var(--text-dim)]">Essence Forge</p>
      </Link>
    </header>
  );
}

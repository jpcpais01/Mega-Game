"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { ArenaIcon, NestIcon, RiftIcon, VaultIcon } from "./icons/NavIcons";
import GameButton from "./ui/GameButton";
import GamePanel from "./ui/GamePanel";

const NAV = [
  { href: "/", label: "Nest", Icon: NestIcon },
  { href: "/collection", label: "Vault", Icon: VaultIcon },
  { href: "/events", label: "Rift", Icon: RiftIcon },
  { href: "/battle", label: "Arena", Icon: ArenaIcon },
];

export default function GameShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, configured, signIn, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh flex flex-col">
      <header
        className="w-full flex items-center justify-between px-4 max-w-md mx-auto"
        style={{ paddingTop: "calc(var(--safe-top) + 0.75rem)", paddingBottom: "0.5rem" }}
      >
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl">🥚</span>
          <span className="font-display text-sm tracking-widest text-[var(--gold)]">MEGA GAME</span>
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
                  className="w-8 h-8 rounded-full border-2 border-[var(--gold)]"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-xs font-bold">
                  {(user.displayName ?? user.email ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
            </button>
          ) : (
            <GameButton size="md" onClick={signIn} className="!py-1.5 !px-3 text-[11px]">
              Sign in
            </GameButton>
          )}

          {menuOpen && user && (
            <GamePanel className="absolute right-0 mt-2 w-40 p-2 z-20 flex flex-col gap-1 rounded-xl">
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
            </GamePanel>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 flex flex-col items-center w-full max-w-md mx-auto">{children}</main>

      <nav
        className="w-full max-w-md mx-auto px-4"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 0.5rem)", paddingTop: "0.5rem" }}
      >
        <GamePanel className="rounded-2xl p-2">
          <div className="grid grid-cols-4 gap-1">
            {NAV.map(({ href, label, Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-colors ${
                    active ? "bg-white/5" : ""
                  }`}
                >
                  <Icon active={active} />
                  <span
                    className={`text-[9px] font-semibold tracking-wide ${
                      active ? "text-[var(--gold)]" : "text-[var(--text-dim)]"
                    }`}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </GamePanel>
      </nav>
    </div>
  );
}

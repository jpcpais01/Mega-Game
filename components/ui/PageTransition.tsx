"use client";

import { usePathname } from "next/navigation";

// Keying on pathname forces a remount on navigation, replaying the CSS
// "zoom into place" animation — makes moving between pages feel like
// arriving somewhere rather than a flat page swap. Enter-only (no exit
// animation) keeps this dependency-free.
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter w-full flex-1 flex flex-col items-center">
      {children}
    </div>
  );
}

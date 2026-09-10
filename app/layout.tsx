import type { Metadata, Viewport } from "next";
import { Cinzel, Outfit } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import GameShell from "@/components/GameShell";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import PageTransition from "@/components/ui/PageTransition";
import WorldBackdrop from "@/components/ui/WorldBackdrop";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Mega Game — Essence Forge",
  description: "Combine elemental essences to forge and hatch your own monster.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mega Game",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#07060f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} ${cinzel.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <WorldBackdrop />
        <AuthProvider>
          <GameShell>
            <PageTransition>{children}</PageTransition>
          </GameShell>
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

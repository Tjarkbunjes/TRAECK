import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { PWAInstall } from "@/components/PWAInstall";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TRÆCK",
  description: "Track calories, workouts & weight",
  manifest: "/manifest.json",
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TRÆCK",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0A0A0A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased font-sans`}
      >
        <main className="pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] min-h-screen">
          {children}
          <div className="flex justify-center py-6">
            <span className="text-sm text-muted-foreground/60 tracking-[0.15em]">TR&AElig;CK</span>
          </div>
        </main>
        <BottomNav />
        <PWAInstall />
        <Toaster />
      </body>
    </html>
  );
}

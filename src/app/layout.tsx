import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Asap } from "next/font/google";
import { THEME_COLOR, THEME_INIT_SCRIPT } from "@/lib/theme";
import ThemeSync from "@/components/ui/ThemeSync";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

const asap = Asap({
  variable: "--font-asap",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Ośmiornica",
  description: "Profesjonalna aplikacja do darta",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ośmiornica",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: THEME_COLOR.odswiezony,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${geist.variable} ${geistMono.variable} ${asap.variable} h-full`}
      // data-theme ustawia skrypt przed hydracją
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col antialiased mesh-bg">
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}

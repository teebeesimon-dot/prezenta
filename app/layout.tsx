import type { Metadata, Viewport } from "next";
import { Poppins, Geist_Mono } from "next/font/google";
import { AppHeader } from "@/components/AuthButton";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthProvider";
import { env } from "@/lib/env";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appDescription =
  "Vezi cine vine. Joacă mai mult. Organizează rapid activități sportive și vezi în timp real cine participă.";

const metadataBase = new URL(
  env.appUrl ?? "https://ne-adunam.vercel.app"
);

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "prezenta",
    template: "%s | prezenta",
  },
  description: appDescription,
  applicationName: "prezenta",
  keywords: [
    "activități sportive",
    "prezență",
    "echipe",
    "organizare",
    "România",
  ],
  authors: [{ name: "prezenta" }],
  creator: "prezenta",
  openGraph: {
    type: "website",
    locale: "ro_RO",
    siteName: "prezenta",
    title: "prezenta — Vezi cine vine. Joacă mai mult.",
    description: appDescription,
    url: metadataBase,
  },
  twitter: {
    card: "summary",
    title: "prezenta — Vezi cine vine. Joacă mai mult.",
    description: appDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ro"
      suppressHydrationWarning
      className={`${poppins.variable} ${geistMono.variable} h-full bg-background antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <AppHeader />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@repo/shared-contexts";
import { SpotifyPlayerProvider } from "@repo/shared-contexts";
import { Header } from "@repo/shared-ui";
import { ThemeProvider } from "@repo/shared-contexts";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mixtape In A Bottle",
  description: "Share Spotify playlists with strangers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
    >
      <body className="h-full bg-spotify-light-dark dark:bg-spotify-dark font-sans">
        <ThemeProvider>
          <AuthProvider>
            <SpotifyPlayerProvider>
              <div className="flex flex-col h-full">
                <Header />
                <main className="flex-grow overflow-y-auto">{children}</main>
              </div>
            </SpotifyPlayerProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthContext";
import { ChatProvider } from "@/components/ChatContext";
import { BottomNav } from "@/components/BottomNav";

export const viewport: Viewport = {
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "TrackRight",
  description: "Track food, macros, weight, and steps with TrackRight.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "TrackRight",
  },
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){document.documentElement.setAttribute('style','background-color:#020617 !important');document.write('<style>*{background-color:#020617}html,body{background-color:#020617 !important;min-height:100vh}</style>');})()` }} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* iPhone 16 Pro Max — exact pixel match required for iOS to use it */}
        <link rel="apple-touch-startup-image" href="/apple-splash-1290-2796.png" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        {/* Generic fallback for all other devices */}
        <link rel="apple-touch-startup-image" href="/splash.png" />
      </head>
      <body className="safe-iphone bg-slate-950 text-slate-50">
        <AuthProvider>
          <ChatProvider>
            <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-24">
              {children}
            </div>
            <BottomNav />
          </ChatProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

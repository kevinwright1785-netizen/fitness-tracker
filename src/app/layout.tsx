import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthContext";
import { ChatProvider } from "@/components/ChatContext";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "TrackRight",
  description: "Track food, macros, weight, and steps with TrackRight.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
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

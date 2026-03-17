import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthContext";

export const metadata: Metadata = {
  title: "TrackRight",
  description: "Track food, macros, weight, and steps with TrackRight."
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
          <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-4">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}

"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type AuthContextValue = {
  user: any | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function init() {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const {
        data: { user }
      } = await supabase.auth.getUser();
      setUser(user ?? null);
      setLoading(false);
    }
    init();

    if (!supabase) return;
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const publicPaths = ["/login", "/signup"];
    if (!user && !publicPaths.includes(pathname)) {
      router.replace("/login");
    }
    if (user && publicPaths.includes(pathname)) {
      router.replace("/");
    }
  }, [user, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}


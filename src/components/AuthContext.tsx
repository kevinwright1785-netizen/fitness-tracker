"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type AuthContextValue = {
  user: any | null;
  loading: boolean;
  onboardingComplete: boolean;
  completeOnboarding: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
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
      const currentUser = user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_complete")
          .eq("id", currentUser.id)
          .maybeSingle();
        setOnboardingComplete(profile?.onboarding_complete ?? false);
      } else {
        setOnboardingComplete(false);
      }
      setLoading(false);
    }
    init();

    if (!supabase) return;
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      const nextUser = session?.user ?? null;
      if (!nextUser) {
        // Clear greeting flag so it shows again on the next login
        sessionStorage.removeItem("splashShown");
        setUser(null);
        setOnboardingComplete(false);
      } else {
        // Block the redirect effect until we know onboarding status.
        setLoading(true);
        setUser(nextUser);
        supabase
          .from("profiles")
          .select("onboarding_complete")
          .eq("id", nextUser.id)
          .maybeSingle()
          .then(({ data: profile }: { data: any }) => {
            setOnboardingComplete(profile?.onboarding_complete ?? false);
            setLoading(false);
          });
      }
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
      router.replace(onboardingComplete ? "/" : "/onboarding");
    }

    if (user && !onboardingComplete && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [user, loading, pathname, router, onboardingComplete]);

  function completeOnboarding() {
    setOnboardingComplete(true);
  }

  return (
    <AuthContext.Provider value={{ user, loading, onboardingComplete, completeOnboarding }}>
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


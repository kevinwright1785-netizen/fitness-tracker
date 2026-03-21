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

// Synchronously read cached Supabase user from localStorage so the app
// renders immediately with auth state on PWA launch instead of blank screen.
function getCachedUser(): any | null {
  if (typeof window === "undefined") return null;
  try {
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token")
    );
    if (key) {
      const parsed = JSON.parse(localStorage.getItem(key) ?? "{}");
      return parsed?.user ?? null;
    }
  } catch {}
  return null;
}

function getCachedOnboardingComplete(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("onboarding_complete") === "true";
  } catch {}
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const cachedUser = getCachedUser();
  const [user, setUser] = useState<any | null>(cachedUser);
  // If we have a cached user, skip the loading state entirely — render immediately
  // and verify the session in the background.
  const [loading, setLoading] = useState(!cachedUser);
  const [onboardingComplete, setOnboardingComplete] = useState(getCachedOnboardingComplete);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function init() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      // getSession() reads from localStorage when the token is fresh.
      // When the token is expired (e.g. app unopened for 10+ hours) it makes a
      // network call to refresh — that's the slow path we're working around.
      const {
        data: { session }
      } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;

      if (!currentUser) {
        // Background verification failed — session expired or never existed.
        setUser(null);
        setOnboardingComplete(false);
        localStorage.removeItem("onboarding_complete");
        setLoading(false);
        return;
      }

      // Session is valid. Fetch onboarding status and cache it for next launch.
      setUser(currentUser);
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("id", currentUser.id)
        .maybeSingle();
      const complete = profile?.onboarding_complete ?? false;
      setOnboardingComplete(complete);
      localStorage.setItem("onboarding_complete", complete ? "true" : "false");
      setLoading(false);
    }
    init();

    if (!supabase) return;
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      const nextUser = session?.user ?? null;
      if (!nextUser) {
        // Clear greeting timestamp so it shows again on the next login
        localStorage.removeItem("greetingShownAt");
        localStorage.removeItem("onboarding_complete");
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
            const complete = profile?.onboarding_complete ?? false;
            setOnboardingComplete(complete);
            localStorage.setItem("onboarding_complete", complete ? "true" : "false");
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
    localStorage.setItem("onboarding_complete", "true");
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

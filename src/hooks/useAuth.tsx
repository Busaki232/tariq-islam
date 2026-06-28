// src/hooks/useAuth.tsx
import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  emailConfirmed: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phoneNumber?: string,
    location?: string,
    captchaToken?: string
  ) => Promise<{ error: any }>;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const { toast } = useToast();
  const { t } = useTranslation(["common", "auth", "privateChat", "chat", "navigation"]);

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  const isMountedRef = useRef(false);

  const safeToast = (toastOptions: Parameters<typeof toast>[0]) => {
    if (!isMountedRef.current) return;
    try {
      toast(toastOptions);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    let maxLoadingTimeout: number | null = null;

    const initAuth = () => {
      // 1) Listen to auth changes
      const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setEmailConfirmed(!!nextSession?.user?.email_confirmed_at);
        setLoading(false);

        // ✅ Onboarding once per user (post-sign-in)
        if (event === "SIGNED_IN" && nextSession?.user?.email_confirmed_at) {
          try {
            // bump v1 -> v2 later if you ever want to show it again after a change
            const onboardingKey = `onboarding_private_chat_v1_${nextSession.user.id}`;
            const alreadyShown = localStorage.getItem(onboardingKey) === "1";

            if (!alreadyShown) {
              safeToast({
                title: t("onboarding.chat.title", {
                  ns: "privateChat",
                  defaultValue: "Private chat",
                }),
                description: t("onboarding.chat.desc", {
                  ns: "privateChat",
                  defaultValue:
                    "Go to Messages, tap New Chat to invite by username, then check Requests to accept new connections.",
                }),
              });

              localStorage.setItem(onboardingKey, "1");
            }
          } catch {
            // ignore
          }
        }
      });

      subscription = data.subscription;

      // 2) Hydrate existing session
      supabase.auth
        .getSession()
        .then(({ data: { session: existing } }) => {
          setSession(existing);
          setUser(existing?.user ?? null);
          setEmailConfirmed(!!existing?.user?.email_confirmed_at);
          setLoading(false);
        })
        .catch((error) => {
          console.error("[useAuth] Failed to get session:", error);
          setLoading(false);
        });

      // 3) Safety timeout
      maxLoadingTimeout = window.setTimeout(() => setLoading(false), 5000);
    };

    const isNativeApp = typeof (window as any).Capacitor !== "undefined";

    if (isNativeApp && "requestIdleCallback" in window) {
      (window as any).requestIdleCallback(initAuth, { timeout: 1000 });
    } else {
      initAuth();
    }

    return () => {
      subscription?.unsubscribe();
      if (maxLoadingTimeout) window.clearTimeout(maxLoadingTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    phoneNumber?: string,
    location?: string,
    captchaToken?: string
  ) => {
    try {
      setLoading(true);
      const redirectUrl = `${window.location.origin}/email-confirmed`;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          captchaToken,
          data: {
            full_name: fullName,
            phone_number: phoneNumber,
            location: location,
          },
        },
      });

      if (error) {
        safeToast({
          variant: "destructive",
          title: t("auth.signup_failed_title", { defaultValue: "Sign Up Failed" }),
          description: error.message,
        });
        return { error };
      }

      safeToast({
        title: t("auth.signup_success_title", { defaultValue: "Account Created Successfully!" }),
        description: t("auth.signup_success_desc", {
          defaultValue:
            "We've sent a confirmation link to your email. Please check your inbox and click the link to verify your account before signing in.",
        }),
      });

      return { error: null };
    } catch (error: any) {
      safeToast({
        variant: "destructive",
        title: t("auth.signup_failed_title", { defaultValue: "Sign Up Failed" }),
        description: String(error?.message ?? error),
      });
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string, captchaToken?: string) => {
    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken },
      });

      if (error) {
        const msg = error.message || "";

        if (msg.includes("Email not confirmed")) {
          safeToast({
            variant: "destructive",
            title: t("auth.email_not_confirmed_title", { defaultValue: "Email Not Confirmed" }),
            description: t("auth.email_not_confirmed_desc", {
              defaultValue: "Please check your email and click the confirmation link before signing in.",
            }),
          });
        } else {
          safeToast({
            variant: "destructive",
            title: t("auth.signin_failed_title", { defaultValue: "Sign In Failed" }),
            description: msg,
          });
        }

        return { error };
      }

      return { error: null };
    } catch (error: any) {
      safeToast({
        variant: "destructive",
        title: t("auth.signin_failed_title", { defaultValue: "Sign In Failed" }),
        description: String(error?.message ?? error),
      });
      return { error };
    } finally {
      setLoading(false);
    }
  };

const signOut = async () => {
  setLoading(true);

  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (error) {
    console.log("[Auth] signOut failed, forcing local logout:", error);
  } finally {
    localStorage.removeItem("sb-enevjiodbmngnkwkwuud-auth-token");
    setUser(null);
    setSession(null);
    setLoading(false);
    window.location.replace("/");
  }
};

  const resendConfirmation = async (email: string) => {
    try {
      setLoading(true);

      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/email-confirmed` },
      });

      if (error) {
        safeToast({
          variant: "destructive",
          title: t("auth.resend_failed_title", { defaultValue: "Resend Failed" }),
          description: error.message,
        });
        return { error };
      }

      safeToast({
        title: t("auth.resend_success_title", { defaultValue: "Confirmation Email Sent!" }),
        description: t("auth.resend_success_desc", { defaultValue: "Please check your email for the new confirmation link." }),
      });

      return { error: null };
    } catch (error: any) {
      safeToast({
        variant: "destructive",
        title: t("auth.resend_failed_title", { defaultValue: "Resend Failed" }),
        description: String(error?.message ?? error),
      });
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    emailConfirmed,
    signUp,
    signIn,
    signOut,
    resendConfirmation,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
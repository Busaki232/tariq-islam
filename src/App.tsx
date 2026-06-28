// src/App.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserRouter,
  HashRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import { Preferences } from "@capacitor/preferences";

import { supabase } from "@/integrations/supabase/client";

import OnlinePresenceTracker from "@/components/OnlinePresenceTracker";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import ScrollToTop from "@/components/ScrollToTop";
import TopBackBar from "@/components/TopBackBar";
import BottomNav from "@/components/BottomNav";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { IncomingCallScreen } from "@/components/IncomingCallScreen";
import { loadAdhanSettings, scheduleAdhanForToday } from "@/services/adhanNotifications";

import { useAuth } from "@/hooks/useAuth";
import { useActiveCall } from "@/hooks/useActiveCall";

import { VideoCallScreen } from "@/components/VideoCallScreen";
import { AudioCallScreen } from "@/components/AudioCallScreen";

import PendingRequests from "@/pages/PendingRequests";
import Notifications from "@/pages/Notifications";

// Pages
import Index from "@/pages/Index";
import QuranPage from "@/pages/Quran";
import Auth from "@/pages/Auth";
import EmailConfirmed from "@/pages/EmailConfirmed";
import Advertisement from "@/pages/Advertisement";
import Mosques from "@/pages/Mosques";
import SubmitAd from "@/pages/SubmitAd";
import MyAds from "@/pages/MyAds";
import SubmitMosque from "@/pages/SubmitMosque";
import Events from "@/pages/Events";
import IslamicCalendar from "@/pages/IslamicCalendar";
import Dashboard from "@/pages/Dashboard";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import Qibla from "@/pages/Qibla";
import Tasbih from "@/pages/Tasbih";
import Admin from "@/pages/Admin";
import CommunityGuidelines from "@/pages/CommunityGuidelines";
import ModerationDashboard from "@/pages/ModerationDashboard";
import AntiExtremismEducation from "@/pages/AntiExtremismEducation";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import ChildSafetyPolicy from "@/pages/ChildSafetyPolicy";
import NotFound from "@/pages/NotFound";
import Community from "@/pages/Community";
import Chat from "@/pages/Chat";
import Support from "@/pages/Support";
import Contact from "@/pages/Contact";
import Partnerships from "@/pages/Partnerships";
import LeadershipApplication from "@/pages/LeadershipApplication";
import DeleteAccountPage from "@/pages/DeleteAccountPage";
import Connect from "@/pages/Connect";
import SplashScreen from "@/components/SplashScreen";

import DirectMessagePage from "@/pages/DirectMessagePage";
import PrivateMessaging from "@/components/PrivateMessaging";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

import CreateGroupPage from "@/pages/CreateGroupPage";
import GroupChatPage from "@/pages/GroupChatPage";
import ProfileConnections from "@/pages/ProfileConnections";

if (import.meta.env.DEV) {
  (window as any).supabase = supabase;
}

const queryClient = new QueryClient();

function DebugAuthId() {

  const { user } = useAuth();

  useEffect(() => {
    console.log("[AUTH_DEBUG] userId =", user?.id);
  }, [user?.id]);

  return null;
}

function normalizeCallUrlFromPushData(data: any): string | null {
  const callUrl = (data?.call_url ?? data?.deeplink ?? data?.url ?? "").toString().trim();

  if (callUrl) {
    if (callUrl.startsWith("tariqislam:")) {
      const idx = callUrl.indexOf(":/");
      const path = idx >= 0 ? callUrl.slice(idx + 2) : "";
      return path.startsWith("/") ? path : `/${path}`;
    }

    if (callUrl.startsWith("#/")) return callUrl.slice(1);
    if (callUrl.startsWith("/")) return callUrl;
    if (callUrl.startsWith("call?")) return `/${callUrl}`;
  }

  const inviteId = data?.inviteId ?? data?.invite_id ?? "";
  const roomUrl = data?.roomUrl ?? data?.room_url ?? "";
  const callType = (data?.callType ?? data?.call_type ?? "video") as "video" | "audio";
  const conversationId = data?.conversationId ?? data?.conversation_id ?? "";
  const callerId = data?.callerId ?? data?.caller_id ?? "";
  const callerName = data?.callerName ?? data?.caller_name ?? "";

  if (!inviteId || !roomUrl) return null;

  const sp = new URLSearchParams();
  sp.set("inviteId", String(inviteId));
  sp.set("roomUrl", String(roomUrl));
  sp.set("callType", String(callType));
  if (conversationId) sp.set("conversationId", String(conversationId));
  if (callerId) sp.set("callerId", String(callerId));
  if (callerName) sp.set("callerName", String(callerName));

  return `/call?${sp.toString()}`;
}

function goToCallUrl(url: string) {
  const safe = url.startsWith("/") ? url : `/${url}`;

  if (Capacitor.isNativePlatform()) {
    window.location.hash = safe;
  } else {
    window.location.href = safe;
  }
}

function CallRoute() {
  const { activeCall, startCall } = useActiveCall();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const returnToRef = useRef<string>("/");
  const hydratedSigRef = useRef<string | null>(null);

  const callType = (sp.get("callType") as "audio" | "video" | null) ?? null;
  const roomUrl = sp.get("roomUrl");
  const inviteId = sp.get("inviteId");
  const conversationId = sp.get("conversationId");

  const calleeId = sp.get("calleeId");
  const calleeName = sp.get("calleeName");
  const callerId = sp.get("callerId");
  const callerName = sp.get("callerName");

  const sig = useMemo(() => {
    return [
      callType || "",
      roomUrl || "",
      inviteId || "",
      conversationId || "",
      calleeId || "",
      calleeName || "",
      callerId || "",
      callerName || "",
    ].join("|");
  }, [callType, roomUrl, inviteId, conversationId, calleeId, calleeName, callerId, callerName]);

  useEffect(() => {
    const from = (location.state as any)?.from;
    if (typeof from === "string" && from.length > 0) {
      returnToRef.current = from;
    }
  }, [location.state]);

  useEffect(() => {
    if (activeCall) return;
    if (!callType || !roomUrl) return;
    if (hydratedSigRef.current === sig) return;

    hydratedSigRef.current = sig;

    const outgoing = !!calleeId;

    startCall({
      id: inviteId ?? undefined,
      callInviteId: inviteId ?? undefined,
      callType,
      roomUrl,
      conversationId: conversationId ?? null,
      otherUserId: outgoing ? calleeId ?? undefined : callerId ?? undefined,
      otherUserName: outgoing
        ? decodeURIComponent(calleeName || "User")
        : decodeURIComponent(callerName || "User"),
      callState: outgoing ? "calling" : "ringing",
    } as any);
  }, [
    activeCall,
    callType,
    roomUrl,
    sig,
    startCall,
    inviteId,
    conversationId,
    calleeId,
    calleeName,
    callerId,
    callerName,
  ]);

  useEffect(() => {
    if (activeCall) return;
    if (callType || roomUrl || inviteId) {
      navigate(returnToRef.current || "/", { replace: true });
    }
  }, [activeCall, navigate, callType, roomUrl, inviteId]);

  if (!activeCall && !callType && !roomUrl) {
    return <Navigate to="/" replace />;
  }

  if (!activeCall) return null;

  return activeCall.callType === "audio" ? <AudioCallScreen /> : <VideoCallScreen />;
}

function NativeUserIdSync() {
  useEffect(() => {
    if (Capacitor.getPlatform() !== "ios") return;

    const syncNow = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user?.id) {
          await Preferences.set({ key: "current_user_id", value: user.id });
          const verify = await Preferences.get({ key: "current_user_id" });
          console.log("[AUTH_DEBUG] saved current_user_id =", verify.value);
        } else {
          await Preferences.remove({ key: "current_user_id" });
          console.log("[AUTH_DEBUG] removed current_user_id");
        }
      } catch (e) {
        console.warn("[AUTH_DEBUG] current_user_id sync failed", e);
      }
    };

    void syncNow();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;

      if (uid) {
        void Preferences.set({ key: "current_user_id", value: uid }).then(async () => {
          const verify = await Preferences.get({ key: "current_user_id" });
          console.log("[AUTH_DEBUG] auth change saved current_user_id =", verify.value);
        });
      } else {
        void Preferences.remove({ key: "current_user_id" }).then(() => {
          console.log("[AUTH_DEBUG] auth change removed current_user_id");
        });
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  return null;
}

export default function App() {
    const [showSplash, setShowSplash] = useState(true);

    useEffect(() => {
      const timer = setTimeout(() => setShowSplash(false), 2800);
      return () => clearTimeout(timer);
    }, []);
  const Router = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

  useEffect(() => {
    const s = loadAdhanSettings();
    if (!s.enabled) return;
    void scheduleAdhanForToday(s);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    (async () => {
      try {
        await LocalNotifications.requestPermissions();
        await LocalNotifications.createChannel({
          id: "calls_v4",
          name: "Calls",
          description: "Incoming call alerts",
          importance: 5,
          visibility: 1,
          sound: "default",
          vibration: true,
        } as any);
      } catch (e) {
        console.warn("[Notifications] createChannel failed", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let subAction: any = null;
    let subReceive: any = null;
    let subReg: any = null;

    const logPushErr = (label: string, e: any) => {
      console.warn(label);
      console.warn(`${label} name=`, e?.name ?? null);
      console.warn(`${label} message=`, e?.message ?? null);
      console.warn(`${label} stack=`, e?.stack ?? null);
    };

    const savePushToken = async (value: string) => {
      if (!value) return;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user?.id) {
          console.warn("[Push] no user, storing pending token");
          await Preferences.set({ key: "pending_push_token", value });
          return;
        }

        const platform = Capacitor.getPlatform() === "android" ? "android" : "ios";
        const payload = {
          user_id: user.id,
          platform,
          token: value,
        };

        try {
          const { data, error } = await supabase.functions.invoke("save-push-token", {
            body: payload,
          });

          console.log("[Push] save-push-token data:", JSON.stringify(data));
          console.log("[Push] save-push-token error:", JSON.stringify(error));

          if (!error) {
            await Preferences.remove({ key: "pending_push_token" });
            console.log("[Push] token saved via function", value);
            return;
          }
        } catch (fnErr) {
          logPushErr("[Push] save-push-token invoke exception", fnErr);
        }

        const { error } = await supabase.from("push_tokens").upsert(
          {
            user_id: user.id,
            platform,
            token: value,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,platform",
          }
        );

        if (error) {
          console.warn("[Push] save failed", error);
          await Preferences.set({ key: "pending_push_token", value });
        } else {
          await Preferences.remove({ key: "pending_push_token" });
          console.log("[Push] token saved", value);
        }
      } catch (e) {
        logPushErr("[Push] token save exception", e);
        try {
          await Preferences.set({ key: "pending_push_token", value });
        } catch (prefErr) {
          logPushErr("[Push] pending token store failed", prefErr);
        }
      }
    };

    const setup = async () => {
      console.log("[Push] INIT START");

      subAction = await PushNotifications.addListener("pushNotificationActionPerformed", (ev: any) => {
        const data = ev?.notification?.data || {};
        const url = normalizeCallUrlFromPushData(data);
        if (!url) return;
        console.log("[Push] tap -> navigating to", url);
        goToCallUrl(url);
      });

      subReceive = await PushNotifications.addListener("pushNotificationReceived", (ev: any) => {
        console.log("[Push] received", ev);

        const data = ev?.notification?.data || {};
        const url = normalizeCallUrlFromPushData(data);
        if (!url) return;

        console.log("[Push] background -> navigating to", url);
        goToCallUrl(url);
      });

      subReg = await PushNotifications.addListener("registration", async (token: any) => {
        const value = String(token?.value || "").trim();
        console.log("[Push] TOKEN RECEIVED =", value);

        if (!value) return;
        await savePushToken(value);
      });

      await new Promise((r) => setTimeout(r, 500));

      try {
        await PushNotifications.requestPermissions();
        await PushNotifications.register();
        console.log("[Push] REGISTER CALLED");
      } catch (e) {
        logPushErr("[Push] register failed", e);
      }
    };

    void setup();

    return () => {
      try {
        subAction?.remove?.();
        subReceive?.remove?.();
        subReg?.remove?.();
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let mounted = true;

    const savePendingTokenForSignedInUser = async (userId: string, token: string) => {
      const platform = Capacitor.getPlatform() === "android" ? "android" : "ios";
      const payload = {
        user_id: userId,
        platform,
        token,
      };

      try {
        const { data, error } = await supabase.functions.invoke("save-push-token", {
          body: payload,
        });

        console.log("[Push] flush save-push-token data:", JSON.stringify(data));
        console.log("[Push] flush save-push-token error:", JSON.stringify(error));

        if (!error) {
          await Preferences.remove({ key: "pending_push_token" });
          console.log("[Push] pending token saved via function", token);
          return;
        }
      } catch (fnErr) {
        console.warn("[Push] flush function exception", fnErr);
      }

      const { error } = await supabase.from("push_tokens").upsert(
        {
          user_id: userId,
          platform,
          token,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,platform",
        }
      );

      if (error) {
        console.warn("[Push] pending save failed", error);
      } else {
        await Preferences.remove({ key: "pending_push_token" });
        console.log("[Push] pending token saved", token);
      }
    };

    const flushPendingPushToken = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user?.id || !mounted) return;

        const { value } = await Preferences.get({ key: "pending_push_token" });
        const pending = String(value || "").trim();

        if (!pending) return;

        console.log("[Push] flushing pending token", pending);
        await savePendingTokenForSignedInUser(user.id, pending);
      } catch (e) {
        console.warn("[Push] flush pending token failed", e);
      }
    };

    void flushPendingPushToken();

    const { data } = supabase.auth.onAuthStateChange(() => {
      void flushPendingPushToken();
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />

{showSplash && <SplashScreen />}

          <Router>
            <ScrollToTop />
            <OnlinePresenceTracker />
            <DebugAuthId />
            <NativeUserIdSync />

            <IncomingCallScreen />
    {/* <TopBackBar /> */}
     <div
       className="pb-20 md:pb-0"
       style={{
         paddingTop:
           window.location.pathname.startsWith("/messages") ||
           window.location.pathname.startsWith("/profile")
             ? "0px"
             : "calc(env(safe-area-inset-top) + 56px)",
       }}
     >
              <Routes>
                <Route path="/call" element={<CallRoute />} />

                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/email-confirmed" element={<EmailConfirmed />} />

                <Route path="/quran" element={<QuranPage />} />
                <Route path="/qibla" element={<Qibla />} />
                <Route path="/tasbih" element={<Tasbih />} />
                <Route path="/mosques" element={<Mosques />} />
                <Route path="/events" element={<Events />} />
                <Route path="/islamic-calendar" element={<IslamicCalendar />} />
                <Route path="/apply-leadership" element={<LeadershipApplication />} />
                <Route path="/delete-account" element={<DeleteAccountPage />} />

                <Route path="/chat-room" element={<Chat />} />
                <Route path="/community" element={<Community />} />

                <Route
                  path="/groups/new"
                  element={
                    <ProtectedRoute>
                      <AppErrorBoundary>
                        <CreateGroupPage />
                      </AppErrorBoundary>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/groups/:groupId"
                  element={
                    <ProtectedRoute>
                      <AppErrorBoundary>
                        <GroupChatPage />
                      </AppErrorBoundary>
                    </ProtectedRoute>
                  }
                />
<Route
  path="/profile/:userId/followers"
  element={
    <ProtectedRoute>
      <ProfileConnections type="followers" />
    </ProtectedRoute>
  }
/>

<Route
  path="/profile/:userId/following"
  element={
    <ProtectedRoute>
      <ProfileConnections type="following" />
    </ProtectedRoute>
  }
/>
<Route
  path="/notifications"
  element={
    <ProtectedRoute>
      <Notifications />
    </ProtectedRoute>
  }
/>
                <Route path="/marketplace" element={<Advertisement />} />

                <Route
                  path="/submit-ad"
                  element={
                    <ProtectedRoute>
                      <SubmitAd />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-ads"
                  element={
                    <ProtectedRoute>
                      <MyAds />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/submit-mosque"
                  element={
                    <ProtectedRoute>
                      <SubmitMosque />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  }
                />

    <Route
      path="/profile"
      element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      }
    />

    <Route
      path="/profile/:userId"
      element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      }
    />
                <Route
                  path="/messages/:otherUserId"
                  element={
                    <ProtectedRoute>
                      <AppErrorBoundary>
                        <DirectMessagePage />
                      </AppErrorBoundary>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/messages"
                  element={
                    <ProtectedRoute>
                      <AppErrorBoundary>
                        <PrivateMessaging />
                      </AppErrorBoundary>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/requests"
                  element={
                    <ProtectedRoute>
                      <PendingRequests />
                    </ProtectedRoute>
                  }
                />
                <Route path="/connect" element={<Connect />} />
                <Route path="/community-guidelines" element={<CommunityGuidelines />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/child-safety-policy" element={<ChildSafetyPolicy />} />
                <Route path="/anti-extremism" element={<AntiExtremismEducation />} />
                <Route path="/advertise" element={<Partnerships />} />
                <Route path="/business-listings" element={<Advertisement />} />
                <Route path="/support" element={<Support />} />
                <Route path="/contact" element={<Contact />} />

                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Admin />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/moderation"
                  element={
                    <ProtectedRoute requireAdmin>
                      <ModerationDashboard />
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>

    <BottomNav />
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
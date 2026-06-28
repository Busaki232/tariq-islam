// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@/i18n/config";

import { Capacitor } from "@capacitor/core";

// Providers
import { AuthProvider } from "@/hooks/useAuth";
import { ActiveCallProvider } from "@/hooks/useActiveCall";
import { IncomingCallProvider } from "@/hooks/useIncomingCall";

const isNative = Capacitor.isNativePlatform();

// Fast first paint background (no green here)
(function primeInitialBackground() {
  try {
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const bg = prefersDark ? "#0b0f14" : "#ffffff";

    document.documentElement.style.backgroundColor = bg;
    document.documentElement.style.colorScheme = prefersDark ? "dark" : "light";
    document.body && (document.body.style.backgroundColor = bg);

    const root = document.getElementById("root");
    if (root) (root as HTMLElement).style.backgroundColor = bg;
  } catch {}
})();

// Register Service Worker for Push Notifications (WEB ONLY)
if (!isNative && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

const appTree = (
  <AuthProvider>
    <ActiveCallProvider>
      <IncomingCallProvider>
        <App />
      </IncomingCallProvider>
    </ActiveCallProvider>
  </AuthProvider>
);

const rootEl = document.getElementById("root")!;
ReactDOM.createRoot(rootEl).render(
  isNative ? appTree : <React.StrictMode>{appTree}</React.StrictMode>
);
// capacitor.config.ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tariqislam.app",
  appName: "Tariq Islam",
  webDir: "dist",

  server: {
    allowNavigation: ["*.daily.co"],
  },

  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: false,
  },

  plugins: {
   SplashScreen: {
     launchShowDuration: 0,
     launchAutoHide: true,
     showSpinner: false,
   },
  },
};

export default config;
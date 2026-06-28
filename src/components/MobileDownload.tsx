// src/components/MobileDownload.tsx
import React from "react";

  const IOS_LINK = "#"; // or your App Store link later

export default function MobileDownload() {
  // If you truly want this removed entirely from the app UI,
  // return null and keep the file to avoid import errors:
  // return null;

  const openPlayStore = () => {
    window.open(PLAY_STORE_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="w-full py-10">
      <div className="mx-auto max-w-3xl px-4">
        <div className="rounded-2xl border bg-card p-6 text-center">
          <h2 className="text-2xl font-semibold">Get the app on Google Play</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Install securely from Google Play and receive automatic updates.
          </p>

          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={openPlayStore}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Get it on Google Play
            </button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            If you can&apos;t access Google Play, contact support for help.
          </p>
        </div>
      </div>
    </section>
  );
}
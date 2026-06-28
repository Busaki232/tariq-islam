package com.tariqislam.app;

import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends BridgeActivity {

    private static final int APP_BG = Color.WHITE;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().setBackgroundColor(APP_BG);
            }
            getWindow().getDecorView().setBackgroundColor(APP_BG);
        } catch (Exception ignored) {}

        try {
            enableLockScreenDisplay();
        } catch (Exception ignored) {}

        try {
            handlePossibleCallIntent(getIntent());
        } catch (Exception ignored) {}

        try {
            forceFetchFcmTokenForDebug();
        } catch (Exception e) {
            Log.e("CALL_FCM", "forceFetchFcmTokenForDebug failed", e);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);

        try {
            enableLockScreenDisplay();
        } catch (Exception ignored) {}

        try {
            handlePossibleCallIntent(intent);
        } catch (Exception ignored) {}

        try {
            if (bridge != null && bridge.getWebView() != null && intent != null && intent.getData() != null) {
                bridge.getWebView().post(() -> bridge.getWebView().reload());
            }
        } catch (Exception ignored) {}
    }

    private void enableLockScreenDisplay() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                            | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                            | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }

        getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                        | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        );
    }

    private void handlePossibleCallIntent(Intent intent) {
        if (intent == null) return;

        Uri data = intent.getData();
        if (data != null) return;

        Bundle extras = intent.getExtras();
        if (extras == null) return;

        String callUrl = null;

        if (extras.containsKey("call_url")) callUrl = extras.getString("call_url");
        else if (extras.containsKey("deeplink")) callUrl = extras.getString("deeplink");
        else if (extras.containsKey("url")) callUrl = extras.getString("url");

        if (callUrl == null) return;

        callUrl = callUrl.trim();
        if (callUrl.isEmpty()) return;

        if (callUrl.startsWith("#/")) callUrl = callUrl.substring(1);

        if (callUrl.startsWith("/call?")) {
            callUrl = "tariqislam://call?" + callUrl.substring("/call?".length());
        }

        if (callUrl.equals("/call")) callUrl = "tariqislam://call";

        if (callUrl.startsWith("call?")) {
            callUrl = "tariqislam://call?" + callUrl.substring("call?".length());
        }

        if (callUrl.startsWith("tariqislam://")) {
            Uri uri = Uri.parse(callUrl);
            intent.setData(uri);
        }
    }

    private void forceFetchFcmTokenForDebug() {
        FirebaseMessaging.getInstance().getToken()
                .addOnCompleteListener(task -> {
                    if (!task.isSuccessful()) {
                        Log.e("CALL_FCM", "FCM getToken failed", task.getException());
                        return;
                    }

                    String token = task.getResult();
                    Log.d("CALL_FCM", "Forced FCM token: " + token);
                });
    }
}
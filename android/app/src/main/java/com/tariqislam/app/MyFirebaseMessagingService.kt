package com.tariqislam.app

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class MyFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val CALLS_CHANNEL_ID = "calls_v4"
        private const val CALL_NOTIFICATION_ID = 9001
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("CALL_FCM", "New FCM token: $token")
        Thread {
            savePushTokenToBackend(token, 0)
        }.start()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val data = message.data
        Log.d("CALL_FCM", "Push received with data: $data")

        val type = data["type"] ?: ""
        if (type != "incoming_call") {
            Log.d("CALL_FCM", "Ignoring non-call push")
            return
        }

        createCallsChannel()

        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            val wl = pm.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK or
                        PowerManager.ACQUIRE_CAUSES_WAKEUP or
                        PowerManager.ON_AFTER_RELEASE,
                "tariqislam:incoming_call_wakelock"
            )
            wl.acquire(3000)
        } catch (e: Exception) {
            Log.w("CALL_FCM", "WakeLock failed", e)
        }

        val inviteId = data["inviteId"] ?: ""
        val roomUrl = data["roomUrl"] ?: ""
        val callType = data["callType"] ?: "video"
        val conversationId = data["conversationId"] ?: ""
        val callerId = data["callerId"] ?: ""
        val callerName = data["callerName"] ?: "Incoming call"

        val deepLink = Uri.parse(
            "tariqislam:/call" +
                    "?inviteId=${Uri.encode(inviteId)}" +
                    "&roomUrl=${Uri.encode(roomUrl)}" +
                    "&callType=${Uri.encode(callType)}" +
                    "&conversationId=${Uri.encode(conversationId)}" +
                    "&callerId=${Uri.encode(callerId)}" +
                    "&callerName=${Uri.encode(callerName)}"
        )

        val launchIntent = Intent(Intent.ACTION_VIEW, deepLink).apply {
            setPackage(packageName)
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
            )
        }

        val fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            1001,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or pendingIntentMutableFlag()
        )

        val ringtoneUri = Settings.System.DEFAULT_RINGTONE_URI
        val ringtoneAudioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        val notification = NotificationCompat.Builder(this, CALLS_CHANNEL_ID)
            .setSmallIcon(applicationInfo.icon)
            .setContentTitle("Incoming ${callType.replaceFirstChar { it.uppercase() }} call")
            .setContentText("from $callerName")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(false)
            .setOngoing(true)
            .setSound(ringtoneUri)
            .setDefaults(Notification.DEFAULT_ALL)
            .setVibrate(longArrayOf(0, 1000, 1000, 1000))
            .setContentIntent(fullScreenPendingIntent)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .build().also { notif ->
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                    @Suppress("DEPRECATION")
                    notif.audioAttributes = ringtoneAudioAttributes
                }
            }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (
                ActivityCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                Log.w("CALL_FCM", "POST_NOTIFICATIONS not granted")
                return
            }
        }

        NotificationManagerCompat.from(this).notify(CALL_NOTIFICATION_ID, notification)
        Log.d("CALL_FCM", "Incoming call notification shown")
    }

    private fun createCallsChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val soundUri = Settings.System.DEFAULT_RINGTONE_URI
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            val channel = NotificationChannel(
                CALLS_CHANNEL_ID,
                "Calls",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Incoming call alerts"
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 1000, 1000, 1000)
                enableLights(true)
                setSound(soundUri, audioAttributes)
            }

            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun pendingIntentMutableFlag(): Int {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_MUTABLE
        } else {
            0
        }
    }

    private fun getCurrentUserId(): String? {
        val candidates = listOf(
            getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE),
            getSharedPreferences("CapacitorPreferences", Context.MODE_PRIVATE),
            getSharedPreferences("${packageName}_preferences", Context.MODE_PRIVATE)
        )

        val keys = listOf(
            "current_user_id",
            "CapacitorStorage.current_user_id",
            "CapacitorPreferences.current_user_id"
        )

        for (prefs in candidates) {
            for (key in keys) {
                val value = prefs.getString(key, null)
                if (!value.isNullOrBlank()) {
                    Log.d("CALL_FCM", "Found current_user_id in ${prefsName(prefs)} key=$key")
                    return value
                }
            }
        }

        return null
    }

    private fun prefsName(prefs: SharedPreferences): String {
        return prefs.toString()
    }

    private fun savePushTokenToBackend(token: String, attempt: Int) {
        try {
            val userId = getCurrentUserId()

            if (userId.isNullOrBlank()) {
                if (attempt < 10) {
                    Log.w(
                        "CALL_FCM",
                        "No current_user_id yet, retrying push token save in 1s (attempt ${attempt + 1})"
                    )
                    Thread.sleep(1000)
                    savePushTokenToBackend(token, attempt + 1)
                } else {
                    Log.e("CALL_FCM", "No current_user_id found after retries, giving up Android token save")
                }
                return
            }

            val appInfo = packageManager.getApplicationInfo(packageName, PackageManager.GET_META_DATA)
            val meta = appInfo.metaData

            val supabaseUrl = meta?.getString("SUPABASE_URL")
            val anonKey = meta?.getString("SUPABASE_ANON_KEY")

            if (supabaseUrl.isNullOrBlank() || anonKey.isNullOrBlank()) {
                Log.e("CALL_FCM", "Missing SUPABASE_URL or SUPABASE_ANON_KEY in AndroidManifest meta-data")
                return
            }

            val url = URL("$supabaseUrl/functions/v1/save-push-token")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("apikey", anonKey)
            conn.setRequestProperty("Authorization", "Bearer $anonKey")

            val body = JSONObject().apply {
                put("user_id", userId)
                put("token", token)
                put("platform", "android")
            }

            OutputStreamWriter(conn.outputStream).use { writer ->
                writer.write(body.toString())
                writer.flush()
            }

            val status = conn.responseCode
            val responseText = try {
                BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
            } catch (_: Exception) {
                try {
                    BufferedReader(InputStreamReader(conn.errorStream)).use { it.readText() }
                } catch (_: Exception) {
                    ""
                }
            }

            Log.d("CALL_FCM", "save-push-token status: $status")
            Log.d("CALL_FCM", "save-push-token response: $responseText")
            conn.disconnect()
        } catch (e: Exception) {
            Log.e("CALL_FCM", "save-push-token request failed: ${e.message}", e)
        }
    }
}
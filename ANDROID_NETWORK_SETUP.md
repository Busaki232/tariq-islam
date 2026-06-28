# Android Network Configuration Guide

This guide fixes the "Unable to resolve host" DNS error on Android devices for the Tariq Islam app.

## The Problem

Android apps require explicit Network Security Configuration to connect to external servers. Without it, you'll see errors like:
```
Unable to resolve host "enevjiodbmngnkwkwuud.supabase.co": No address associated with hostname
```

## Solution

Follow these steps on your local machine after running `npx cap add android`.

---

## Step 1: Create Network Security Configuration

Create the file: `android/app/src/main/res/xml/network_security_config.xml`

First, create the `xml` directory if it doesn't exist:
```bash
mkdir -p android/app/src/main/res/xml
```

Then create the file with this content:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Allow cleartext for development (hot reload) -->
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    
    <!-- Supabase Backend -->
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">supabase.co</domain>
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </domain-config>
    
    <!-- Daily.co Video Calls -->
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">daily.co</domain>
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </domain-config>
    
    <!-- Lovable Preview (Development Hot Reload) -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">lovableproject.com</domain>
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </domain-config>
</network-security-config>
```

---

## Step 2: Update AndroidManifest.xml

Open `android/app/src/main/AndroidManifest.xml` and update the `<application>` tag:

### Before:
```xml
<application
    android:allowBackup="true"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/app_name"
    ...>
```

### After:
```xml
<application
    android:allowBackup="true"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/app_name"
    android:networkSecurityConfig="@xml/network_security_config"
    android:usesCleartextTraffic="true"
    ...>
```

### Also verify these permissions exist (inside `<manifest>`, before `<application>`):

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

---

## Step 3: Rebuild the App

Run these commands in order:

```bash
# Sync Capacitor changes
npx cap sync android

# Run on device/emulator
npx cap run android
```

---

## Complete AndroidManifest.xml Example

Here's a complete example of what your `AndroidManifest.xml` should look like:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Network permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    
    <!-- Camera and Microphone for video calls -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
    
    <!-- Notifications -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:networkSecurityConfig="@xml/network_security_config"
        android:usesCleartextTraffic="true">

        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
    </application>
</manifest>
```

---

## Troubleshooting

### Still getting DNS errors?
1. Uninstall the app from device/emulator
2. Run `npx cap sync android` again
3. Reinstall with `npx cap run android`

### Network timeout errors?
- Check your device has internet connectivity
- Verify the Supabase project is running
- Check Android Studio logcat for detailed errors

### Video calls not connecting?
- Ensure Daily.co domain is in network_security_config.xml
- Check camera/microphone permissions are granted
- See `ANDROID_PERMISSIONS_SETUP.md` for permission setup

---

## Related Documentation

- [ANDROID_PERMISSIONS_SETUP.md](./ANDROID_PERMISSIONS_SETUP.md) - Camera, microphone, and notification permissions
- [Capacitor Android Documentation](https://capacitorjs.com/docs/android)
- [Android Network Security Configuration](https://developer.android.com/training/articles/security-config)

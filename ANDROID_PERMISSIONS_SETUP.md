# Android Permissions Setup Guide

This guide explains how to configure Android permissions for the Tariq Islam app after running `npx cap add android`.

> **Important:** If you're getting "Unable to resolve host" DNS errors, see [ANDROID_NETWORK_SETUP.md](./ANDROID_NETWORK_SETUP.md) for network configuration.

## Required Permissions

After running `npx cap add android`, you need to manually add the following permissions to your `android/app/src/main/AndroidManifest.xml` file.

### Step 1: Open AndroidManifest.xml

Navigate to: `android/app/src/main/AndroidManifest.xml`

### Step 2: Add Required Permissions

Add these permissions inside the `<manifest>` tag, before the `<application>` tag:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    
    <!-- Internet access (required for API calls and video calls) -->
    <uses-permission android:name="android.permission.INTERNET" />
    
    <!-- Camera access (for video calls) -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
    
    <!-- Microphone access (for audio/video calls) -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    
    <!-- Notifications (Android 13+) -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    
    <!-- Keep device awake during calls -->
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    
    <!-- Background call service -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    
    <!-- Network state (for connection status) -->
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    
    <application
        ...
    </application>
</manifest>
```

### Permissions to Remove

If present, remove these sensitive permissions that are not needed:

```xml
<!-- REMOVE THESE IF PRESENT -->
<uses-permission android:name="android.permission.READ_CONTACTS" />
<uses-permission android:name="android.permission.WRITE_CONTACTS" />
<uses-permission android:name="android.permission.READ_CALL_LOG" />
<uses-permission android:name="android.permission.WRITE_CALL_LOG" />
<uses-permission android:name="android.permission.READ_PHONE_STATE" />
<uses-permission android:name="android.permission.READ_SMS" />
<uses-permission android:name="android.permission.SEND_SMS" />
```

### Step 3: Sync and Rebuild

After adding permissions, run:

```bash
npx cap sync android
npx cap run android
```

## Permission Behavior

### Runtime Permissions

Android requires runtime permission requests for sensitive permissions. The app handles this automatically:

1. **Camera Permission**: Requested when starting a video call
2. **Microphone Permission**: Requested when starting any call (audio or video)
3. **Notification Permission**: Requested for incoming call alerts (Android 13+)

### If Permissions Are Denied

If a user denies a permission, the app will:
1. Show a toast notification explaining why the permission is needed
2. Provide instructions to enable the permission in Settings

Users can manually enable permissions at:
**Settings > Apps > Tariq Islam > Permissions**

## Troubleshooting

### "No permission requested" Error

This error occurs when:
1. Permissions are not declared in `AndroidManifest.xml`
2. The Capacitor plugin is not properly initialized
3. The app is trying to access features before the native bridge is ready

**Solution**: Ensure all permissions are added to `AndroidManifest.xml` and run `npx cap sync android`.

### Permissions Grayed Out in Settings

If permissions appear grayed out in the app settings:
1. Check that permissions are properly declared in `AndroidManifest.xml`
2. Reinstall the app after adding permissions
3. Ensure `<uses-feature>` tags have `android:required="false"`

### Camera/Microphone Not Working

1. Check that the device has the hardware (camera, microphone)
2. Verify another app isn't using the camera/microphone
3. Restart the app after granting permissions

## iOS Setup (Info.plist)

For iOS, add these usage descriptions to `ios/App/App/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Tariq Islam needs camera access for video calls</string>

<key>NSMicrophoneUsageDescription</key>
<string>Tariq Islam needs microphone access for voice and video calls</string>
```

## Testing Permissions

To test that permissions are working correctly:

1. Install the app on a device/emulator
2. Go to **Settings > Apps > Tariq Islam > Permissions**
3. Verify Camera and Microphone toggles are visible (not grayed out)
4. Try starting a video call - the app should prompt for camera and microphone access

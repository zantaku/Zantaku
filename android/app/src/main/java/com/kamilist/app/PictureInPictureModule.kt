package com.kamilist.app

import android.app.PictureInPictureParams
import android.content.pm.PackageManager
import android.os.Build
import android.util.Rational
import androidx.annotation.RequiresApi
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class PictureInPictureModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val MODULE_NAME = "PictureInPictureModule"
        private const val EVENT_PIP_MODE_CHANGED = "onPictureInPictureModeChanged"
    }

    override fun getName(): String {
        return MODULE_NAME
    }

    @ReactMethod
    fun enterPictureInPicture(aspectRatioWidth: Int, aspectRatioHeight: Int, promise: Promise) {
        val activity = currentActivity

        if (activity == null) {
            promise.reject("ACTIVITY_NOT_FOUND", "Activity is null")
            return
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.reject("API_NOT_SUPPORTED", "Picture-in-Picture requires Android 8.0 (API 26) or higher")
            return
        }

        if (!activity.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)) {
            promise.reject("PIP_NOT_SUPPORTED", "Device does not support Picture-in-Picture")
            return
        }

        try {
            UiThreadUtil.runOnUiThread {
                try {
                    enterPipMode(activity as MainActivity, aspectRatioWidth, aspectRatioHeight)
                    promise.resolve(true)
                } catch (e: Exception) {
                    promise.reject("ENTER_PIP_FAILED", "Failed to enter PiP mode: ${e.message}", e)
                }
            }
        } catch (e: Exception) {
            promise.reject("ENTER_PIP_FAILED", "Failed to enter PiP mode: ${e.message}", e)
        }
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private fun enterPipMode(activity: MainActivity, aspectRatioWidth: Int, aspectRatioHeight: Int) {
        val rational = try {
            // Validate aspect ratio values
            if (aspectRatioWidth <= 0 || aspectRatioHeight <= 0) {
                Rational(16, 9) // Default to 16:9
            } else {
                Rational(aspectRatioWidth, aspectRatioHeight)
            }
        } catch (e: Exception) {
            Rational(16, 9) // Default to 16:9 if invalid
        }

        val params = PictureInPictureParams.Builder()
            .setAspectRatio(rational)
            .build()

        activity.enterPictureInPictureMode(params)
    }

    @ReactMethod
    fun isPipSupported(promise: Promise) {
        try {
            val activity = currentActivity
            if (activity == null) {
                promise.resolve(false)
                return
            }

            val supported = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                activity.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)
            } else {
                false
            }

            promise.resolve(supported)
        } catch (e: Exception) {
            promise.reject("PIP_CHECK_FAILED", "Failed to check PiP support: ${e.message}", e)
        }
    }

    @ReactMethod
    fun isPipActive(promise: Promise) {
        try {
            val activity = currentActivity
            if (activity == null) {
                promise.resolve(false)
                return
            }

            val isInPip = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                activity.isInPictureInPictureMode
            } else {
                false
            }

            promise.resolve(isInPip)
        } catch (e: Exception) {
            promise.reject("PIP_STATUS_FAILED", "Failed to check PiP status: ${e.message}", e)
        }
    }

    fun sendPipModeChangedEvent(isInPictureInPictureMode: Boolean) {
        val params = Arguments.createMap()
        params.putBoolean("isInPictureInPictureMode", isInPictureInPictureMode)
        
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_PIP_MODE_CHANGED, params)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Keep: Required for RN built-in Event Emitter Calls
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Keep: Required for RN built-in Event Emitter Calls
    }
}

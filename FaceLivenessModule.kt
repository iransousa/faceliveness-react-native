package br.com.example.app

import android.content.Intent
import android.util.Log
import com.amplifyframework.core.Amplify
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class FaceLivenessModule internal constructor(private var reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String {
        return "FaceModule"
    }

    @ReactMethod
    fun showMyView(sessionId: String?, accessKeyId: String?, secretKey: String?, sessionToken: String?, expiration: String?) {
        val activity = currentActivity ?: return
        activity.runOnUiThread {
            FaceDetector.setReactContext(reactContext)

            val intent = Intent(currentActivity, FaceDetector::class.java)
            sessionId?.let {
                intent.putExtra("EXTRA_SESSION_ID", it)
            }
            accessKeyId?.let {
                intent.putExtra("EXTRA_ACCESS_KEY_ID", it)
            }
            secretKey?.let {
                intent.putExtra("EXTRA_SECRET_KEY", it)
            }
            sessionToken?.let {
                intent.putExtra("EXTRA_SESSION_TOKEN", it)
            }
            expiration?.let {
                intent.putExtra("EXTRA_EXPIRATION", it)
            }
            currentActivity!!.startActivity(intent)
        }
    }

}

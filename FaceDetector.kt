package br.com.example.app

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import aws.smithy.kotlin.runtime.util.toNumber
import com.amplifyframework.auth.AWSCredentials
import com.amplifyframework.auth.AWSCredentialsProvider
import com.amplifyframework.auth.AWSTemporaryCredentials
import com.amplifyframework.auth.AuthException
import com.amplifyframework.ui.liveness.ui.FaceLivenessDetector
import com.amplifyframework.ui.liveness.ui.LivenessColorScheme
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.time.Instant
import java.util.function.Consumer


class FaceDetector: ComponentActivity() {


    companion object {
        private var reactContext: ReactApplicationContext? = null

        fun setReactContext(context: ReactApplicationContext) {
            reactContext = context
        }
    }

    private class MyCredentialsProvider(private val credentials: AWSTemporaryCredentials?) : AWSCredentialsProvider<AWSCredentials> {
        override fun fetchAWSCredentials(
                onSuccess: com.amplifyframework.core.Consumer<AWSCredentials>,
                onError: com.amplifyframework.core.Consumer<AuthException>
        ) {
            if (credentials != null) {
                onSuccess.accept(credentials)
            } else {
                onError.accept(AuthException("No credentials provided", ""))
            }
        }
    }


    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val sessionId = intent.getStringExtra("EXTRA_SESSION_ID")
        val accessKeyId = intent.getStringExtra("EXTRA_ACCESS_KEY_ID")
        val secretKey = intent.getStringExtra("EXTRA_SECRET_KEY")
        val sessionToken = intent.getStringExtra("EXTRA_SESSION_TOKEN")
        val expirationString = intent.getStringExtra("EXTRA_EXPIRATION")
        val expiration = aws.smithy.kotlin.runtime.time.Instant.fromIso8601(expirationString ?: "2022-01-01T00:00:00Z")


        val credentials = if (accessKeyId != null && secretKey != null && sessionToken != null) {
            val
                    awsTemporaryCredentials = AWSTemporaryCredentials(accessKeyId, secretKey, sessionToken, expiration)
            awsTemporaryCredentials
        } else {
            null
        }

        setViewContent(this, sessionId ?: "", credentials)
    }


    fun setViewContent(activity: ComponentActivity, sessionId: String, credentials: AWSTemporaryCredentials?) {


        activity.setContent {
            MaterialTheme(
                    colorScheme = LivenessColorScheme.default()
            ) {
                Column {
                    Log.i("FaceDetector", sessionId)
                    FaceLivenessDetector(
                            sessionId = sessionId,
                            region = "us-east-1",
                            disableStartView = true,
                            onComplete = {
                                Log.i("FaceDetector", "Face Liveness flow is complete")
                                reactContext?.let { sendEvent(it, "FaceLivenessComplete", "success") }
                                activity.finish();
                            },
                            credentialsProvider = MyCredentialsProvider(credentials),
                            onError = { error  ->
                                Log.e("FaceDetector", "Error during Face Liveness flow"+error.message,error.throwable)
                                reactContext?.let { sendEvent(it, "FaceLivenessError", error.message ?: "Unknown error") }
                                activity.finish()
                            }
                    )
                }
            }
        }
    }

    private fun sendEvent(reactContext: ReactApplicationContext, eventName: String, eventData: String) {
        reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, eventData)
    }
}

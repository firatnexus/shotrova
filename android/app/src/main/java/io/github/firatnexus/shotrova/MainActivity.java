package io.github.firatnexus.shotrova;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Branded launch screen (background + icon, see AppTheme.NoActionBarLaunch).
        // Must run before super.onCreate; swaps to AppTheme.NoActionBar afterwards.
        // Kept on screen until the web layer has painted its first frame (or a
        // 3s safety timeout), so the hand-off is seamless — the PWA boot screen
        // never stacks on top of the native splash.
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        splashScreen.setKeepOnScreenCondition(() -> !ShotrovaBridgePlugin.isFirstFrameReady());
        registerPlugin(ShotrovaBridgePlugin.class);
        super.onCreate(savedInstanceState);
        if (savedInstanceState == null) ShotrovaBridgePlugin.handleIntent(this, getIntent());
        ShotrovaBridgePlugin.handleLaunchIntent(getIntent());

        // Back button: let the web app close dialogs and walk its own history
        // first (window.__shotrovaBack, see src/native/bridge.ts).
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView wv = getBridge() == null ? null : getBridge().getWebView();
                if (wv == null) {
                    leave();
                    return;
                }
                wv.evaluateJavascript("(window.__shotrovaBack && window.__shotrovaBack()) ? 'yes' : 'no'", value -> {
                    if (!"\"yes\"".equals(value)) leave();
                });
            }

            private void leave() {
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }

    @Override
    public void onStart() {
        super.onStart();
        // The Android WebView draws its own vertical scrollbar overlay while
        // scrolling (rendered on the left edge on current WebView versions).
        // Hide just that indicator — touch scrolling, inner scrollable areas and
        // the horizontal scrollbar are unaffected.
        WebView wv = getBridge() == null ? null : getBridge().getWebView();
        if (wv != null) wv.setVerticalScrollBarEnabled(false);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        ShotrovaBridgePlugin.handleIntent(this, intent);
        ShotrovaBridgePlugin.handleLaunchIntent(intent);
    }
}

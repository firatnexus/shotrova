package io.github.firatnexus.shotrova;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ShotrovaBridgePlugin.class);
        super.onCreate(savedInstanceState);
        if (savedInstanceState == null) ShotrovaBridgePlugin.handleIntent(this, getIntent());

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
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        ShotrovaBridgePlugin.handleIntent(this, intent);
    }
}

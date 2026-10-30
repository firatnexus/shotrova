package io.github.firatnexus.shotrova;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Branded launch screen (background + icon, see AppTheme.NoActionBarLaunch).
        // Must run before super.onCreate; swaps to AppTheme.NoActionBar afterwards.
        // The exit listener keeps the splash VIEW alive after the app starts
        // drawing (unlike setKeepOnScreenCondition, which blocks every app
        // pre-draw — the WebView could not even begin presenting until the
        // splash let go). The web layer draws and presents underneath, and
        // ShotrovaBridgePlugin removes the retained view once the launch
        // frame is painted and submitted to the compositor (or a safety
        // timeout), then notifies the web layer so the boot screen's exit
        // starts only after the reveal.
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        splashScreen.setOnExitAnimationListener(viewProvider ->
            ShotrovaBridgePlugin.handleSplashExit(viewProvider));
        registerPlugin(ShotrovaBridgePlugin.class);
        super.onCreate(savedInstanceState);
        if (savedInstanceState == null) ShotrovaBridgePlugin.handleIntent(this, getIntent());
        ShotrovaBridgePlugin.handleLaunchIntent(getIntent());
        matchWebViewBackgroundToLaunch();
        installKeyboardAwareInsets();

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

    /**
     * The WebView draws its own (white) background before the page has
     * painted anything. During launch it is transparent instead, so the
     * window background (drawable/splash: launch colour + the mark at the
     * native icon's size and position) shows through until the web launch
     * screen paints — the frames around the system's splash hand-off then
     * look exactly like the splash. Once the retained splash is removed,
     * ShotrovaBridgePlugin restores the opaque launch colour.
     */
    private void matchWebViewBackgroundToLaunch() {
        WebView wv = getBridge() == null ? null : getBridge().getWebView();
        if (wv == null) return;
        wv.setBackgroundColor(android.graphics.Color.TRANSPARENT);
    }

    /** The launch background colour for the current day/night mode. */
    static int launchBackgroundColor(android.content.Context ctx) {
        int mask = ctx.getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK;
        boolean night = mask == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        return androidx.core.content.ContextCompat.getColor(ctx, night ? R.color.splash_background_dark : R.color.splash_background);
    }

    /**
     * Keeps the WebView above the on-screen keyboard.
     *
     * Android 15+ enforces edge-to-edge for targetSdk 35, and then
     * windowSoftInputMode="adjustResize" no longer shrinks the window — the app
     * must apply the IME inset itself. Capacitor's built-in handler
     * (adjustMarginsForEdgeToEdge: "auto") only applies the system-bar and
     * cutout insets and consumes the rest, so the keyboard simply covered the
     * bottom of the page: bottom sheets such as "New category" lost their
     * keyword field and Save/Cancel buttons behind it, and the page could not
     * be scrolled to reveal them because the WebView never got shorter.
     *
     * We replace that listener with one that applies the same margins plus
     * max(navigation bar, keyboard) at the bottom. The WebView then really
     * resizes, so CSS (100dvh, fixed bottom sheets) and window.visualViewport
     * see the true visible height on every device, keyboard size and
     * navigation mode. Before Android 15 the window resizes on its own
     * (adjustResize in the manifest) and Capacitor installs no handler.
     */
    private void installKeyboardAwareInsets() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return;
        WebView wv = getBridge() == null ? null : getBridge().getWebView();
        if (wv == null) return;
        ViewCompat.setOnApplyWindowInsetsListener(wv, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            ViewGroup.MarginLayoutParams mlp = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
            int bottom = Math.max(bars.bottom, ime.bottom);
            if (mlp.leftMargin != bars.left || mlp.topMargin != bars.top || mlp.rightMargin != bars.right || mlp.bottomMargin != bottom) {
                mlp.leftMargin = bars.left;
                mlp.topMargin = bars.top;
                mlp.rightMargin = bars.right;
                mlp.bottomMargin = bottom;
                v.setLayoutParams(mlp);
            }
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(wv);
    }

    @Override
    public void onStart() {
        super.onStart();
        // The Android WebView can draw its own vertical scrollbar overlay while
        // the page is scrolled. Hide just that built-in indicator — touch
        // scrolling, inner scrollable areas and the horizontal scrollbar are
        // unaffected.
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

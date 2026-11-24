package cz.detektivka.tv;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.UiModeManager;
import android.content.res.Configuration;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.Locale;

/**
 * Shows the game companion page (assets/pruvodce.html) full screen. The page works offline and keeps its progress in
 * localStorage. Android's WebView has no speech synthesis, so this activity gives the page the TV's own
 * TextToSpeech engine as window.MysteryForgeTts (see companionApp.js).
 */
public class MainActivity extends Activity {
    private static final String PAGE = "file:///android_asset/pruvodce.html";
    // A TV is read from a sofa: the page text is larger there.
    private static final int TV_TEXT_ZOOM = 150;

    private WebView webView;
    private TextToSpeech tts;
    private boolean ttsReady = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        if (isTelevision()) {
            settings.setTextZoom(TV_TEXT_ZOOM);
        }
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.setBackgroundColor(0xFF15120E);
        webView.addJavascriptInterface(new SpeechBridge(), "MysteryForgeTts");
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        setContentView(webView);
        webView.requestFocus();

        tts = new TextToSpeech(this, status -> {
            ttsReady = status == TextToSpeech.SUCCESS;
            if (ttsReady) {
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) { }
                    @Override public void onDone(String id) { notifyDone(id); }
                    @Override public void onError(String id) { notifyDone(id); }
                });
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(PAGE);
        }
    }

    private boolean isTelevision() {
        UiModeManager manager = (UiModeManager) getSystemService(UI_MODE_SERVICE);
        return manager != null && manager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
    }

    private void notifyDone(String id) {
        String safeId = id.replace("\\", "").replace("'", "");
        webView.post(() -> webView.evaluateJavascript(
            "window.MysteryForgeTtsDone && window.MysteryForgeTtsDone('" + safeId + "')", null));
    }

    /** The speech voice that the page calls. Every method runs on a WebView thread. */
    private class SpeechBridge {
        @JavascriptInterface
        public boolean available() {
            return ttsReady;
        }

        @JavascriptInterface
        public void speak(String id, String text, String language, float pitch, float rate) {
            if (!ttsReady) {
                notifyDone(id);
                return;
            }
            Locale locale = Locale.forLanguageTag(language);
            if (tts.isLanguageAvailable(locale) >= TextToSpeech.LANG_AVAILABLE) {
                tts.setLanguage(locale);
            }
            tts.setPitch(pitch);
            tts.setSpeechRate(rate);
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id);
        }

        @JavascriptInterface
        public void stop() {
            if (ttsReady) {
                tts.stop();
            }
        }
    }

    /** The Back button asks first, so a stray press on the remote never closes the game. */
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            new AlertDialog.Builder(this)
                .setMessage("Ukončit hru? Postup zůstane uložený.")
                .setPositiveButton("Ukončit", (dialog, which) -> finish())
                .setNegativeButton("Zpět do hry", null)
                .show();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (ttsReady) {
            tts.stop();
        }
    }

    @Override
    protected void onDestroy() {
        if (tts != null) {
            tts.shutdown();
        }
        webView.destroy();
        super.onDestroy();
    }
}

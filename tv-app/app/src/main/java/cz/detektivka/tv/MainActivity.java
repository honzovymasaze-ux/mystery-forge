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
    // The page comes from the game server, so the TV and the phones share one state (GameServer).
    private static final String PAGE = "http://127.0.0.1:" + GameServer.PORT + "/";
    // A TV is read from a sofa: the page text is larger there.
    private static final int TV_TEXT_ZOOM = 100;
    private static final String INTRO_JS = "(function(){"
        + "if(window.__mfIntro||sessionStorage.getItem('mf-intro')) return; window.__mfIntro=1;"
        + "var list=['/audio/intro.mp3','/audio/kap-a1.mp3'],i=0,a=new Audio();"
        + "var bar=document.createElement('div');"
        + "bar.style.cssText='position:fixed;left:50%;bottom:32px;transform:translateX(-50%);z-index:99999;"
        + "background:rgba(20,16,12,.92);color:#f0e6d2;border:1px solid #c9a24a;border-radius:12px;"
        + "padding:14px 28px;font:600 22px system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.6)';"
        + "bar.textContent='\\u25B6 P\\u0159\\u00edb\\u011bh \\u2013 kpt. Jan Hor\\u00e1k \\u00b7 OK = p\\u0159esko\\u010dit';"
        + "document.body.appendChild(bar);"
        + "function stop(){a.pause();bar.remove();sessionStorage.setItem('mf-intro','1');document.removeEventListener('keydown',key,true);}"
        + "function key(e){if(e.key==='Enter'||e.keyCode===13||e.key==='Escape'){e.preventDefault();e.stopPropagation();stop();}}"
        + "document.addEventListener('keydown',key,true);"
        + "a.onended=function(){i++;if(i<list.length){a.src=list[i];a.play();}else stop();};"
        + "a.onerror=function(){stop();};"
        + "a.src=list[0];a.play().catch(function(){stop();});"
        + "})();";

    // Honza 25. 11.: na TV je všechno moc velké a při návratu nahoru na nástěnce se fotky zaříznou pod lištou.
    // Celou stránku zmenšíme a fokusovaným prvkům dáme odstup od pevné horní lišty (podle její skutečné výšky).
    private static final String TV_LAYOUT_JS = "(function(){"
        + "if(window.__mfTv) return; window.__mfTv=1;"
        + "document.documentElement.style.zoom='0.8';"
        + "function head(){var h=0;document.querySelectorAll('body *').forEach(function(e){var s=getComputedStyle(e);"
        + "if((s.position==='sticky'||s.position==='fixed')&&e.getBoundingClientRect().top<=2&&e.offsetHeight<400){"
        + "h=Math.max(h,e.getBoundingClientRect().bottom);}});return Math.ceil(h);}"
        + "var st=document.createElement('style');document.head.appendChild(st);"
        + "function apply(){var h=head()+24;st.textContent='html,body,*{scroll-padding-top:'+h+'px;scroll-padding-bottom:32px}'"
        + "+'*{scroll-margin-top:'+h+'px;scroll-margin-bottom:32px}';}"
        + "apply();setTimeout(apply,800);window.addEventListener('resize',apply);"
        + "document.addEventListener('focusin',function(e){var t=e.target;if(!t||!t.getBoundingClientRect)return;"
        + "var r=t.getBoundingClientRect(),h=head()+24;if(r.top<h){var p=t;while(p&&p!==document.body){"
        + "if(p.scrollHeight>p.clientHeight+4&&/(auto|scroll)/.test(getComputedStyle(p).overflowY))break;p=p.parentElement;}"
        + "if(p&&p!==document.body){p.scrollTop-= (h-r.top);}else{window.scrollBy(0,(r.top-h)/0.8);}}},true);"
        + "})();";

    private WebView webView;
    private GameServer server;
    private TextToSpeech tts;
    private boolean ttsReady = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        server = new GameServer(this);
        server.start();
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        if (isTelevision()) {
            settings.setTextZoom(TV_TEXT_ZOOM);
        }
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                // Honza: „hned po otevření pustit příběh“ – úvod a první kapitola se přehrají samy, OK přeskočí.
                if (isTelevision()) view.evaluateJavascript(TV_LAYOUT_JS, null);
                view.evaluateJavascript(INTRO_JS, null);
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                // The server thread may start a moment after the page asks: try again shortly.
                view.postDelayed(() -> view.loadUrl(PAGE), 500);
            }
        });
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

    /**
     * The Back button first closes what the page has open (a document, a dialog). Only then it asks before it closes
     * the game, so a stray press on the remote never ends it.
     */
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            webView.evaluateJavascript(
                "window.MysteryForgeBack ? window.MysteryForgeBack() : false",
                handled -> {
                    if (!"true".equals(handled)) {
                        askToQuit();
                    }
                });
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    private void askToQuit() {
        new AlertDialog.Builder(this)
            .setMessage("Ukončit hru? Postup zůstane uložený.")
            .setPositiveButton("Ukončit", (dialog, which) -> finish())
            .setNegativeButton("Zpět do hry", null)
            .show();
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
        server.stop();
        super.onDestroy();
    }
}

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
        + "var list=['/audio/kap-a1.mp3'];"
        // Honza 25. 11.: úvod = video (epická hudba + jeho hlas + fotky) přes celou obrazovku, pak kapitola A1. OK přeskočí.
        + "var ov=document.createElement('div');ov.style.cssText='position:fixed;inset:0;z-index:100000;background:#000';"
        + "var v=document.createElement('video');v.src='/video/intro.mp4';v.autoplay=true;v.playsInline=true;"
        + "v.style.cssText='width:100%;height:100%;object-fit:contain;background:#000';ov.appendChild(v);"
        + "var hint=document.createElement('div');hint.textContent='OK = p\\u0159esko\\u010dit';"
        + "hint.style.cssText='position:absolute;right:28px;bottom:22px;color:#c9a24a;font:600 16px system-ui;opacity:.7';ov.appendChild(hint);"
        + "document.body.appendChild(ov);window.__mfVideo=true;"
        // Po úvodu rovnou video kapitoly A1; teprve když video chybí, přehraje se jen nahrávka.
        + "var stage=0;"
        + "function finish(){window.__mfVideo=false;v.pause();ov.remove();document.removeEventListener('keydown',vkey,true);sessionStorage.setItem('mf-intro','1');}"
        + "function endVideo(){if(!window.__mfVideo)return;if(stage===0){stage=1;v.src='/video/kap-a1.mp4';v.play().catch(function(){});}else finish();}"
        + "function vkey(e){if(e.key==='Enter'||e.keyCode===13||e.key==='Escape'){e.preventDefault();e.stopPropagation();endVideo();}}"
        + "document.addEventListener('keydown',vkey,true);v.onended=endVideo;"
        + "v.onerror=function(){window.__mfVideo=false;ov.remove();document.removeEventListener('keydown',vkey,true);if(stage===0)list.unshift('/audio/intro.mp3');startAudio();};"
        + "v.play().catch(function(){});"
        + "function startAudio(){"
        + "var i=0,a=new Audio();"
        + "var bar=document.createElement('div');"
        // Malý štítek v pravém dolním rohu – nesmí překrýt QR kód uprostřed.
        + "bar.style.cssText='position:fixed;right:48px;top:300px;z-index:99999;"
        + "background:rgba(20,16,12,.88);color:#f0e6d2;border:1px solid #c9a24a;border-radius:10px;"
        + "padding:8px 16px;font:600 15px system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.5)';"
        + "bar.textContent='\\u25B6 P\\u0159\\u00edb\\u011bh \\u00b7 OK = p\\u0159esko\\u010dit';"
        + "document.body.appendChild(bar);"
        + "function stop(){a.pause();bar.remove();sessionStorage.setItem('mf-intro','1');document.removeEventListener('keydown',key,true);}"
        + "function key(e){if(e.key==='Enter'||e.keyCode===13||e.key==='Escape'){e.preventDefault();e.stopPropagation();stop();}}"
        + "document.addEventListener('keydown',key,true);"
        + "a.onended=function(){i++;if(i<list.length){a.src=list[i];a.play();}else stop();};"
        + "a.onerror=function(){stop();};"
        + "a.src=list[0];a.play().catch(function(){stop();});"
        + "}"
        + "})();";

    // Honza 25. 11.: „epický úvod, hudba podkres hlasu vypravěče, ale ať hraje po celou dobu vyšetřování“.
    // Hudba na pozadí: úvodní skladba, pak smyčka dalších. Při jakékoli řeči (MP3 nebo TTS) se ztiší. Tlačítko ♪.
    private static final String MUSIC_JS = "(function(){"
        + "if(window.__mfMusic) return; window.__mfMusic=1;"
        + "var O=window.Audio, voices=new Set(), tts=false;"
        + "window.Audio=function(src){var a=new O(src);voices.add(a);['play','pause','ended','error'].forEach(function(ev){a.addEventListener(ev,duck);});return a;};"
        + "window.Audio.prototype=O.prototype;"
        + "window.__mfTtsStart=function(){tts=true;duck();};window.__mfTtsEnd=function(){tts=false;duck();};"
        + "var on=true;try{on=localStorage.getItem('mf-music')!=='off';}catch(e){}"
        + "var first=!sessionStorage.getItem('mf-intro');"
        // Epická úvodní skladba je přímo ve videu úvodu – na pozadí se střídají podkresy.
        + "var list=['/audio/hudba-1.mp3','/audio/hudba-2.mp3','/audio/hudba-3.mp3'];"
        + "var loopFrom=0,i=0,fails=0,bg=new O(),vol=0,target=0;"
        + "function talking(){if(tts)return true;var t=false;voices.forEach(function(v){if(!v.paused&&!v.ended)t=true;});return t;}"
        + "var fin=false;"
        + "function duck(){target=(!on||window.__mfVideo)?0:(talking()?0.06:(fin?0.28:0.2));}"
        + "setInterval(duck,500);"
        // Vrchol vyšetřování (Honza: „ve špičce“): na záložce Obvinění hraje gradující finálová skladba ve smyčce.
        + "function accusing(){var t=document.querySelector('.tabs [aria-selected=\"true\"],.tabs [aria-current=\"page\"],.tabs .active,.tabs .is-active');"
        + "return !!t&&/Obvin/.test(t.textContent);}"
        + "setInterval(function(){var a=accusing();if(a===fin)return;fin=a;fails=0;"
        + "if(fin){bg.src='/audio/hudba-finale.mp3';bg.loop=true;}else{bg.loop=false;bg.src=list[i];}"
        + "duck();bg.play().catch(function(){});},1500);"
        + "setInterval(function(){vol+= (target-vol)*0.15;if(Math.abs(target-vol)<0.003)vol=target;bg.volume=Math.max(0,Math.min(1,vol));},100);"
        + "function next(){i++;if(i>=list.length)i=loopFrom;play();}"
        + "function play(){bg.src=list[i];duck();bg.play().then(function(){fails=0;}).catch(function(){if(++fails<list.length)next();});}"
        + "bg.onended=function(){if(!fin)next();};bg.onerror=function(){if(!fin&&++fails<list.length)next();};"
        + "var b=document.createElement('button');b.id='mf-music';"
        // Vlevo dole – nahoře překrývalo nabídky horní lišty (Honza 25. 11.).
        + "b.style.cssText='position:fixed;left:16px;bottom:16px;z-index:99999;background:rgba(20,16,12,.85);color:#c9a24a;"
        + "border:1px solid #c9a24a;border-radius:8px;padding:2px 12px;font:600 15px system-ui;cursor:pointer;opacity:.85';"
        + "function label(){b.textContent=on?'\\u266A hudba':'\\u266A vyp.';}label();"
        + "b.onclick=function(){on=!on;try{localStorage.setItem('mf-music',on?'on':'off');}catch(e){}label();duck();if(on&&bg.paused)bg.play().catch(function(){});};"
        + "document.body.appendChild(b);"
        // V otevřeném dokumentu by tlačítko překrylo lištu prohlížeče – schovat.
        + "setInterval(function(){b.style.display=(document.getElementById('viewer')||document.getElementById('board-menu'))?'none':'';},400);"
        + "play();"
        + "})();";

    // Honza 25. 11.: na TV je všechno moc velké a při návratu nahoru na nástěnce se fotky zaříznou pod lištou.
    // Celou stránku zmenšíme a fokusovaným prvkům dáme odstup od pevné horní lišty (podle její skutečné výšky).
    private static final String TV_LAYOUT_JS = "(function(){"
        + "if(window.__mfTv) return; window.__mfTv=1;"
        + "document.documentElement.style.zoom='0.8';"
        + "function head(){var h=0;document.querySelectorAll('body *').forEach(function(e){var s=getComputedStyle(e);"
        + "if((s.position==='sticky'||s.position==='fixed')&&e.getBoundingClientRect().top<=2&&e.offsetHeight<400){"
        + "h=Math.max(h,e.getBoundingClientRect().bottom);}});return Math.ceil(h);}"
        // Obsah pod lištou ještě o 20 % menší (Honza: „hlavně střed, ne ikony“).
        + "var cz=document.createElement('style');cz.textContent="
        + "'.tabs ~ *:not(.overlay):not(.viewer):not(.topbar):not(.tabs),.topbar ~ *:not(.overlay):not(.viewer):not(.topbar):not(.tabs){zoom:.8}'"
        // Lišta se záložkami musí zůstat nad posouvaným obsahem (obsah pod ní přejížděl).
        // …ale pod otevřeným dokumentem a nabídkami (z 900 utopilo lištu prohlížeče – Honza 25. 11.).
        + "+'.topbar,.tabs{z-index:15 !important;background:#15120e !important}'"
        + "+'.viewer,.overlay{z-index:2000 !important}'"
        // Podkresový obrázek Kunštátu za celou hrou (Honza 25. 11.), ztmavený, aby text zůstal čitelný.
        + "+'body{background:#0d0b09 !important}'"
        + "+'body::before{content:\"\";position:fixed;inset:0;z-index:-1;pointer-events:none;'"
        + "+'background:linear-gradient(rgba(13,11,9,.72),rgba(13,11,9,.86)),url(/img/pozadi.jpg) center/cover no-repeat;}'"
        + "+'#app,.app{background:transparent !important}';"
        + "document.head.appendChild(cz);"
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
                view.evaluateJavascript(MUSIC_JS, null);
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
            "window.__mfTtsEnd && window.__mfTtsEnd(); window.MysteryForgeTtsDone && window.MysteryForgeTtsDone('" + safeId + "')", null));
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
            webView.post(() -> webView.evaluateJavascript("window.__mfTtsStart && window.__mfTtsStart()", null));
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

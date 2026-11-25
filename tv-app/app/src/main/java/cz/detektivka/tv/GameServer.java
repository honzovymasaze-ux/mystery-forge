package cz.detektivka.tv;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Locale;

/**
 * A small web server on the local network. It serves the player companion page to the TV itself and to the phones
 * that scan the QR code, and it keeps the shared state of the group: the solved puzzles, their answers, and the
 * accusation, and the evidence board. Every device merges that state into its own (companionLogic.js,
 * mergeSharedState).
 *
 * It serves the page, the recordings (media/), api/state (GET and POST), api/reset (POST), api/history (GET and POST, the record of
 * finished games), and api/info (the address for the QR code). Nothing leaves the local network.
 */
final class GameServer {
    static final int PORT = 8080;
    private static final String PAGE = "pruvodce.html";
    private static final String PREFERENCES = "shared-game";
    private static final String STATE_KEY = "state";
    // The record of finished games: a new game (api/reset) erases the state, never this record.
    private static final String HISTORY_KEY = "history";
    private static final int MAX_BODY = 256 * 1024;

    private final Context context;
    private final SharedPreferences preferences;
    private ServerSocket socket;
    private volatile boolean running;
    private JSONObject state;

    GameServer(Context context) {
        this.context = context.getApplicationContext();
        this.preferences = this.context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
        this.state = parse(preferences.getString(STATE_KEY, "{}"));
    }

    void start() {
        if (running) {
            return;
        }
        running = true;
        Thread thread = new Thread(this::serve, "game-server");
        thread.setDaemon(true);
        thread.start();
    }

    void stop() {
        running = false;
        try {
            if (socket != null) {
                socket.close();
            }
        } catch (IOException ignored) {
            // The socket is already closed.
        }
    }

    /** The address that a phone on the same Wi-Fi opens, or null when the TV has no local network address. */
    static String localUrl() {
        try {
            for (NetworkInterface network : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!network.isUp() || network.isLoopback()) {
                    continue;
                }
                for (InetAddress address : Collections.list(network.getInetAddresses())) {
                    if (address instanceof Inet4Address && address.isSiteLocalAddress()) {
                        return "http://" + address.getHostAddress() + ":" + PORT + "/";
                    }
                }
            }
        } catch (Exception ignored) {
            // No network: the page shows no QR code.
        }
        return null;
    }

    private void serve() {
        try {
            socket = new ServerSocket(PORT);
            while (running) {
                Socket client = socket.accept();
                Thread worker = new Thread(() -> handle(client), "game-client");
                worker.setDaemon(true);
                worker.start();
            }
        } catch (IOException ignored) {
            running = false;
        }
    }

    private void handle(Socket client) {
        try (Socket connection = client) {
            connection.setSoTimeout(10000);
            InputStream input = connection.getInputStream();
            // Read the head byte by byte: Content-Length counts bytes, and a UTF-8 body has more bytes than chars.
            ByteArrayOutputStream head = new ByteArrayOutputStream();
            int last = 0;
            int current;
            while ((current = input.read()) >= 0) {
                head.write(current);
                last = (last << 8 | current) & 0xFFFFFFFF;
                if (last == 0x0D0A0D0A || head.size() > 16384) {
                    break;
                }
            }
            String[] lines = head.toString("US-ASCII").split("\r\n");
            String[] parts = lines.length > 0 ? lines[0].split(" ") : new String[0];
            String method = parts.length > 0 ? parts[0] : "";
            String path = parts.length > 1 ? parts[1].split("\\?")[0] : "/";
            int length = 0;
            String range = null;
            for (String header : lines) {
                if (header.toLowerCase(Locale.ROOT).startsWith("range:")) {
                    range = header.substring(6).trim();
                }
                if (header.toLowerCase(Locale.ROOT).startsWith("content-length:")) {
                    length = Math.min(MAX_BODY, Integer.parseInt(header.substring(15).trim()));
                }
            }
            byte[] body = new byte[length];
            int read = 0;
            while (read < length) {
                int count = input.read(body, read, length - read);
                if (count < 0) {
                    break;
                }
                read += count;
            }
            respond(connection.getOutputStream(), method, path, new String(body, 0, read, StandardCharsets.UTF_8), range);
        } catch (Exception ignored) {
            // A broken request from one device must not stop the server.
        }
    }

    private void respond(OutputStream output, String method, String path, String body, String range) throws IOException {
        if (path.equals("/api/info")) {
            JSONObject info = new JSONObject();
            try {
                info.put("url", localUrl() == null ? JSONObject.NULL : localUrl());
            } catch (JSONException ignored) {
                // A fixed key and a string value cannot fail.
            }
            send(output, 200, "application/json", info.toString().getBytes(StandardCharsets.UTF_8));
        } else if (path.equals("/api/state") && method.equals("POST")) {
            send(output, 200, "application/json", merge(parse(body)).getBytes(StandardCharsets.UTF_8));
        } else if (path.equals("/api/state")) {
            send(output, 200, "application/json", snapshot().getBytes(StandardCharsets.UTF_8));
        } else if (path.equals("/api/history") && method.equals("POST")) {
            send(output, 200, "application/json", addHistory(parse(body)).getBytes(StandardCharsets.UTF_8));
        } else if (path.equals("/api/history")) {
            send(output, 200, "application/json", history().toString().getBytes(StandardCharsets.UTF_8));
        } else if (path.equals("/api/reset") && method.equals("POST")) {
            synchronized (this) {
                state = new JSONObject();
                preferences.edit().putString(STATE_KEY, "{}").apply();
            }
            send(output, 200, "application/json", "{}".getBytes(StandardCharsets.UTF_8));
        } else if (path.equals("/") || path.equals("/index.html")) {
            send(output, 200, "text/html; charset=utf-8", readAsset(PAGE));
        } else if (path.matches("/audio/[A-Za-z0-9-]+\\.mp3")) {
            // Namluvené kapitoly a hlasovky (ElevenLabs), přibalené v assets/audio.
            try {
                sendMedia(output, "audio/mpeg", readAsset(path.substring(1)), range);
            } catch (IOException missing) {
                send(output, 404, "text/plain", "Not found".getBytes(StandardCharsets.UTF_8));
            }
        } else if (path.matches("/(video|img)/[A-Za-z0-9-]+\\.(mp4|jpg)")) {
            // Úvodní video a obrázek pozadí (Kunštát), přibalené v assets/video a assets/img.
            try {
                sendMedia(output, path.endsWith(".mp4") ? "video/mp4" : "image/jpeg", readAsset(path.substring(1)), range);
            } catch (IOException missing) {
                send(output, 404, "text/plain", "Not found".getBytes(StandardCharsets.UTF_8));
            }
        } else if (path.startsWith("/media/") && path.matches("/media/[A-Za-z0-9._-]+")) {
            // The recordings of the game: render/media/ that scripts/build-tv-apk.sh puts into assets/audio.
            String name = "audio/" + path.substring("/media/".length());
            try {
                sendMedia(output, mediaType(name), readAsset(name), range);
            } catch (IOException missing) {
                send(output, 404, "text/plain", "Not found".getBytes(StandardCharsets.UTF_8));
            }
        } else {
            send(output, 404, "text/plain", "Not found".getBytes(StandardCharsets.UTF_8));
        }
    }

    private synchronized JSONArray history() {
        try {
            return new JSONArray(preferences.getString(HISTORY_KEY, "[]"));
        } catch (JSONException error) {
            return new JSONArray();
        }
    }

    private synchronized String addHistory(JSONObject entry) {
        JSONArray games = history();
        games.put(entry);
        preferences.edit().putString(HISTORY_KEY, games.toString()).apply();
        return games.toString();
    }

    private synchronized String snapshot() {
        return state.toString();
    }

    /** Join the solved puzzles and the answers of a device into the shared state; the first accusation stays. */
    private synchronized String merge(JSONObject incoming) {
        try {
            JSONArray solved = state.optJSONArray("solved");
            if (solved == null) {
                solved = new JSONArray();
            }
            JSONArray incomingSolved = incoming.optJSONArray("solved");
            if (incomingSolved != null) {
                for (int index = 0; index < incomingSolved.length(); index++) {
                    String code = incomingSolved.optString(index, "");
                    if (!code.isEmpty() && !contains(solved, code)) {
                        solved.put(code);
                    }
                }
            }
            JSONObject answers = state.optJSONObject("answers");
            if (answers == null) {
                answers = new JSONObject();
            }
            JSONObject incomingAnswers = incoming.optJSONObject("answers");
            if (incomingAnswers != null) {
                for (java.util.Iterator<String> keys = incomingAnswers.keys(); keys.hasNext(); ) {
                    String code = keys.next();
                    if (!answers.has(code)) {
                        answers.put(code, incomingAnswers.optString(code, ""));
                    }
                }
            }
            state.put("solved", solved);
            state.put("answers", answers);
            // The evidence board has one layout for the whole group: the newest change wins.
            JSONObject board = incoming.optJSONObject("board");
            JSONObject current = state.optJSONObject("board");
            if (board != null && (current == null || board.optLong("updated") > current.optLong("updated"))) {
                state.put("board", board);
            }
            if (state.optJSONObject("accusation") == null && incoming.optJSONObject("accusation") != null) {
                state.put("accusation", incoming.optJSONObject("accusation"));
            }
            preferences.edit().putString(STATE_KEY, state.toString()).apply();
        } catch (JSONException ignored) {
            // A malformed part is skipped; the rest of the state stays.
        }
        return state.toString();
    }

    private static boolean contains(JSONArray array, String value) {
        for (int index = 0; index < array.length(); index++) {
            if (value.equals(array.optString(index))) {
                return true;
            }
        }
        return false;
    }

    private static JSONObject parse(String text) {
        try {
            return new JSONObject(text);
        } catch (JSONException error) {
            return new JSONObject();
        }
    }

    private static String mediaType(String name) {
        String lower = name.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".mp3")) {
            return "audio/mpeg";
        }
        if (lower.endsWith(".m4a")) {
            return "audio/mp4";
        }
        if (lower.endsWith(".ogg")) {
            return "audio/ogg";
        }
        if (lower.endsWith(".wav")) {
            return "audio/wav";
        }
        if (lower.endsWith(".mp4")) {
            return "video/mp4";
        }
        return "application/octet-stream";
    }

    private byte[] readAsset(String name) throws IOException {
        try (InputStream asset = context.getAssets().open(name)) {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[16384];
            int count;
            while ((count = asset.read(chunk)) > 0) {
                buffer.write(chunk, 0, count);
            }
            return buffer.toByteArray();
        }
    }

    /**
     * Nahrávky a videa s podporou Range (Honza 25. 11.: pauza a posun ve videu). Bez 206 WebView ve videu neskočí
     * a posun vrátí přehrávání na začátek.
     */
    private static void sendMedia(OutputStream output, String type, byte[] data, String range) throws IOException {
        int start = 0;
        int end = data.length - 1;
        boolean partial = false;
        if (range != null && range.startsWith("bytes=") && data.length > 0) {
            String spec = range.substring(6).split(",")[0].trim();
            int dash = spec.indexOf('-');
            try {
                if (dash == 0) {
                    start = Math.max(0, data.length - Integer.parseInt(spec.substring(1)));
                } else if (dash > 0) {
                    start = Integer.parseInt(spec.substring(0, dash));
                    if (dash < spec.length() - 1) {
                        end = Math.min(end, Integer.parseInt(spec.substring(dash + 1)));
                    }
                }
                partial = start <= end && start < data.length;
            } catch (NumberFormatException ignored) {
                partial = false;
            }
            if (!partial) {
                start = 0;
                end = data.length - 1;
            }
        }
        int length = end - start + 1;
        String head = "HTTP/1.1 " + (partial ? "206 Partial Content" : "200 OK") + "
"
            + "Content-Type: " + type + "
"
            + "Content-Length: " + length + "
"
            + "Accept-Ranges: bytes
"
            + (partial ? "Content-Range: bytes " + start + "-" + end + "/" + data.length + "
" : "")
            + "Cache-Control: no-store
"
            + "Connection: close

";
        output.write(head.getBytes(StandardCharsets.US_ASCII));
        output.write(data, start, length);
        output.flush();
    }

    private static void send(OutputStream output, int status, String type, byte[] body) throws IOException {
        String reason = status == 200 ? "OK" : "Not Found";
        String head = "HTTP/1.1 " + status + " " + reason + "\r\n"
            + "Content-Type: " + type + "\r\n"
            + "Content-Length: " + body.length + "\r\n"
            + "Cache-Control: no-store\r\n"
            + "Connection: close\r\n\r\n";
        output.write(head.getBytes(StandardCharsets.US_ASCII));
        output.write(body);
        output.flush();
    }
}

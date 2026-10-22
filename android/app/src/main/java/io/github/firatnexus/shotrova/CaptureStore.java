package io.github.firatnexus.shotrova;

import android.content.Context;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Persistent state for automatic screenshot capture.
 *
 * A single JSON file in the app's private filesDir holds:
 * - processed MediaStore ids + content hashes (never process the same image twice),
 * - the queue of captured-but-not-yet-imported screenshots (staged copies),
 * - the AI settings mirrored from the web layer (the API key is additionally
 *   encrypted with an Android Keystore AES-GCM key before it touches disk),
 * - capture settings (enabled, storage mode).
 *
 * Everything is app-private; nothing here is ever exported or logged.
 */
final class CaptureStore {

    private static final String KS_ALIAS = "shotrova_ai_key";
    private static final String STATE_FILE = "capture_state.json";
    private static final int MAX_PROCESSED = 5000;

    private final File file;
    private final Object lock = new Object();

    // ---- state (all guarded by `lock`) ----
    /** msId -> content hash of every processed MediaStore row. */
    private final Map<Long, String> processedMsIds = new HashMap<>();
    /** Every content hash ever captured (faster than scanning the queue). */
    private final Map<String, Boolean> processedHashes = new HashMap<>();
    private final JSONArray queue = new JSONArray(); // staged captures
    private JSONObject ai = new JSONObject();        // AI settings mirror
    private boolean enabled = false;
    private String storageMode = "original";         // "original" | "compressed"
    private long lastScanDateAdded = -1;            // baseline (seconds) or -1 = none
    private long lastScanAt = 0;

    CaptureStore(Context ctx) {
        file = new File(ctx.getFilesDir(), STATE_FILE);
        load();
    }

    private void load() {
        synchronized (lock) {
            processedMsIds.clear();
            processedHashes.clear();
            if (!file.exists()) return;
            try (FileInputStream in = new FileInputStream(file)) {
                byte[] buf = new byte[(int) file.length()];
                int read = 0;
                while (read < buf.length) read += in.read(buf, read, buf.length - read);
                JSONObject o = new JSONObject(new String(buf, StandardCharsets.UTF_8));
                JSONObject ids = o.optJSONObject("processedMsIds");
                if (ids != null) {
                    Iterator<String> it = ids.keys();
                    while (it.hasNext()) {
                        String k = it.next();
                        try {
                            processedMsIds.put(Long.parseLong(k), ids.getString(k));
                        } catch (NumberFormatException ignored) { /* skip */ }
                    }
                }
                JSONArray hashes = o.optJSONArray("processedHashes");
                if (hashes != null) for (int i = 0; i < hashes.length(); i++) processedHashes.put(hashes.getString(i), Boolean.TRUE);
                JSONArray q = o.optJSONArray("queue");
                if (q != null) for (int i = 0; i < q.length(); i++) queue.put(q.get(i));
                ai = o.optJSONObject("ai") != null ? o.getJSONObject("ai") : new JSONObject();
                enabled = o.optBoolean("enabled", false);
                storageMode = o.optString("storageMode", "original");
                lastScanDateAdded = o.optLong("lastScanDateAdded", -1);
                lastScanAt = o.optLong("lastScanAt", 0);
            } catch (Exception e) {
                // Corrupt state: start over rather than crash; staged files remain orphaned
                // and are cleaned by the next capture scan.
            }
        }
    }

    void save(Context ctx) {
        synchronized (lock) {
            try {
                JSONObject o = new JSONObject();
                JSONObject ids = new JSONObject();
                for (Map.Entry<Long, String> e : processedMsIds.entrySet()) ids.put(String.valueOf(e.getKey()), e.getValue());
                o.put("processedMsIds", ids);
                o.put("processedHashes", new JSONArray(processedHashes.keySet()));
                o.put("queue", queue);
                o.put("ai", ai);
                o.put("enabled", enabled);
                o.put("storageMode", storageMode);
                o.put("lastScanDateAdded", lastScanDateAdded);
                o.put("lastScanAt", lastScanAt);
                File tmp = new File(file.getParentFile(), STATE_FILE + ".tmp");
                try (FileOutputStream out = new FileOutputStream(tmp)) {
                    out.write(o.toString().getBytes(StandardCharsets.UTF_8));
                }
                //noinspection ResultOfMethodCallIgnored
                tmp.renameTo(file);
            } catch (Exception ignored) {
                // Best effort persistence.
            }
        }
    }

    // ------------------------------------------------------------ accessors

    boolean isEnabled() { synchronized (lock) { return enabled; } }
    void setEnabled(boolean v) { synchronized (lock) { enabled = v; } }
    String storageMode() { synchronized (lock) { return storageMode; } }
    void setStorageMode(String m) { synchronized (lock) { storageMode = "compressed".equals(m) ? "compressed" : "original"; } }
    long lastScanAt() { synchronized (lock) { return lastScanAt; } }
    long lastScanDateAdded() { synchronized (lock) { return lastScanDateAdded; } }
    void markScanned(long maxDateAddedSec) {
        synchronized (lock) {
            lastScanAt = System.currentTimeMillis();
            if (maxDateAddedSec > lastScanDateAdded) lastScanDateAdded = maxDateAddedSec;
        }
    }

    boolean isProcessed(long msId, String hash) {
        synchronized (lock) {
            String prev = processedMsIds.get(msId);
            if (hash != null && hash.equals(prev)) return true;
            return hash != null && processedHashes.containsKey(hash);
        }
    }

    /** Records an id/hash pair and trims the history so the file stays small. */
    void markProcessed(long msId, String hash) {
        synchronized (lock) {
            if (hash != null) processedHashes.put(hash, Boolean.TRUE);
            processedMsIds.put(msId, hash == null ? "" : hash);
            if (processedMsIds.size() > MAX_PROCESSED) {
                // Drop the oldest half; MediaStore ids are monotonic per volume.
                long sum = 0;
                for (long k : processedMsIds.keySet()) sum += k;
                final long median = sum / Math.max(1, processedMsIds.size());
                processedMsIds.keySet().removeIf(k -> k < median);
            }
        }
    }

    /** All staged captures (JSObjects for the bridge). */
    JSArray queueSnapshot() {
        synchronized (lock) {
            JSArray a = new JSArray();
            for (int i = 0; i < queue.length(); i++) {
                try { a.put(queue.getJSONObject(i)); } catch (Exception ignored) { /* skip */ }
            }
            return a;
        }
    }

    int pendingCount() {
        synchronized (lock) { return queue.length(); }
    }

    JSONObject findQueued(String captureId) {
        synchronized (lock) {
            for (int i = 0; i < queue.length(); i++) {
                try {
                    JSONObject o = queue.getJSONObject(i);
                    if (captureId.equals(o.optString("id"))) return o;
                } catch (Exception ignored) { /* skip */ }
            }
            return null;
        }
    }

    /** Adds or replaces a queue entry. */
    void putQueued(JSONObject entry) {
        synchronized (lock) {
            String id = entry.optString("id");
            for (int i = 0; i < queue.length(); i++) {
                try {
                    if (id.equals(queue.getJSONObject(i).optString("id"))) {
                        queue.put(i, entry);
                        return;
                    }
                } catch (Exception ignored) { /* skip */ }
            }
            queue.put(entry);
        }
    }

    /** Removes staged entries (and their files) once the web layer imported them. */
    void removeQueued(Context ctx, JSONArray ids) {
        synchronized (lock) {
            for (int k = 0; k < ids.length(); k++) {
                String id = ids.optString(k);
                for (int i = queue.length() - 1; i >= 0; i--) {
                    try {
                        JSONObject o = queue.getJSONObject(i);
                        if (!id.equals(o.optString("id"))) continue;
                        deleteQuiet(new File(o.optString("path")));
                        deleteQuiet(new File(o.optString("thumbPath")));
                        queue.remove(i);
                    } catch (Exception ignored) { /* skip */ }
                }
            }
        }
        save(ctx);
    }

    static void deleteQuiet(File f) {
        if (f != null) try { //noinspection ResultOfMethodCallIgnored
            f.delete();
        } catch (Exception ignored) { /* skip */ }
    }

    long stagedBytes() {
        synchronized (lock) {
            long total = 0;
            for (int i = 0; i < queue.length(); i++) {
                try {
                    JSONObject o = queue.getJSONObject(i);
                    File f = new File(o.optString("path"));
                    File th = new File(o.optString("thumbPath"));
                    if (f.exists()) total += f.length();
                    if (th.exists()) total += th.length();
                } catch (Exception ignored) { /* skip */ }
            }
            return total;
        }
    }

    /** Purges staged files that were already imported (state != "captured"). */
    int purgeImported(Context ctx) {
        int n = 0;
        synchronized (lock) {
            for (int i = queue.length() - 1; i >= 0; i--) {
                try {
                    JSONObject o = queue.getJSONObject(i);
                    if ("imported".equals(o.optString("state"))) {
                        deleteQuiet(new File(o.optString("path")));
                        deleteQuiet(new File(o.optString("thumbPath")));
                        queue.remove(i);
                        n++;
                    }
                } catch (Exception ignored) { /* skip */ }
            }
        }
        if (n > 0) save(ctx);
        return n;
    }

    // ------------------------------------------------------------ AI settings

    JSONObject ai() { synchronized (lock) { return ai; } }

    void setAi(Context ctx, JSONObject cfg) {
        synchronized (lock) { ai = cfg == null ? new JSONObject() : cfg; }
        save(ctx);
    }

    String aiApiKey() {
        synchronized (lock) {
            String enc = ai.optString("apiKeyEnc");
            if (enc.isEmpty()) return "";
            try {
                byte[] blob = android.util.Base64.decode(enc, android.util.Base64.NO_WRAP);
                return decrypt(blob);
            } catch (Exception e) {
                return "";
            }
        }
    }

    /** Stores the API key encrypted with an Android Keystore key; never plain on disk. */
    void setAiApiKey(String key) {
        synchronized (lock) {
            if (key == null || key.isEmpty()) {
                ai.remove("apiKeyEnc");
                return;
            }
            try {
                ai.put("apiKeyEnc", android.util.Base64.encodeToString(encrypt(key.getBytes(StandardCharsets.UTF_8)), android.util.Base64.NO_WRAP));
            } catch (Exception ignored) {
                ai.remove("apiKeyEnc");
            }
        }
    }

    // ------------------------------------------------- Android Keystore crypto

    private SecretKey keystoreKey() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        KeyStore.Entry e = ks.getEntry(KS_ALIAS, null);
        if (e instanceof KeyStore.SecretKeyEntry) return ((KeyStore.SecretKeyEntry) e).getSecretKey();
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        kg.init(new KeyGenParameterSpec.Builder(KS_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true)
            .build());
        return kg.generateKey();
    }

    private byte[] encrypt(byte[] plain) throws Exception {
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, keystoreKey());
        byte[] iv = c.getIV();
        byte[] ct = c.doFinal(plain);
        byte[] out = new byte[1 + iv.length + ct.length];
        out[0] = (byte) iv.length;
        System.arraycopy(iv, 0, out, 1, iv.length);
        System.arraycopy(ct, 0, out, 1 + iv.length, ct.length);
        return out;
    }

    private String decrypt(byte[] blob) throws Exception {
        int ivLen = blob[0] & 0xFF;
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, keystoreKey(), new GCMParameterSpec(128, blob, 1, ivLen));
        return new String(c.doFinal(blob, 1 + ivLen, blob.length - 1 - ivLen), StandardCharsets.UTF_8);
    }
}

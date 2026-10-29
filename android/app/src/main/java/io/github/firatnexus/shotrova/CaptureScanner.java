package io.github.firatnexus.shotrova;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Scans MediaStore for new screenshots, stages app-private copies, notifies the
 * user and (with explicit consent) analyses them with the user's own AI key.
 *
 * Screenshot filter (deliberately conservative):
 * - lives in Pictures/Screenshots or DCIM/Screenshots (Xiaomi/HyperOS default),
 *   or the file name says "screenshot"/"ekran";
 * - not a pending MediaStore write (IS_PENDING = 0);
 * - screen recordings never match: they live in MediaStore.Video, and the
 *   Images query never returns them.
 * Every image is deduplicated by MediaStore id AND content hash.
 */
final class CaptureScanner {

    static final String CHANNEL_CAPTURE = "shotrova_capture";
    static final String CHANNEL_ERRORS = "shotrova_errors";
    private static final String GROUP = "shotrova_captures";
    private static final int NOTIF_ID_BASE = 41000;
    private static final String STAGE_DIR = "capture";

    private static final CaptureScanner INSTANCE = new CaptureScanner();
    static CaptureScanner get() { return INSTANCE; }
    private CaptureScanner() { }

    /** One scan pass; returns how many new screenshots were staged. */
    int scan(Context ctx) {
        CaptureStore store = new CaptureStore(ctx);
        if (!store.isEnabled()) return 0;
        if (!hasReadImagesPermission(ctx)) return 0; // nothing to do without access

        int staged = 0;
        long maxDateAdded = store.lastScanDateAdded();
        File dir = new File(ctx.getFilesDir(), STAGE_DIR);
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();

        // Full scan on first run establishes the baseline WITHOUT importing
        // history: screenshots that existed before the feature was enabled are
        // only recorded as processed, never staged or notified.
        boolean first = store.lastScanDateAdded() < 0;

        String selection = MediaStore.Images.Media.IS_PENDING + " = 0 AND ("
            + MediaStore.Images.Media.RELATIVE_PATH + " IN ('Pictures/Screenshots','Pictures/Screenshots/','DCIM/Screenshots','DCIM/Screenshots/')"
            + " OR LOWER(" + MediaStore.Images.Media.DISPLAY_NAME + ") LIKE '%screenshot%'"
            + " OR LOWER(" + MediaStore.Images.Media.DISPLAY_NAME + ") LIKE '%ekran%')";
        String[] projection = new String[] {
            MediaStore.Images.Media._ID,
            MediaStore.Images.Media.DATE_ADDED,
            MediaStore.Images.Media.DATE_TAKEN,
            MediaStore.Images.Media.DISPLAY_NAME,
            MediaStore.Images.Media.MIME_TYPE,
            MediaStore.Images.Media.SIZE,
            MediaStore.Images.Media.RELATIVE_PATH,
        };
        List<long[]> rows = new ArrayList<>(); // {id, dateAddedSec}
        List<String[]> meta = new ArrayList<>(); // parallel: name, mime, relPath
        try (Cursor c = ctx.getContentResolver().query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI, projection, selection, null,
                MediaStore.Images.Media.DATE_ADDED + " DESC")) {
            if (c != null) {
                int iId = c.getColumnIndexOrThrow(MediaStore.Images.Media._ID);
                int iAdded = c.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_ADDED);
                int iTaken = c.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_TAKEN);
                int iName = c.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME);
                int iMime = c.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE);
                int iRel = c.getColumnIndexOrThrow(MediaStore.Images.Media.RELATIVE_PATH);
                while (c.moveToNext()) {
                    long id = c.getLong(iId);
                    long added = c.getLong(iAdded);
                    if (added > maxDateAdded) maxDateAdded = added;
                    String name = c.getString(iName) == null ? "" : c.getString(iName).toLowerCase(Locale.ROOT);
                    if (name.contains("record") || name.contains("video")) continue; // paranoid: never recordings
                    rows.add(new long[] { id, added, c.getLong(iTaken) });
                    meta.add(new String[] { c.getString(iName), c.getString(iMime), c.getString(iRel) });
                }
            }
        } catch (Exception e) {
            return 0; // MediaStore unavailable (no permission, safe mode, ...): bail out honestly
        }

        for (int i = 0; i < rows.size(); i++) {
            long[] row = rows.get(i);
            if (store.isProcessed(row[0], null)) continue;
            String hash = hashOf(ctx, row[0]);
            if (store.isProcessed(row[0], hash)) {
                store.markProcessed(row[0], hash);
                continue;
            }
            if (first) {
                // Baseline pass: record but do not import pre-existing screenshots.
                store.markProcessed(row[0], hash);
                continue;
            }
            JSONObject entry = stage(ctx, store, dir, row[0], hash, meta.get(i), row[2]);
            if (entry != null) {
                store.putQueued(entry);
                store.markProcessed(row[0], hash);
                staged++;
            }
        }
        store.markScanned(maxDateAdded);
        store.save(ctx);

        if (staged > 0) {
            notifyCaptures(ctx, store);
            analysePending(ctx, store);
            // Foreground web layer (if any) pulls the staged captures in right away.
            ShotrovaBridgePlugin.emitCaptureEvent(staged);
        }
        return staged;
    }

    // ---------------------------------------------------------------- staging

    /** Copies the image (and a thumbnail) into app-private storage; returns the queue entry. */
    private JSONObject stage(Context ctx, CaptureStore store, File dir, long msId, String hash, String[] meta, long dateTaken) {
        String name = meta[0] == null || meta[0].isEmpty() ? ("screenshot-" + msId) : meta[0];
        String mime = meta[1] == null ? "image/png" : meta[1];
        String ext = "image/jpeg".equals(mime) ? "jpg" : "image/webp".equals(mime) ? "webp" : "png";
        File img = new File(dir, hash + "." + ext);
        File thumb = new File(dir, hash + "_thumb.jpg");
        if (img.exists() && img.length() > 0 && thumb.exists()) {
            return reuseEntry(img, thumb, msId, hash, name, dateTaken);
        }
        Uri uri = Uri.withAppendedPath(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, String.valueOf(msId));
        try (InputStream in = ctx.getContentResolver().openInputStream(uri)) {
            if (in == null) return null;
            try (OutputStream os = new FileOutputStream(img)) {
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
            }
        } catch (Exception e) {
            CaptureStore.deleteQuiet(img);
            return null;
        }
        if (!makeThumb(img, thumb)) CaptureStore.deleteQuiet(img);
        if (!img.exists() || img.length() == 0) return null;
        JSONObject entry = reuseEntry(img, thumb, msId, hash, name, dateTaken);
        try {
            entry.put("mimeType", mime);
            entry.put("size", img.length());
        } catch (Exception ignored) { /* skip */ }
        return entry;
    }

    private JSONObject reuseEntry(File img, File thumb, long msId, String hash, String name, long dateTaken) {
        JSONObject o = new JSONObject();
        try {
            o.put("id", "cap_" + hash.substring(0, Math.min(16, hash.length())));
            o.put("msId", msId);
            o.put("hash", hash);
            o.put("path", img.getAbsolutePath());
            o.put("thumbPath", thumb.getAbsolutePath());
            o.put("name", name);
            o.put("dateTaken", dateTaken > 0 ? dateTaken : System.currentTimeMillis());
            o.put("state", "captured");
        } catch (Exception ignored) { /* skip */ }
        return o;
    }

    /** Downsampled JPEG thumbnail for notifications and quick lists. */
    private boolean makeThumb(File src, File out) {
        try {
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(src.getAbsolutePath(), o);
            int sample = 1;
            while (o.outWidth / sample > 640) sample *= 2;
            BitmapFactory.Options o2 = new BitmapFactory.Options();
            o2.inSampleSize = sample;
            Bitmap b = BitmapFactory.decodeFile(src.getAbsolutePath(), o2);
            if (b == null) return false;
            try (FileOutputStream fos = new FileOutputStream(out)) {
                b.compress(Bitmap.CompressFormat.JPEG, 80, fos);
            } finally {
                b.recycle();
            }
            return out.exists() && out.length() > 0;
        } catch (Exception e) {
            return false;
        }
    }

    /** Full-quality copy for AI vision requests (matches the web layer's 1280px limit). */
    private String visionDataUrl(File img) {
        try {
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(img.getAbsolutePath(), o);
            int sample = 1;
            while (Math.max(o.outWidth, o.outHeight) / sample > 1280) sample *= 2;
            BitmapFactory.Options o2 = new BitmapFactory.Options();
            o2.inSampleSize = sample;
            Bitmap b = BitmapFactory.decodeFile(img.getAbsolutePath(), o2);
            if (b == null) return null;
            java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
            b.compress(Bitmap.CompressFormat.JPEG, 85, bo);
            b.recycle();
            String b64 = android.util.Base64.encodeToString(bo.toByteArray(), android.util.Base64.NO_WRAP);
            return "data:image/jpeg;base64," + b64;
        } catch (Exception e) {
            return null;
        }
    }

    private String hashOf(Context ctx, long msId) {
        Uri uri = Uri.withAppendedPath(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, String.valueOf(msId));
        try (InputStream in = ctx.getContentResolver().openInputStream(uri)) {
            if (in == null) return null;
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
            StringBuilder sb = new StringBuilder();
            for (byte x : md.digest()) sb.append(String.format("%02x", x));
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    // ---------------------------------------------------------------- analysis

    /**
     * Analyses staged entries with the user's AI settings. Honest by design:
     * - no key / AI off / no consent -> stays "Analiz bekliyor" until the app opens;
     * - vision consent off -> on-device ML Kit OCR first, only text is sent;
     * - vision consent on -> the (downscaled) image is sent, the consent text says so;
     * - failures are recorded with a reason code and retried later / on app open.
     */
    void analysePending(Context ctx, CaptureStore store) {
        JSONObject ai = store.ai();
        boolean aiOn = ai.optBoolean("enabled", false) && ai.optBoolean("autoAnalyze", false);
        String key = store.aiApiKey();
        if (!aiOn || key.isEmpty()) return; // web layer will analyse on next open

        String provider = ai.optString("provider", "openai");
        String baseUrl = ai.optString("baseUrl", "");
        String model = ai.optString("model", "");
        boolean vision = ai.optBoolean("vision", false);
        String lang = ai.optString("lang", "tr");
        String categories = ai.optString("categories", ""); // "id:name" lines

        AiClient client = new AiClient(provider, baseUrl, model, key);
        boolean network = false;
        try {
            android.net.ConnectivityManager cm = (android.net.ConnectivityManager)
                ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null) {
                android.net.NetworkInfo ni = cm.getActiveNetworkInfo();
                network = ni != null && ni.isConnected();
            }
        } catch (Exception ignored) { /* default false */ }

        com.getcapacitor.JSArray q = store.queueSnapshot();
        for (int i = 0; i < q.length(); i++) {
            JSONObject entry;
            try { entry = q.getJSONObject(i); } catch (Exception e) { continue; }
            if (!"captured".equals(entry.optString("state"))) continue;
            if (!network) {
                setState(entry, store, "pending", "no_network");
                continue;
            }
            AiClient.Chat chat = new AiClient.Chat();
            chat.json = true;
            if (vision) {
                chat.imageDataUrl = visionDataUrl(new File(entry.optString("path")));
                if (chat.imageDataUrl == null) { setState(entry, store, "pending", "read_failed"); continue; }
                chat.user = "Bu bir telefon ekran görüntüsüdür. İçeriğine bakarak yanıtla.";
            } else {
                String text = ocr(ctx, new File(entry.optString("path")));
                if (text == null) { setState(entry, store, "pending", "ocr_failed"); continue; }
                if (text.trim().isEmpty()) { setState(entry, store, "failed", "no_text"); continue; }
                chat.user = "Bu metin bir telefon ekran görüntüsünden okundu. Metne göre yanıtla.\n\nEkran görüntüsünden okunan metin:\n"
                    + text.substring(0, Math.min(2000, text.length()));
            }
            chat.system = analysisPrompt(lang, categories);
            try {
                String resp = client.chat(chat);
                JSONObject parsed = AiClient.parseJson(resp);
                JSONObject analysis = new JSONObject();
                analysis.put("title", parsed.optString("title", ""));
                analysis.put("category", parsed.optString("category", ""));
                analysis.put("tags", parsed.optJSONArray("tags") != null ? parsed.getJSONArray("tags") : new JSONArray());
                entry.put("analysis", analysis);
                setState(entry, store, "analyzed", null);
                store.putQueued(entry); // refresh + save below
            } catch (AiClient.AiException e) {
                String code = e.code.startsWith("http_") ? mapHttp(e.code) : e.code;
                boolean retry = "network".equals(code) || "no_network".equals(code) || "http_429".equals(code) || "http_500".equals(code) || "http_503".equals(code);
                setState(entry, store, retry ? "pending" : "failed", code);
            } catch (Exception e) {
                setState(entry, store, "pending", "unknown");
            }
        }
        store.save(ctx);
        notifyCaptures(ctx, store); // refresh notifications with the outcome
    }

    private static String mapHttp(String code) {
        int s = Integer.parseInt(code.substring(5));
        if (s == 401 || s == 403) return "invalid_key";
        if (s == 429) return "quota";
        if (s >= 500) return "server";
        return "http_" + s;
    }

    private void setState(JSONObject entry, CaptureStore store, String state, String error) {
        try {
            entry.put("state", state);
            if (error != null) entry.put("analysisError", error);
            else entry.remove("analysisError");
            store.putQueued(entry);
        } catch (Exception ignored) { /* skip */ }
    }

    /** English name of the app's UI language, for the analysis prompt. */
    static String languageName(String lang) {
        switch (lang == null ? "" : lang) {
            case "tr": return "Turkish";
            case "es": return "Spanish";
            case "fr": return "French";
            case "de": return "German";
            case "pt": return "Portuguese";
            case "it": return "Italian";
            case "hi": return "Hindi";
            case "ar": return "Arabic";
            case "zh": return "Simplified Chinese";
            case "ja": return "Japanese";
            case "ru": return "Russian";
            default: return "English";
        }
    }

    private static String analysisPrompt(String lang, String categories) {
        boolean tr = "tr".equals(lang);
        return (tr
            ? "Telefon ekran görüntülerini sınıflandıran bir asistansın. Kullanıcının kategorilerinden TAM OLARAK BİRİNİ seç. "
              + "Kısa bir Türkçe başlık (en fazla 6 kelime), kategori adı ve 2-4 etiket üret. "
              + "Yalnızca JSON döndür: {\"title\": \"...\", \"category\": \"...\", \"tags\": [\"...\"]}. "
              + "Uymayan yoksa kategori olarak \"Diğer\" yaz. Banka/şifre gibi hassas verileri başlıkta kullanma."
            : "You classify phone screenshots. Pick EXACTLY ONE of the user's categories. "
              + "Reply with a short title (max 6 words), the category name and 2-4 tags. "
              + "Return JSON only: {\"title\": \"...\", \"category\": \"...\", \"tags\": [\"...\"]}. "
              + "Use category \"Other\" if nothing fits. Never put sensitive data in titles. "
              + "Write the title and tags in " + languageName(lang) + ".")
            + (categories.isEmpty() ? "" : (tr ? "\nKategoriler:\n" : "\nCategories:\n") + categories);
    }

    /** On-device OCR with ML Kit (Latin script; covers Turkish). Returns null on engine failure. */
    String ocr(Context ctx, File img) {
        try {
            TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            InputImage image = InputImage.fromFilePath(ctx, Uri.fromFile(img));
            com.google.android.gms.tasks.Task<com.google.mlkit.vision.text.Text> task = recognizer.process(image);
            // The capture worker runs on a background thread; block for the result.
            long deadline = System.currentTimeMillis() + 30000;
            while (!task.isComplete()) {
                if (System.currentTimeMillis() > deadline) { recognizer.close(); return null; }
                Thread.sleep(50);
            }
            if (!task.isSuccessful()) { recognizer.close(); return null; }
            String text = task.getResult().getText();
            recognizer.close();
            return text;
        } catch (Exception e) {
            return null;
        }
    }

    // ------------------------------------------------------------ notifications

    /**
     * Resources in the app's own UI language (mirrored from the web settings),
     * so notifications match the app rather than the phone's system language.
     * values-<lang>/strings.xml exist for all twelve UI languages; Turkish is
     * the default resource set.
     */
    static Context localized(Context ctx, String lang) {
        if (lang == null || lang.isEmpty()) return ctx;
        Configuration conf = new Configuration(ctx.getResources().getConfiguration());
        conf.setLocale(Locale.forLanguageTag("zh".equals(lang) ? "zh-CN" : lang));
        return ctx.createConfigurationContext(conf);
    }

    static void ensureChannels(Context ctx) {
        ensureChannels(ctx, ctx);
    }

    static void ensureChannels(Context ctx, Context res) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel capture = new NotificationChannel(CHANNEL_CAPTURE,
            res.getString(R.string.capture_notif_channel), NotificationManager.IMPORTANCE_DEFAULT);
        capture.setDescription(res.getString(R.string.capture_notif_channel_desc));
        nm.createNotificationChannel(capture);
        NotificationChannel errors = new NotificationChannel(CHANNEL_ERRORS,
            res.getString(R.string.errors_notif_channel), NotificationManager.IMPORTANCE_LOW);
        errors.setDescription(res.getString(R.string.errors_notif_channel_desc));
        nm.createNotificationChannel(errors);
    }

    /** Posts/refreshes capture notifications; groups when several arrive together. */
    private void notifyCaptures(Context ctx, CaptureStore store) {
        if (Build.VERSION.SDK_INT >= 33
            && ctx.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return; // honest: no permission, no notification
        }
        Context res = localized(ctx, store.ai().optString("lang", "tr"));
        ensureChannels(ctx, res);
        com.getcapacitor.JSArray q = store.queueSnapshot();
        int pending = 0, analyzed = 0, failed = 0, total = 0;
        String lastTitle = null, lastCategory = null;
        String lastThumb = null, lastId = null;
        for (int i = 0; i < q.length(); i++) {
            try {
                JSONObject e = q.getJSONObject(i);
                if ("imported".equals(e.optString("state"))) continue;
                total++;
                switch (e.optString("state")) {
                    case "analyzed": {
                        analyzed++;
                        JSONObject a = e.optJSONObject("analysis");
                        lastTitle = a == null ? "" : a.optString("title", "");
                        lastCategory = a == null ? "" : a.optString("category", "");
                        lastThumb = e.optString("thumbPath");
                        lastId = e.optString("id");
                        break;
                    }
                    case "failed": failed++; break;
                    default: {
                        pending++;
                        lastThumb = e.optString("thumbPath");
                        lastId = e.optString("id");
                    }
                }
            } catch (Exception ignored) { /* skip */ }
        }
        if (total == 0) return;
        NotificationManagerCompat nm = NotificationManagerCompat.from(ctx);

        // Summary for groups (several screenshots arriving quickly).
        if (total > 1) {
            NotificationCompat.Builder sum = new NotificationCompat.Builder(ctx, CHANNEL_CAPTURE)
                .setSmallIcon(R.drawable.ic_stat_shotrova)
                .setContentTitle(res.getString(R.string.capture_notif_summary_title))
                .setContentText(res.getString(R.string.capture_notif_summary_text, total))
                .setGroup(GROUP)
                .setGroupSummary(true)
                .setAutoCancel(true)
                .setContentIntent(openApp(ctx, null));
            try { nm.notify(NOTIF_ID_BASE, sum.build()); } catch (SecurityException ignored) { /* skip */ }
        }

        // Latest item detail notification (id-stable so a later analysis updates it).
        String title, text;
        if (analyzed > 0 && lastTitle != null) {
            title = res.getString(R.string.capture_notif_saved_title);
            text = lastCategory == null || lastCategory.isEmpty()
                ? res.getString(R.string.capture_notif_saved_nocat, lastTitle)
                : res.getString(R.string.capture_notif_saved, lastTitle, lastCategory);
        } else if (failed > 0 && pending == 0) {
            title = res.getString(R.string.capture_notif_failed_title);
            text = res.getString(R.string.capture_notif_failed_text);
        } else if (pending > 0 && analyzed == 0 && failed == 0) {
            title = res.getString(R.string.capture_notif_pending_title);
            text = res.getString(R.string.capture_notif_pending_text);
        } else {
            title = res.getString(R.string.capture_notif_mixed_title);
            text = res.getString(R.string.capture_notif_mixed_text, analyzed, pending, failed);
        }
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_CAPTURE)
            .setSmallIcon(R.drawable.ic_stat_shotrova)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setGroup(GROUP)
            .setAutoCancel(true)
            .setContentIntent(openApp(ctx, lastId));
        if (lastThumb != null) {
            Bitmap bmp = BitmapFactory.decodeFile(lastThumb);
            if (bmp != null) b.setStyle(new NotificationCompat.BigPictureStyle().bigPicture(bmp).bigLargeIcon((android.graphics.Bitmap) null));
        }
        // Actions: both open the app; "Kategoriyi değiştir" targets the item so the
        // web layer can jump straight to its category editor after import.
        b.addAction(0, res.getString(R.string.capture_notif_change_cat), openApp(ctx, lastId, true));
        b.addAction(0, res.getString(R.string.capture_notif_open), openApp(ctx, lastId));
        try { nm.notify(NOTIF_ID_BASE + 1, b.build()); } catch (SecurityException ignored) { /* skip */ }
    }

    private static PendingIntent openApp(Context ctx, String captureId) {
        return openApp(ctx, captureId, false);
    }

    private static PendingIntent openApp(Context ctx, String captureId, boolean focusCategory) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setAction(Intent.ACTION_MAIN);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (captureId != null) {
            i.putExtra("shotrovaCaptureId", captureId);
            i.putExtra("shotrovaFocusCategory", focusCategory);
        }
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(ctx, 9001, i, flags);
    }

    // ------------------------------------------------------------ permissions

    static boolean hasReadImagesPermission(Context ctx) {
        if (Build.VERSION.SDK_INT >= 33) {
            return ctx.checkSelfPermission(android.Manifest.permission.READ_MEDIA_IMAGES)
                == PackageManager.PERMISSION_GRANTED;
        }
        return ctx.checkSelfPermission(android.Manifest.permission.READ_EXTERNAL_STORAGE)
            == PackageManager.PERMISSION_GRANTED;
    }

    /** full | partial | none — mirrors the official Android 14 partial-access guidance. */
    static String mediaAccessState(Context ctx) {
        if (Build.VERSION.SDK_INT >= 34) {
            boolean full = ctx.checkSelfPermission(android.Manifest.permission.READ_MEDIA_IMAGES)
                == PackageManager.PERMISSION_GRANTED;
            boolean partial = ctx.checkSelfPermission(android.Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED)
                == PackageManager.PERMISSION_GRANTED;
            if (full) return "full";
            if (partial) return "partial";
            return "none";
        }
        if (Build.VERSION.SDK_INT >= 33) {
            return ctx.checkSelfPermission(android.Manifest.permission.READ_MEDIA_IMAGES)
                == PackageManager.PERMISSION_GRANTED ? "full" : "none";
        }
        return ctx.checkSelfPermission(android.Manifest.permission.READ_EXTERNAL_STORAGE)
            == PackageManager.PERMISSION_GRANTED ? "full" : "none";
    }
}

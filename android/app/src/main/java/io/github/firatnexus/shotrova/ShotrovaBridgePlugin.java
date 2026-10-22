package io.github.firatnexus.shotrova;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipDescription;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.webkit.MimeTypeMap;

import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Native bridge for the Shotrova Android app.
 *
 * - Receives images shared from other apps (Share -> Shotrova) and stages
 *   copies in the app cache, so the web layer can import them.
 * - Saves files (backups, originals) through the system "Save as" dialog.
 * - Shares a file from Shotrova to other apps.
 * - Reads an image from the clipboard when the user taps "Paste".
 * - Colours the system bars to match the theme.
 *
 * It never scans the gallery: only files the user explicitly picks or shares
 * are ever read.
 */
@CapacitorPlugin(name = "ShotrovaBridge")
public class ShotrovaBridgePlugin extends Plugin {

    /** Larger files are skipped; the web layer reports a size error for them. */
    private static final long MAX_BYTES = 64L * 1024 * 1024;
    private static final ExecutorService IO = Executors.newSingleThreadExecutor();

    private static final List<JSObject> pending = new ArrayList<>();
    private static ShotrovaBridgePlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
    }

    // ------------------------------------------------------------- share in

    /** Called by MainActivity for the launch intent and for new intents. */
    static void handleIntent(Context ctx, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) return;
        final List<Uri> uris = new ArrayList<>();
        if (Intent.ACTION_SEND.equals(action)) {
            Uri u = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (u != null) uris.add(u);
        } else {
            ArrayList<Uri> list = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (list != null) uris.addAll(list);
        }
        ClipData clip = intent.getClipData();
        if (uris.isEmpty() && clip != null) {
            for (int i = 0; i < clip.getItemCount(); i++) {
                Uri u = clip.getItemAt(i).getUri();
                if (u != null) uris.add(u);
            }
        }
        // Consume the intent so a configuration change does not import twice.
        intent.setAction(Intent.ACTION_MAIN);
        if (uris.isEmpty()) return;
        final Context app = ctx.getApplicationContext();
        IO.execute(() -> {
            File dir = new File(app.getCacheDir(), "inbox");
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
            int index = 0;
            List<JSObject> staged = new ArrayList<>();
            for (Uri uri : uris) {
                JSObject f = copyToCache(app, uri, dir, index++);
                if (f != null) staged.add(f);
            }
            synchronized (pending) {
                pending.addAll(staged);
            }
            ShotrovaBridgePlugin p = instance;
            if (p != null) {
                JSObject ev = new JSObject();
                ev.put("count", staged.size());
                p.notifyListeners("share", ev, true);
            }
        });
    }

    private static JSObject copyToCache(Context ctx, Uri uri, File dir, int index) {
        ContentResolver cr = ctx.getContentResolver();
        String name = displayName(cr, uri);
        String mime = cr.getType(uri);
        if (mime == null) {
            String ext = MimeTypeMap.getFileExtensionFromUrl(name);
            mime = ext == null ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext.toLowerCase());
        }
        File out = new File(dir, System.currentTimeMillis() + "-" + index + ".bin");
        long total = 0;
        try (InputStream in = cr.openInputStream(uri); OutputStream os = new FileOutputStream(out)) {
            if (in == null) return null;
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) {
                total += n;
                if (total > MAX_BYTES) break;
                os.write(buf, 0, n);
            }
        } catch (Exception e) {
            //noinspection ResultOfMethodCallIgnored
            out.delete();
            JSObject err = new JSObject();
            err.put("name", name);
            err.put("error", "read_failed");
            return err;
        }
        JSObject o = new JSObject();
        o.put("path", out.getAbsolutePath());
        o.put("name", name);
        o.put("mime", mime == null ? "" : mime);
        o.put("size", total);
        o.put("tooLarge", total > MAX_BYTES);
        o.put("lastModified", System.currentTimeMillis());
        return o;
    }

    private static String displayName(ContentResolver cr, Uri uri) {
        String name = null;
        try (Cursor c = cr.query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) name = c.getString(0);
        } catch (Exception ignored) {
            // Fall back to the last path segment below.
        }
        if (name == null) name = uri.getLastPathSegment();
        if (name == null || name.isEmpty()) name = "shared-image";
        return name.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    /** Returns (and forgets) files staged from share intents. */
    @PluginMethod
    public void takeSharedFiles(PluginCall call) {
        JSArray arr = new JSArray();
        synchronized (pending) {
            for (JSObject o : pending) arr.put(o);
            pending.clear();
        }
        JSObject r = new JSObject();
        r.put("files", arr);
        call.resolve(r);
    }

    /** Deletes staged copies once the web layer has stored them in IndexedDB. */
    @PluginMethod
    public void releaseFiles(PluginCall call) {
        File inbox = new File(getContext().getCacheDir(), "inbox");
        JSArray paths = call.getArray("paths", new JSArray());
        try {
            String root = inbox.getCanonicalPath() + File.separator;
            for (int i = 0; i < paths.length(); i++) {
                File f = new File(paths.getString(i));
                // Only ever delete our own staged copies.
                if (f.getCanonicalPath().startsWith(root)) //noinspection ResultOfMethodCallIgnored
                    f.delete();
            }
        } catch (Exception e) {
            call.reject("release_failed", e);
            return;
        }
        call.resolve();
    }

    // ------------------------------------------------------------- save as

    @PluginMethod
    public void createDocument(PluginCall call) {
        String name = call.getString("name", "shotrova-file");
        String mime = call.getString("mime", "application/octet-stream");
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(mime);
        i.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(call, i, "onCreateDocument");
    }

    @ActivityCallback
    private void onCreateDocument(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject r = new JSObject();
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            r.put("uri", "");
            call.resolve(r);
            return;
        }
        r.put("uri", data.getData().toString());
        call.resolve(r);
    }

    /** Writes one base64 chunk to a document picked with createDocument(). */
    @PluginMethod
    public void writeDocumentChunk(PluginCall call) {
        final String uri = call.getString("uri");
        final String b64 = call.getString("data", "");
        final boolean append = Boolean.TRUE.equals(call.getBoolean("append", false));
        if (uri == null || uri.isEmpty()) {
            call.reject("no_uri");
            return;
        }
        IO.execute(() -> {
            try (OutputStream os = getContext().getContentResolver().openOutputStream(Uri.parse(uri), append ? "wa" : "wt")) {
                if (os == null) throw new IllegalStateException("no stream");
                os.write(Base64.decode(b64, Base64.DEFAULT));
                call.resolve();
            } catch (Exception e) {
                call.reject("write_failed", e);
            }
        });
    }

    // ------------------------------------------------------------- share out

    /** Writes one base64 chunk to cache/outbox/<name>. */
    @PluginMethod
    public void writeOutboxChunk(PluginCall call) {
        final String name = safeName(call.getString("name", "shotrova-file"));
        final String b64 = call.getString("data", "");
        final boolean append = Boolean.TRUE.equals(call.getBoolean("append", false));
        IO.execute(() -> {
            File dir = new File(getContext().getCacheDir(), "outbox");
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
            if (!append) {
                File[] old = dir.listFiles();
                if (old != null) for (File f : old) //noinspection ResultOfMethodCallIgnored
                    f.delete();
            }
            try (OutputStream os = new FileOutputStream(new File(dir, name), append)) {
                os.write(Base64.decode(b64, Base64.DEFAULT));
                call.resolve();
            } catch (Exception e) {
                call.reject("write_failed", e);
            }
        });
    }

    @PluginMethod
    public void shareOutboxFile(PluginCall call) {
        String name = safeName(call.getString("name", "shotrova-file"));
        String mime = call.getString("mime", "application/octet-stream");
        String title = call.getString("title", "");
        String text = call.getString("text", "");
        File f = new File(new File(getContext().getCacheDir(), "outbox"), name);
        if (!f.exists()) {
            call.reject("missing_file");
            return;
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType(mime);
        send.putExtra(Intent.EXTRA_STREAM, uri);
        if (!title.isEmpty()) send.putExtra(Intent.EXTRA_SUBJECT, title);
        if (!text.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, text);
        send.setClipData(ClipData.newRawUri(name, uri));
        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Intent chooser = Intent.createChooser(send, title.isEmpty() ? null : title);
        chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getActivity().startActivity(chooser);
        call.resolve();
    }

    @PluginMethod
    public void shareText(PluginCall call) {
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, call.getString("text", ""));
        String title = call.getString("title", "");
        if (!title.isEmpty()) send.putExtra(Intent.EXTRA_SUBJECT, title);
        getActivity().startActivity(Intent.createChooser(send, title.isEmpty() ? null : title));
        call.resolve();
    }

    private static String safeName(String n) {
        String s = n == null ? "" : n.replaceAll("[\\\\/:*?\"<>|]", "_");
        return s.isEmpty() ? "shotrova-file" : s;
    }

    // ------------------------------------------------------------- clipboard

    /** Copies an image from the clipboard (if any) into the inbox and returns it. */
    @PluginMethod
    public void readClipboardImage(PluginCall call) {
        JSObject r = new JSObject();
        ClipboardManager cm = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
        if (cm == null || !cm.hasPrimaryClip()) {
            r.put("files", new JSArray());
            call.resolve(r);
            return;
        }
        ClipData clip = cm.getPrimaryClip();
        ClipDescription desc = cm.getPrimaryClipDescription();
        final List<Uri> uris = new ArrayList<>();
        if (clip != null && desc != null && desc.hasMimeType("image/*")) {
            for (int i = 0; i < clip.getItemCount(); i++) {
                Uri u = clip.getItemAt(i).getUri();
                if (u != null) uris.add(u);
            }
        }
        if (uris.isEmpty()) {
            r.put("files", new JSArray());
            call.resolve(r);
            return;
        }
        final Context app = getContext().getApplicationContext();
        IO.execute(() -> {
            File dir = new File(app.getCacheDir(), "inbox");
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
            JSArray arr = new JSArray();
            int i = 0;
            for (Uri u : uris) {
                JSObject f = copyToCache(app, u, dir, i++);
                if (f != null) arr.put(f);
            }
            JSObject res = new JSObject();
            res.put("files", arr);
            call.resolve(res);
        });
    }

    // ------------------------------------------------------------- system bars

    @PluginMethod
    public void setSystemBars(PluginCall call) {
        final boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
        final String color = call.getString("color", dark ? "#14161C" : "#F6F4EF");
        getActivity().runOnUiThread(() -> {
            Window w = getActivity().getWindow();
            int bg;
            try {
                bg = Color.parseColor(color);
            } catch (IllegalArgumentException e) {
                bg = dark ? Color.parseColor("#14161C") : Color.parseColor("#F6F4EF");
            }
            w.setStatusBarColor(bg);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) w.setNavigationBarColor(bg);
            View decor = w.getDecorView();
            WindowInsetsControllerCompat c = WindowCompat.getInsetsController(w, decor);
            c.setAppearanceLightStatusBars(!dark);
            c.setAppearanceLightNavigationBars(!dark);
            decor.setBackgroundColor(bg);
        });
        call.resolve();
    }
}

package io.github.firatnexus.shotrova;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Minimal AI provider client for background screenshot analysis.
 *
 * Mirrors the web layer's src/ai/providers.ts request formats exactly
 * (OpenAI-compatible chat/completions, Anthropic messages, Google Gemini
 * generateContent) so a screenshot analysed in the background produces the
 * same result as one analysed inside the app. Plain HttpURLConnection; no
 * extra dependencies. The API key is user-supplied and only ever used for
 * these calls — never logged, never stored unencrypted.
 */
final class AiClient {

    /** Request shape: system prompt, user text, optional image data URL. */
    static class Chat {
        String system;
        String user;
        /** "data:image/jpeg;base64,..." or null for text-only. */
        String imageDataUrl;
        boolean json;
    }

    static class AiException extends Exception {
        final String code; // network | http_<status> | empty | bad_json
        AiException(String code, String message) {
            super(message);
            this.code = code;
        }
    }

    private final String provider; // openai | anthropic | google | openrouter | custom
    private final String baseUrl;
    private final String model;
    private final String apiKey;

    AiClient(String provider, String baseUrl, String model, String apiKey) {
        this.provider = provider == null ? "openai" : provider;
        this.baseUrl = trim(baseUrl);
        this.model = model == null ? "" : model;
        this.apiKey = apiKey == null ? "" : apiKey;
    }

    private static String trim(String s) { return s == null ? "" : s.replaceAll("/+$", ""); }

    /** Sends one request; returns the assistant text. Throws AiException with a code. */
    String chat(Chat req) throws AiException {
        if (apiKey.isEmpty()) throw new AiException("no_key", "missing API key");
        if (model.isEmpty()) throw new AiException("no_model", "missing model");
        try {
            switch (provider) {
                case "anthropic":
                    return chatAnthropic(req);
                case "google":
                    return chatGoogle(req);
                default:
                    return chatOpenAiCompatible(req);
            }
        } catch (AiException e) {
            throw e;
        } catch (Exception e) {
            throw new AiException("network", e.getMessage() == null ? "network error" : e.getMessage());
        }
    }

    // ---------------------------------------------------------- HTTP plumbing

    private static class HttpResult {
        int status;
        String body;
    }

    private static HttpResult post(String url, JSONObject headers, String body) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setRequestMethod("POST");
        c.setConnectTimeout(15000);
        c.setReadTimeout(60000);
        c.setDoOutput(true);
        java.util.Iterator<String> hk = headers.keys();
        while (hk.hasNext()) {
            String k = hk.next();
            c.setRequestProperty(k, headers.optString(k));
        }
        c.setRequestProperty("Content-Type", "application/json");
        try (OutputStream os = c.getOutputStream()) {
            os.write(body.getBytes(StandardCharsets.UTF_8));
        }
        HttpResult r = new HttpResult();
        r.status = c.getResponseCode();
        InputStream in = r.status >= 400 ? c.getErrorStream() : c.getInputStream();
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        if (in != null) while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
        r.body = bo.toString("UTF-8");
        if (r.status >= 400) throw new AiException("http_" + r.status, "HTTP " + r.status + ": " + shorten(r.body));
        return r;
    }

    private static String shorten(String s) { return s == null ? "" : s.replaceAll("\\s+", " ").substring(0, Math.min(300, s.length())); }

    // --------------------------------------------- OpenAI-compatible providers

    private String chatOpenAiCompatible(Chat req) throws Exception {
        JSONObject content = new JSONObject();
        if (req.imageDataUrl != null) {
            content.put("type", "image_url");
            content.put("image_url", new JSONObject().put("url", req.imageDataUrl).put("detail", "high"));
        }
        JSONObject textPart = new JSONObject().put("type", "text").put("text", req.user);
        JSONArray contentArr = req.imageDataUrl != null
            ? new JSONArray().put(content).put(textPart)
            : new JSONArray().put(textPart);
        JSONArray messages = new JSONArray();
        if (req.system != null && !req.system.isEmpty()) messages.put(new JSONObject().put("role", "system").put("content", req.system));
        messages.put(new JSONObject().put("role", "user").put("content", contentArr));
        JSONObject body = new JSONObject()
            .put("model", model)
            .put("temperature", 0)
            .put("messages", messages);
        if (req.json) body.put("response_format", new JSONObject().put("type", "json_object"));
        JSONObject headers = new JSONObject().put("Authorization", "Bearer " + apiKey);
        HttpResult r = post(trim(baseUrl) + "/chat/completions", headers, body.toString());
        return extract(r.body, "choices[0].message.content");
    }

    // ------------------------------------------------------- Anthropic messages

    private String chatAnthropic(Chat req) throws Exception {
        JSONArray content = new JSONArray();
        if (req.imageDataUrl != null) {
            String[] parts = splitDataUrl(req.imageDataUrl);
            content.put(new JSONObject()
                .put("type", "image")
                .put("source", new JSONObject()
                    .put("type", "base64")
                    .put("media_type", parts[0])
                    .put("data", parts[1])));
        }
        content.put(new JSONObject().put("type", "text").put("text", req.user));
        JSONArray messages = new JSONArray().put(new JSONObject().put("role", "user").put("content", content));
        JSONObject body = new JSONObject()
            .put("model", model)
            .put("max_tokens", 1024)
            .put("messages", messages);
        if (req.system != null && !req.system.isEmpty()) body.put("system", req.system);
        JSONObject headers = new JSONObject()
            .put("x-api-key", apiKey)
            .put("anthropic-version", "2023-06-01");
        String base = trim(baseUrl);
        if (base.endsWith("/v1")) base = base.substring(0, base.length() - 3);
        HttpResult r = post(base + "/v1/messages", headers, body.toString());
        return extract(r.body, null); // content[] text join
    }

    // ------------------------------------------------- Google Gemini generate

    private String chatGoogle(Chat req) throws Exception {
        JSONArray parts = new JSONArray();
        if (req.imageDataUrl != null) {
            String[] p = splitDataUrl(req.imageDataUrl);
            parts.put(new JSONObject().put("inline_data", new JSONObject()
                .put("mime_type", p[0]).put("data", p[1])));
        }
        parts.put(new JSONObject().put("text", req.user));
        JSONObject body = new JSONObject()
            .put("contents", new JSONArray().put(new JSONObject().put("role", "user").put("parts", parts)));
        if (req.system != null && !req.system.isEmpty()) {
            body.put("systemInstruction", new JSONObject().put("parts", new JSONArray().put(new JSONObject().put("text", req.system))));
        }
        JSONObject gen = new JSONObject().put("temperature", 0);
        if (req.json) gen.put("responseMimeType", "application/json");
        body.put("generationConfig", gen);
        JSONObject headers = new JSONObject().put("x-goog-api-key", apiKey);
        HttpResult r = post(trim(baseUrl) + "/v1beta/models/" + model + ":generateContent", headers, body.toString());
        return extract(r.body, "candidates[0].content.parts[].text");
    }

    // ------------------------------------------------------------ helpers

    private static String[] splitDataUrl(String dataUrl) {
        int comma = dataUrl.indexOf(',');
        String meta = dataUrl.substring(5, comma); // image/jpeg;base64
        String mime = meta.split(";")[0];
        return new String[] { mime, dataUrl.substring(comma + 1) };
    }

    /** Pulls the assistant text out of a provider response. */
    private static String extract(String body, String path) throws AiException {
        if (body == null || body.isEmpty()) throw new AiException("empty", "empty response");
        try {
            JSONObject j = new JSONObject(body);
            if (path != null && path.startsWith("choices")) {
                String text = j.getJSONArray("choices").getJSONObject(0).getJSONObject("message").optString("content", "");
                if (text.isEmpty()) throw new AiException("empty", "AI provider returned an empty response");
                return text;
            }
            if (path != null && path.startsWith("candidates")) {
                JSONArray parts = j.getJSONArray("candidates").getJSONObject(0).getJSONObject("content").getJSONArray("parts");
                StringBuilder sb = new StringBuilder();
                for (int i = 0; i < parts.length(); i++) sb.append(parts.getJSONObject(i).optString("text", ""));
                if (sb.length() == 0) throw new AiException("empty", "AI provider returned an empty response");
                return sb.toString();
            }
            // Anthropic
            JSONArray blocks = j.getJSONArray("content");
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < blocks.length(); i++) {
                JSONObject b = blocks.getJSONObject(i);
                if ("text".equals(b.optString("type"))) sb.append(b.optString("text", ""));
            }
            if (sb.length() == 0) throw new AiException("empty", "AI provider returned an empty response");
            return sb.toString();
        } catch (AiException e) {
            throw e;
        } catch (Exception e) {
            throw new AiException("bad_json", "unparseable response");
        }
    }

    /** Tolerant JSON extraction (fenced markdown, leading prose) — same as the web layer. */
    static JSONObject parseJson(String content) throws AiException {
        String trimmed = content == null ? "" : content.trim();
        java.util.regex.Matcher fenced = java.util.regex.Pattern
            .compile("```(?:json)?\\s*([\\s\\S]*?)```").matcher(trimmed);
        String raw = fenced.find() ? fenced.group(1) : trimmed;
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end < start) throw new AiException("bad_json", "AI response is not JSON");
        try {
            return new JSONObject(raw.substring(start, end + 1));
        } catch (Exception e) {
            throw new AiException("bad_json", "AI response is not JSON");
        }
    }
}

package com.securechat.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.util.Base64;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Small, origin-restricted Android shell for the shared Cipher client.
 *
 * Local assets are served from a synthetic HTTPS origin, never file://. There is
 * no native cryptography claim: keys are passphrase-wrapped by the web client,
 * not hardware-backed or biometric-bound. See SECURITY.md before real use.
 */
public final class MainActivity extends Activity {
    private static final String ASSET_ORIGIN = "https://appassets.androidplatform.net";
    private static final int PICK_FILE = 11, EXPORT_FILE = 12, MICROPHONE = 13;
    private WebView webView;
    private String trustedOrigin;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest pendingPermission;
    private byte[] pendingExport;
    private boolean externalFlow;

    @Override @SuppressLint("SetJavaScriptEnabled")
    public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        getWindow().setStatusBarColor(Color.rgb(246, 247, 243));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        String configured = getPreferences(MODE_PRIVATE).getString("relay", BuildConfig.CIPHER_ORIGIN);
        trustedOrigin = validOrigin(configured) ? normalizeOrigin(configured) : ASSET_ORIGIN;
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(246, 247, 243));
        setContentView(webView);
        if (Build.VERSION.SDK_INT >= 35) {
            webView.setOnApplyWindowInsetsListener((view, insets) -> {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
                return insets;
            });
        }
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        webView.addJavascriptInterface(new ExportBridge(), "CipherAndroid");
        webView.setWebViewClient(new RestrictedClient());
        webView.setWebChromeClient(new ChromeClient());
        webView.setDownloadListener((url, agent, disposition, mime, length) -> {
            if (url.startsWith("data:") && url.length() < 36 * 1024 * 1024) new ExportBridge().saveFile(url, "cipher-export");
            else toast("Use the file's Save or Export button to choose a destination.");
        });
        webView.loadUrl(trustedOrigin + "/");
    }

    private static boolean validOrigin(String value) {
        if (value == null || value.isEmpty()) return false;
        Uri uri = Uri.parse(value);
        String path = uri.getPath();
        return "https".equals(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null
                && uri.getQuery() == null && uri.getFragment() == null
                && (path == null || path.isEmpty() || path.equals("/"));
    }
    private static String normalizeOrigin(String value) {
        Uri uri = Uri.parse(value);
        return "https://" + uri.getEncodedAuthority().toLowerCase(Locale.ROOT);
    }
    private boolean trusted(Uri uri) {
        return "https".equals(uri.getScheme()) && uri.getEncodedAuthority() != null
                && trustedOrigin.equals("https://" + uri.getEncodedAuthority().toLowerCase(Locale.ROOT));
    }
    private void toast(String message) { runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_LONG).show()); }

    private final class RestrictedClient extends WebViewClient {
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            if (trusted(request.getUrl())) return false;
            // No intent://, file://, unknown deep links, or unprompted external navigation.
            if (request.hasGesture() && ("https".equals(request.getUrl().getScheme()) || "http".equals(request.getUrl().getScheme()))) {
                new AlertDialog.Builder(MainActivity.this).setTitle("Leave your private space?")
                        .setMessage("This link opens in your browser. Cipher cannot verify the destination.\n\n" + request.getUrl().getHost())
                        .setNegativeButton("Stay here", null)
                        .setPositiveButton("Open browser", (dialog, which) -> {
                            try { startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl())); }
                            catch (Exception error) { toast("No browser is available."); }
                        }).show();
            }
            return true;
        }
        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!trusted(uri)) return response(403, "Blocked", "text/plain", "External requests are blocked.");
            if (!ASSET_ORIGIN.equals(trustedOrigin)) return null;
            String path = uri.getPath();
            if (path == null || path.equals("/")) path = "/index.html";
            if (path.startsWith("/api/")) return response(503, "Offline", "application/json", "{\"error\":\"This is the offline Android workspace. Open Settings → Android relay to connect to an HTTPS deployment for real accounts.\"}");
            if (path.contains("..") || path.contains("\\") || path.indexOf('\0') >= 0 || !"GET".equals(request.getMethod())) return response(403, "Blocked", "text/plain", "Invalid asset path.");
            try {
                InputStream stream = getAssets().open("web" + path);
                String mime = mimeType(path);
                Map<String, String> headers = new HashMap<>();
                headers.put("Content-Security-Policy", "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'");
                headers.put("X-Content-Type-Options", "nosniff");
                headers.put("Cache-Control", "no-store");
                return new WebResourceResponse(mime, mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") ? "UTF-8" : null, 200, "OK", headers, stream);
            } catch (Exception error) { return response(404, "Not found", "text/plain", "Asset not found."); }
        }
        // The default TLS-error handler cancels the load. Never override it to proceed.
    }
    private WebResourceResponse response(int status, String reason, String mime, String value) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        return new WebResourceResponse(mime, "UTF-8", status, reason, headers, new ByteArrayInputStream(value.getBytes(StandardCharsets.UTF_8)));
    }
    private static String mimeType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".woff")) return "font/woff";
        if (path.endsWith(".webmanifest")) return "application/manifest+json";
        if (path.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    private final class ChromeClient extends WebChromeClient {
        @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams parameters) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            externalFlow = true;
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
            java.util.ArrayList<String> accepted = new java.util.ArrayList<>();
            for (String group : parameters.getAcceptTypes()) for (String type : group.split(",")) {
                String normalized = type.trim();
                if (normalized.contains("/")) accepted.add(normalized);
            }
            if (accepted.size() == 1) intent.setType(accepted.get(0));
            else if (!accepted.isEmpty()) intent.putExtra(Intent.EXTRA_MIME_TYPES, accepted.toArray(new String[0]));
            try { startActivityForResult(intent, PICK_FILE); }
            catch (Exception error) { fileCallback.onReceiveValue(null); fileCallback = null; externalFlow = false; toast("No file picker is available."); }
            return true;
        }
        @Override public void onPermissionRequest(PermissionRequest request) {
            runOnUiThread(() -> {
                if (!trusted(request.getOrigin()) || request.getResources().length != 1 || !PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(request.getResources()[0])) { request.deny(); return; }
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                } else {
                    if (pendingPermission != null) pendingPermission.deny();
                    pendingPermission = request;
                    externalFlow = true;
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MICROPHONE);
                }
            });
        }
        @Override public void onPermissionRequestCanceled(PermissionRequest request) {
            if (pendingPermission == request) { pendingPermission = null; externalFlow = false; }
        }
    }

    /** Write-only, user-confirmed export bridge. It cannot read files, keys, or credentials. */
    public final class ExportBridge {
        @JavascriptInterface public void configureRelay() {
            runOnUiThread(() -> {
                if (!trusted(Uri.parse(webView.getUrl() == null ? "" : webView.getUrl()))) return;
                EditText field = new EditText(MainActivity.this);
                field.setSingleLine(true);
                field.setText(ASSET_ORIGIN.equals(trustedOrigin) ? "" : trustedOrigin);
                field.setHint("https://your-cipher-server.example");
                field.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
                new AlertDialog.Builder(MainActivity.this).setTitle("Your Android relay")
                        .setMessage("Use an HTTPS deployment you trust. It delivers the client code and stores encrypted messages. Switching clears this device's cookies and returns you to a locked account. Never use this prototype for high-risk communication.")
                        .setView(field).setNegativeButton("Cancel", null)
                        .setNeutralButton("Offline demo", (dialog, which) -> changeRelay(""))
                        .setPositiveButton("Connect", (dialog, which) -> {
                            String value = field.getText().toString().trim();
                            if (!validOrigin(value)) { toast("Use an HTTPS origin with no path, credentials, query, or fragment."); return; }
                            changeRelay(normalizeOrigin(value));
                        }).show();
            });
        }
        @JavascriptInterface public void saveFile(String dataUrl, String filename) {
            if (dataUrl == null || dataUrl.length() > 36 * 1024 * 1024 || !dataUrl.startsWith("data:") || !dataUrl.contains(";base64,")) { toast("This export is too large or invalid."); return; }
            runOnUiThread(() -> {
                if (!trusted(Uri.parse(webView.getUrl() == null ? "" : webView.getUrl())) || pendingExport != null) return;
                try {
                    pendingExport = Base64.decode(dataUrl.substring(dataUrl.indexOf(',') + 1), Base64.DEFAULT);
                    String safeName = filename == null ? "cipher-export" : filename.replaceAll("[\\\\/\\p{Cntrl}]", "_");
                    if (safeName.length() > 160) safeName = safeName.substring(0, 160);
                    externalFlow = true;
                    startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                            .setType("application/octet-stream").putExtra(Intent.EXTRA_TITLE, safeName), EXPORT_FILE);
                } catch (Exception error) { clearExport(); externalFlow = false; toast("Could not start export."); }
            });
        }
    }
    private void changeRelay(String origin) {
        getPreferences(MODE_PRIVATE).edit().putString("relay", origin).apply();
        // Destroy the old page before changing the allowed origin, so its script
        // cannot keep using native bridge capabilities across the transition.
        webView.removeJavascriptInterface("CipherAndroid");
        webView.loadUrl("about:blank");
        CookieManager.getInstance().removeAllCookies(value -> recreate());
    }
    private void clearExport() {
        if (pendingExport != null) Arrays.fill(pendingExport, (byte) 0);
        pendingExport = null;
    }
    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(code, permissions, grants);
        externalFlow = false;
        if (code == MICROPHONE && pendingPermission != null) {
            if (grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED) pendingPermission.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            else pendingPermission.deny();
            pendingPermission = null;
        }
    }
    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        externalFlow = false;
        if (code == PICK_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(result == RESULT_OK && data != null && data.getData() != null ? new Uri[]{data.getData()} : null);
            fileCallback = null;
        }
        if (code == EXPORT_FILE) {
            try {
                if (result == RESULT_OK && data != null && data.getData() != null && pendingExport != null) {
                    try (OutputStream stream = getContentResolver().openOutputStream(data.getData())) {
                        if (stream == null) throw new IllegalStateException("No export destination");
                        stream.write(pendingExport);
                    }
                    toast("File saved to the location you selected.");
                }
            } catch (Exception error) { toast("The file could not be saved."); }
            finally { clearExport(); }
        }
    }
    @Override protected void onPause() {
        if (webView != null && !externalFlow) webView.evaluateJavascript("window.dispatchEvent(new Event('cipher:native-lock'))", null);
        super.onPause();
    }
    @Override public void onBackPressed() {
        // Ask the shared UI to close its dialog / conversation before exiting.
        if (webView == null) { super.onBackPressed(); return; }
        webView.evaluateJavascript("window.cipherBack ? window.cipherBack() : false", value -> {
            if (!"true".equals(value)) new AlertDialog.Builder(this).setTitle("Leave Cipher?")
                    .setMessage("Your account will lock when you leave. Unsent drafts are not saved.")
                    .setNegativeButton("Stay", null).setPositiveButton("Leave", (dialog, which) -> finish()).show();
        });
    }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (pendingPermission != null) pendingPermission.deny();
        clearExport();
        if (webView != null) { webView.removeJavascriptInterface("CipherAndroid"); webView.stopLoading(); webView.destroy(); webView = null; }
        super.onDestroy();
    }
}

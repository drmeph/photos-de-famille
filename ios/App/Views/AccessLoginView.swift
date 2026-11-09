import SwiftUI
import WebKit

/// Cloudflare Access's own login page (email, then the 6-digit code), shown inside the app.
/// Once back on the album, its CF_Authorization cookie is the session token the app keeps.
struct AccessLoginView: UIViewRepresentable {
    let url: URL
    let onToken: (String) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(host: url.host ?? "", onToken: onToken) }

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        webView.navigationDelegate = context.coordinator
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        let host: String
        let onToken: (String) -> Void
        private var done = false

        init(host: String, onToken: @escaping (String) -> Void) {
            self.host = host
            self.onToken = onToken
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard !done, webView.url?.host == host else { return } // still on the login pages
            webView.configuration.websiteDataStore.httpCookieStore.getAllCookies { [weak self] cookies in
                guard let self, !self.done,
                      let token = cookies.first(where: { $0.name == "CF_Authorization" && self.matches($0.domain) })?.value
                else { return }
                self.done = true
                DispatchQueue.main.async { self.onToken(token) }
            }
        }

        private func matches(_ domain: String) -> Bool {
            let d = domain.hasPrefix(".") ? String(domain.dropFirst()) : domain
            return host == d || host.hasSuffix("." + d)
        }
    }

    /// Asks Access for a fresh token without showing anything. Access remembers the sign-in
    /// (its own cookie, kept by the web view between launches) for longer than each album
    /// token lasts, so loading the album again in a hidden web view usually comes back with a
    /// new token, no email code needed. Nil if Access wants the email code again.
    @MainActor
    static func renewToken(for url: URL, timeout: Duration = .seconds(15)) async -> String? {
        let host = url.host ?? ""
        // Drop the album's current token first, or Access would just accept it as is.
        let store = WKWebsiteDataStore.default().httpCookieStore
        for cookie in await store.allCookies() where cookie.name == "CF_Authorization" && cookieMatches(cookie.domain, host) {
            await store.deleteCookie(cookie)
        }

        let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 2, height: 2), configuration: WKWebViewConfiguration())
        webView.alpha = 0
        webView.isUserInteractionEnabled = false
        // In a window, so the page's redirects run as they would on screen.
        let window = UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first
        window?.addSubview(webView)
        defer { webView.removeFromSuperview() }

        return await withCheckedContinuation { continuation in
            let watcher = RenewalWatcher(host: host) { continuation.resume(returning: $0) }
            webView.navigationDelegate = watcher
            webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
            Task { @MainActor in
                try? await Task.sleep(for: timeout)
                watcher.finish(nil)
                _ = webView // keep the web view and its delegate alive until then
            }
        }
    }

    fileprivate static func cookieMatches(_ domain: String, _ host: String) -> Bool {
        let d = domain.hasPrefix(".") ? String(domain.dropFirst()) : domain
        return host == d || host.hasSuffix("." + d)
    }

    /// Forget the web login too when signing out, so the next sign-in asks for the email again.
    @MainActor
    static func clearWebSession() async {
        let store = WKWebsiteDataStore.default()
        let types = WKWebsiteDataStore.allWebsiteDataTypes()
        let records = await store.dataRecords(ofTypes: types)
        await store.removeData(ofTypes: types, for: records)
    }
}

/// Watches the hidden web view of a token renewal: done once it is back on the album with a
/// new token, or when Access stops on its login page (it wants the email code again).
@MainActor
private final class RenewalWatcher: NSObject, WKNavigationDelegate {
    let host: String
    private var onDone: ((String?) -> Void)?
    private var navigations = 0

    init(host: String, onDone: @escaping (String?) -> Void) {
        self.host = host
        self.onDone = onDone
    }

    func finish(_ token: String?) {
        onDone?(token)
        onDone = nil
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        navigations += 1
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard webView.url?.host == host else {
            // A page that stays on Access's side is its login form. Give a script redirect a
            // moment to move on before giving up.
            let seen = navigations
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(3))
                if self.navigations == seen { self.finish(nil) }
            }
            return
        }
        Task { @MainActor in
            let cookies = await webView.configuration.websiteDataStore.httpCookieStore.allCookies()
            let token = cookies.first { $0.name == "CF_Authorization" && AccessLoginView.cookieMatches($0.domain, self.host) }?.value
            self.finish(token)
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failed(error) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failed(error) }

    private func failed(_ error: Error) {
        // A redirect replacing the page cancels the previous load: that's not a failure.
        if (error as NSError).code == NSURLErrorCancelled { return }
        finish(nil)
    }
}

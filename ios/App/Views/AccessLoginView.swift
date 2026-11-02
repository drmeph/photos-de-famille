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

    /// Forget the web login too when signing out, so the next sign-in asks for the email again.
    @MainActor
    static func clearWebSession() async {
        let store = WKWebsiteDataStore.default()
        let types = WKWebsiteDataStore.allWebsiteDataTypes()
        let records = await store.dataRecords(ofTypes: types)
        await store.removeData(ofTypes: types, for: records)
    }
}

import AlbumKit
import Foundation
import Security

/// The album's address and how we signed in, kept in the Keychain between launches.
struct SavedSession: Codable {
    var albumURL: URL
    var credentials: Credentials
}

enum SessionStore {
    private static let service = "album-familial.session"
    private static let lastAddressKey = "lastAlbumAddress"
    private static let albumURLKey = "albumURL"

    static func load() -> SavedSession? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data else { return nil }
        return try? JSONDecoder().decode(SavedSession.self, from: data)
    }

    static func save(_ session: SavedSession) {
        guard let data = try? JSONEncoder().encode(session) else { return }
        clear()
        let attributes: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemAdd(attributes as CFDictionary, nil)
        remember(session.albumURL)
    }

    static func remember(_ albumURL: URL) {
        UserDefaults.standard.set(albumURL.absoluteString, forKey: albumURLKey)
    }

    static func clear() {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service]
        SecItemDelete(query as CFDictionary)
    }

    /// The album last signed in to. Kept when the session ends or on signing out, so signing in
    /// again doesn't ask for the address (only "Use another album" does).
    static var albumURL: URL? {
        let defaults = UserDefaults.standard
        let saved = defaults.string(forKey: albumURLKey) ?? defaults.string(forKey: lastAddressKey) // older versions kept the host only
        return saved.flatMap(APIClient.albumURL(from:))
    }

    /// How to show an album's address: "famille.example.org", or the full URL when it has a port
    /// or plain http (local development).
    static func display(_ url: URL) -> String {
        guard url.scheme == "https", url.port == nil, let host = url.host else {
            return url.absoluteString.hasSuffix("/") ? String(url.absoluteString.dropLast()) : url.absoluteString
        }
        return host
    }
}

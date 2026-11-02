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
        UserDefaults.standard.set(session.albumURL.host ?? "", forKey: lastAddressKey)
    }

    static func clear() {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service]
        SecItemDelete(query as CFDictionary)
    }

    /// Pre-fills the sign-in screen after signing out or an expired session.
    static var lastAddress: String { UserDefaults.standard.string(forKey: lastAddressKey) ?? "" }
}

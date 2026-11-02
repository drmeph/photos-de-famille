import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// How the app proves who it is to the album (see server/auth.ts in the web project).
public enum Credentials: Codable, Equatable, Sendable {
    /// Cloudflare Access: the token from the CF_Authorization cookie, obtained by signing in
    /// through Access's own login page in a web view.
    case accessToken(String)
    /// Shared family password (HTTP Basic auth); the name is shown as "added by".
    case basic(name: String, password: String)
    /// Local development server without sign-in.
    case none
}

public enum APIError: Error, Equatable {
    /// No valid session: Access redirected to its login page, or the password was refused.
    case signInRequired
    case notFound
    case http(status: Int, message: String)
    case invalidResponse
}

/// What signing in to an album requires, found by knocking on its door.
public enum ProbeResult: Equatable, Sendable {
    case access // Cloudflare Access login page
    case password // shared family password
    case open // no sign-in (local development)
    case unreachable
}

private struct ErrorBody: Decodable { let error: String }
private struct RemainingBody: Decodable { let remaining: Int }
private struct NameBody: Encodable { let name: String }
private struct TextBody: Encodable { let text: String }

/// The album's HTTP API (server/api.ts in the web project).
public final class APIClient: @unchecked Sendable {
    public let baseURL: URL // scheme + host, ending with "/"
    public let credentials: Credentials
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    public init(baseURL: URL, credentials: Credentials, session: URLSession = .shared) {
        self.baseURL = baseURL.absoluteString.hasSuffix("/") ? baseURL : URL(string: baseURL.absoluteString + "/")!
        self.credentials = credentials
        self.session = session
    }

    /// "album-familial.pages.dev", "https://famille.example.org/anything" -> "https://host/".
    public static func albumURL(from input: String) -> URL? {
        var s = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !s.isEmpty else { return nil }
        if !s.lowercased().hasPrefix("http://"), !s.lowercased().hasPrefix("https://") { s = "https://" + s }
        guard let url = URL(string: s), let host = url.host, !host.isEmpty, host.contains(".") || host == "localhost" else { return nil }
        var c = URLComponents()
        c.scheme = url.scheme?.lowercased()
        c.host = host.lowercased()
        c.port = url.port
        c.path = "/"
        return c.url
    }

    public func url(_ path: String) -> URL {
        URL(string: "api/" + path, relativeTo: baseURL)!.absoluteURL
    }

    /// Adds the sign-in to a request (also used for image requests).
    public func authorize(_ request: inout URLRequest) {
        switch credentials {
        case let .accessToken(token):
            // Access accepts its token as a header or as its cookie; send both, and keep the
            // shared cookie storage out of it.
            request.httpShouldHandleCookies = false
            request.setValue(token, forHTTPHeaderField: "cf-access-token")
            request.setValue("CF_Authorization=\(token)", forHTTPHeaderField: "Cookie")
        case let .basic(name, password):
            let encoded = Data("\(name):\(password)".utf8).base64EncodedString()
            request.setValue("Basic \(encoded)", forHTTPHeaderField: "Authorization")
        case .none:
            break
        }
    }

    func request(_ path: String, method: String = "GET", body: Data? = nil) -> URLRequest {
        var r = URLRequest(url: url(path))
        r.httpMethod = method
        r.cachePolicy = .reloadIgnoringLocalCacheData // JSON is always fetched fresh
        r.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            r.httpBody = body
            r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        authorize(&r)
        return r
    }

    /// Checks the response: Access redirecting to its login page (another host) or refusing
    /// means the session is over.
    func validate(_ data: Data, _ response: URLResponse) throws -> Data {
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        if let host = http.url?.host, host != baseURL.host { throw APIError.signInRequired }
        let isJSON = (http.value(forHTTPHeaderField: "Content-Type") ?? "").contains("json")
        switch http.statusCode {
        case 200..<300:
            return data
        case 401:
            throw APIError.signInRequired
        case 403 where !isJSON: // the sign-in check (plain text); a JSON 403 is an app rule
            throw APIError.signInRequired
        case 404:
            throw APIError.notFound
        default:
            let message = (try? decoder.decode(ErrorBody.self, from: data))?.error
                ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)
            throw APIError.http(status: http.statusCode, message: message)
        }
    }

    func send(_ request: URLRequest) async throws -> Data {
        let (data, response) = try await session.data(for: request)
        return try validate(data, response)
    }

    func get<T: Decodable>(_ path: String) async throws -> T {
        try decoder.decode(T.self, from: try await send(request(path)))
    }

    func send<T: Decodable, B: Encodable>(_ path: String, method: String, body: B) async throws -> T {
        try decoder.decode(T.self, from: try await send(request(path, method: method, body: try encoder.encode(body))))
    }

    // MARK: Endpoints

    public func me() async throws -> Me { try await get("me") }
    public func setName(_ name: String) async throws -> Me { try await send("me", method: "PUT", body: NameBody(name: name)) }
    public func config() async throws -> AlbumConfig { try await get("config") }
    public func members() async throws -> [String: String] { (try await get("members") as MembersFile).names }
    public func timeline() async throws -> [TimelineEntry] { (try await get("timeline") as TimelineIndex).photos }
    public func people() async throws -> [Person] { (try await get("people") as PeopleFile).people }
    public func addPerson(_ name: String) async throws -> Person { try await send("people", method: "POST", body: NameBody(name: name)) }
    public func photo(_ id: String) async throws -> PhotoMeta { try await get("photos/\(id)") }

    /// The existing photo if this exact file was already uploaded, else nil.
    public func findPhoto(_ id: String) async throws -> PhotoMeta? {
        do { return try await photo(id) } catch APIError.notFound { return nil }
    }

    public func updatePhoto(_ id: String, _ change: UpdatePhotoRequest) async throws -> PhotoMeta {
        try await send("photos/\(id)", method: "PATCH", body: change)
    }

    public func addComment(_ id: String, text: String) async throws -> PhotoMeta {
        try await send("photos/\(id)/comments", method: "POST", body: TextBody(text: text))
    }

    public func deleteComment(_ id: String, commentId: String) async throws -> PhotoMeta {
        try decoder.decode(PhotoMeta.self, from: try await send(request("photos/\(id)/comments/\(commentId)", method: "DELETE")))
    }

    /// Fills in missing upload dates/uploaders in the timeline index, a batch per call.
    public func backfillUploads() async throws -> Int {
        (try decoder.decode(RemainingBody.self, from: try await send(request("admin/backfill-uploads", method: "POST")))).remaining
    }

    /// Uploads one image variant as a raw body, before finalizing with `createPhoto`.
    public func uploadVariant(_ id: String, _ variant: Variant, data: Data, contentType: String) async throws {
        var r = URLRequest(url: url("photos/\(id)/\(variant.rawValue)"))
        r.httpMethod = "PUT"
        r.setValue(contentType, forHTTPHeaderField: "Content-Type")
        authorize(&r)
        let (body, response) = try await session.upload(for: r, from: data)
        _ = try validate(body, response)
    }

    public func createPhoto(_ id: String, _ create: CreatePhotoRequest) async throws -> PhotoMeta {
        try await send("photos/\(id)", method: "POST", body: create)
    }

    /// A signed-in request for an image (cached by URLCache: images never change).
    public func imageRequest(_ id: String, _ variant: Variant, download: Bool = false) -> URLRequest {
        var r = URLRequest(url: url("photos/\(id)/\(variant.rawValue)" + (download ? "?download=1" : "")))
        authorize(&r)
        return r
    }

    public func data(for request: URLRequest) async throws -> Data {
        try await send(request)
    }

    /// What signing in to this album requires.
    public func probe() async -> ProbeResult {
        var r = URLRequest(url: url("me"))
        r.httpShouldHandleCookies = false
        r.cachePolicy = .reloadIgnoringLocalCacheData
        do {
            let (_, response) = try await session.data(for: r)
            guard let http = response as? HTTPURLResponse else { return .unreachable }
            if let host = http.url?.host, host != baseURL.host { return .access } // redirected to Access login
            if http.statusCode == 401,
               (http.value(forHTTPHeaderField: "WWW-Authenticate") ?? "").lowercased().hasPrefix("basic") { return .password }
            if http.statusCode == 403 { return .access } // the site refuses requests that didn't go through Access
            if http.statusCode == 200 { return .open }
            return .unreachable
        } catch {
            return .unreachable
        }
    }
}

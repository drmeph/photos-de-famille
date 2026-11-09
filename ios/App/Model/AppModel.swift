import AlbumKit
import SwiftUI

/// App-wide state: the session, the family settings, the timeline, people and names.
/// Mirrors the website's src/data.ts.
@MainActor
@Observable
final class AppModel {
    enum Phase: Equatable {
        case signedOut(message: String?)
        case loading
        case ready
        case failed
    }

    var phase: Phase = .signedOut(message: nil)
    private(set) var client: APIClient?
    var config: AlbumConfig = .default
    var timeline: [TimelineEntry] = []
    var people: [Person] = []
    var members: [String: String] = [:]
    var me: Me?
    var filters: Filters
    var sort: SortMode
    /// "Later" on the first-visit name prompt: don't ask again until the next launch.
    var nameLater = false
    var lastError: String?
    let uploads = UploadQueue()
    @ObservationIgnored private var backfilling = false

    var strings: Strings { Strings(resolveLanguage(config.language, preferred: Locale.preferredLanguages.first)) }
    var theme: Theme { Theme(hex: config.color) }
    var albumTitle: String { config.title ?? strings.defaultTitle }

    /// The photos on screen, in the order shown (the photo pager follows the same order).
    var visible: [TimelineEntry] {
        let filtered = applyFilters(timeline, filters)
        return sort == .added ? sortByAdded(filtered) : filtered
    }

    init() {
        filters = Self.loadFilters()
        sort = SortMode(rawValue: UserDefaults.standard.string(forKey: "sort") ?? "") ?? .date
        if let saved = SessionStore.load() {
            SessionStore.remember(saved.albumURL) // sessions saved by older versions
            client = APIClient(baseURL: saved.albumURL, credentials: saved.credentials)
            phase = .loading
        }
        uploads.model = self
        if client != nil { Task { await loadAll() } }
    }

    // MARK: Session

    /// Checks the credentials, then keeps them and loads the album. False if refused.
    func signIn(url: URL, credentials: Credentials) async -> Bool {
        let candidate = APIClient(baseURL: url, credentials: credentials)
        guard (try? await candidate.me()) != nil else { return false }
        client = candidate
        SessionStore.save(SavedSession(albumURL: url, credentials: credentials))
        phase = .loading
        await loadAll()
        return true
    }

    /// Signing out from Settings also forgets the web login; a session that ran out keeps it,
    /// so Access may let the person straight back in.
    func signOut(message: String? = nil, forgetWebLogin: Bool = true) {
        SessionStore.clear()
        client = nil
        timeline = []
        people = []
        members = [:]
        me = nil
        // `config` is kept: the sign-in screen still shows the family's title, color and
        // language for the saved album. Signing in to another album loads its own.
        phase = .signedOut(message: message)
        if forgetWebLogin { Task { await AccessLoginView.clearWebSession() } }
    }

    @ObservationIgnored private var renewal: Task<Bool, Never>?
    @ObservationIgnored private var lastRenewal: (at: Date, ok: Bool)?

    /// Gets a new Access token without asking anything (see `AccessLoginView.renewToken`),
    /// keeps it, and switches to it. False when Access wants the email code again.
    func renewSession() async -> Bool {
        if let renewal { return await renewal.value }
        guard let current = client, case .accessToken = current.credentials else { return false }
        // Several requests failing together, or a renewal that just failed: don't redo it.
        if let last = lastRenewal, Date().timeIntervalSince(last.at) < (last.ok ? 30 : 600) { return last.ok }
        let url = current.baseURL
        let task = Task { @MainActor () -> Bool in
            guard let token = await AccessLoginView.renewToken(for: url) else { return false }
            let candidate = APIClient(baseURL: url, credentials: .accessToken(token))
            guard (try? await candidate.me()) != nil, self.client === current else { return false }
            self.client = candidate
            SessionStore.save(SavedSession(albumURL: url, credentials: candidate.credentials))
            return true
        }
        renewal = task
        let ok = await task.value
        renewal = nil
        lastRenewal = (Date(), ok)
        return ok
    }

    /// Renews ahead of time when the token runs out within a few days, while Access still
    /// remembers the sign-in, rather than waiting for a refused request.
    private func renewIfExpiringSoon() {
        guard let expiry = client?.credentials.expiry, expiry.timeIntervalSinceNow < 3 * 24 * 3600 else { return }
        Task { _ = await renewSession() }
    }

    /// The server refused the token: try renewing it quietly, and only then ask to sign in.
    private func sessionRefused() async {
        guard client != nil else { return }
        if await renewSession() {
            await loadAll(renewing: false)
        } else if client != nil {
            signOut(message: strings.sessionExpired, forgetWebLogin: false)
        }
    }

    // MARK: Loading

    /// Loads (or refreshes) everything. Also used by pull-to-refresh and when the app comes back.
    func loadAll() async { await loadAll(renewing: true) }

    private func loadAll(renewing: Bool) async {
        guard let client else { return }
        if renewing { renewIfExpiringSoon() }
        do {
            async let configTask = client.config()
            async let timelineTask = client.timeline()
            async let peopleTask = client.people()
            async let membersTask = client.members()
            async let meTask = client.me()
            let (photos, people, members, me) = try await (timelineTask, peopleTask, membersTask, meTask)
            config = (try? await configTask) ?? config // older servers have no /api/config
            self.timeline = photos
            self.people = people
            self.members = members
            self.me = me
            phase = .ready
            if photos.contains(where: { $0.u == nil || $0.b == nil }) { Task { await backfill() } }
        } catch APIError.signInRequired {
            // Stays on the loading screen meanwhile. Refused again with a renewed token: give up.
            if renewing { await sessionRefused() } else { signOut(message: strings.sessionExpired, forgetWebLogin: false) }
        } catch {
            handle(error)
            if phase == .loading { phase = .failed }
        }
    }

    /// Albums started before upload dates/uploaders were recorded: fill them in, batch by batch.
    private func backfill() async {
        guard !backfilling, let client else { return }
        backfilling = true
        defer { backfilling = false }
        var previous = Int.max
        while let remaining = try? await client.backfillUploads(), remaining > 0, remaining < previous {
            previous = remaining
        }
        if let photos = try? await client.timeline() { timeline = photos }
    }

    /// An expired session is renewed quietly if possible, else sends back to sign-in;
    /// other errors show a short message.
    func handle(_ error: Error, quiet: Bool = false) {
        if case APIError.signInRequired = error {
            Task { await sessionRefused() }
        } else if !quiet {
            lastError = strings.errorGeneric
        }
    }

    // MARK: Changes

    /// Reflect a photo change in the timeline right away, without refetching it.
    func patch(_ meta: PhotoMeta) {
        var photos = timeline.filter { $0.id != meta.id }
        photos.append(meta.timelineEntry)
        timeline = photos.sorted(by: TimelineEntry.newestFirst)
    }

    func addPerson(_ name: String) async throws -> Person {
        guard let client else { throw APIError.signInRequired }
        let person = try await client.addPerson(name)
        if !people.contains(where: { $0.id == person.id }) {
            people = (people + [person]).sorted { $0.name.localizedCompare($1.name) == .orderedAscending }
        }
        return person
    }

    func setMyName(_ name: String) async throws {
        guard let client else { throw APIError.signInRequired }
        let updated = try await client.setName(name)
        me = updated
        if let chosen = updated.name { members[updated.user] = chosen }
    }

    func name(of user: String) -> String { displayName(user, names: members) }

    // MARK: Preferences

    static func loadFilters() -> Filters {
        guard let data = UserDefaults.standard.data(forKey: "filters") else { return Filters() }
        return (try? JSONDecoder().decode(Filters.self, from: data)) ?? Filters()
    }

    static func save(filters: Filters, sort: SortMode) {
        UserDefaults.standard.set(try? JSONEncoder().encode(filters), forKey: "filters")
        UserDefaults.standard.set(sort.rawValue, forKey: "sort")
    }
}

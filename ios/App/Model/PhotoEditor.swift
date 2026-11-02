import AlbumKit
import SwiftUI

/// One photo's details and the changes made to it. Changes apply on screen right away and are
/// saved one after another, so quick taps reach the server in order (like the website).
@MainActor
@Observable
final class PhotoEditor {
    var meta: PhotoMeta?
    var failed = false
    var saving = 0
    var saveError = false
    @ObservationIgnored weak var model: AppModel?
    @ObservationIgnored private var queue: Task<Void, Never>?

    func load(_ id: String, model: AppModel) async {
        self.model = model
        guard meta?.id != id, let client = model.client else { return }
        do {
            meta = try await client.photo(id)
            failed = false
        } catch {
            failed = true
            model.handle(error, quiet: true)
        }
    }

    /// Apply `local` now, then send; shows the server's version once every pending save is done.
    @discardableResult
    func save(_ local: (inout PhotoMeta) -> Void = { _ in }, send: @escaping (APIClient) async throws -> PhotoMeta) async -> Bool {
        guard var current = meta, let client = model?.client else { return false }
        local(&current)
        meta = current
        saving += 1
        saveError = false
        let previous = queue
        let task = Task { () -> Result<PhotoMeta, Error> in
            await previous?.value
            do { return .success(try await send(client)) } catch { return .failure(error) }
        }
        queue = Task { _ = await task.value }
        let result = await task.value
        saving -= 1
        switch result {
        case let .success(fresh):
            model?.patch(fresh)
            if saving == 0 { meta = fresh }
            return true
        case let .failure(error):
            saveError = true
            model?.handle(error, quiet: true)
            if saving == 0, let fresh = try? await client.photo(current.id) { meta = fresh } // show what is really saved
            return false
        }
    }

    func toggle(_ personId: String) async {
        guard let meta else { return }
        let on = meta.people.contains(personId)
        let id = meta.id
        await save({ m in
            if on { m.people.removeAll { $0 == personId } } else { m.people.append(personId) }
        }, send: { client in
            try await client.updatePhoto(id, on ? UpdatePhotoRequest(removePeople: [personId]) : UpdatePhotoRequest(addPeople: [personId]))
        })
    }

    /// Keeps the time of day; marks the date as corrected by hand.
    func setDate(_ date: Date) async {
        guard let meta else { return }
        let takenAt = String(LocalDate.string(from: date).prefix(10)) + String(meta.takenAt.dropFirst(10))
        let id = meta.id
        await save({ m in
            m.takenAt = takenAt
            m.dateSource = .manual
        }, send: { client in try await client.updatePhoto(id, UpdatePhotoRequest(takenAt: takenAt)) })
    }

    func setCaption(_ caption: String) async {
        guard let meta else { return }
        let trimmed = caption.trimmingCharacters(in: .whitespacesAndNewlines)
        let id = meta.id
        await save({ $0.caption = trimmed }, send: { client in try await client.updatePhoto(id, UpdatePhotoRequest(caption: trimmed)) })
    }

    func addComment(_ text: String) async -> Bool {
        guard let id = meta?.id else { return false }
        return await save(send: { client in try await client.addComment(id, text: text) })
    }

    func deleteComment(_ commentId: String) async {
        guard let id = meta?.id else { return }
        await save({ m in m.comments?.removeAll { $0.id == commentId } }, send: { client in
            try await client.deleteComment(id, commentId: commentId)
        })
    }
}

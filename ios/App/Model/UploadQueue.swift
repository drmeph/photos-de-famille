import AlbumKit
import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// Photos being added, one at a time (big photos use a lot of memory), like the website's queue.
@MainActor
@Observable
final class UploadQueue {
    enum Source {
        case library(PhotosPickerItem)
        case camera(Data) // JPEG with the camera's metadata
    }

    enum Status: Equatable {
        case waiting, preparing, uploading, done, duplicate, failed
    }

    struct Item: Identifiable {
        let id = UUID()
        var source: Source
        var status: Status = .waiting
        var progress = 0.0
        var photoId: String?
        var preview: UIImage?
        var name = ""
    }

    var items: [Item] = []
    @ObservationIgnored weak var model: AppModel?
    @ObservationIgnored private var running = false

    var isActive: Bool { items.contains { [.waiting, .preparing, .uploading].contains($0.status) } }

    func add(_ pickerItems: [PhotosPickerItem]) {
        items += pickerItems.map { Item(source: .library($0)) }
        run()
    }

    func addCamera(_ jpeg: Data) {
        items.append(Item(source: .camera(jpeg)))
        run()
    }

    func retry(_ id: UUID) {
        update(id) {
            $0.status = .waiting
            $0.progress = 0
        }
        run()
    }

    func clearFinished() {
        items.removeAll { [.done, .duplicate, .failed].contains($0.status) }
    }

    private func update(_ id: UUID, _ change: (inout Item) -> Void) {
        guard let index = items.firstIndex(where: { $0.id == id }) else { return }
        change(&items[index])
    }

    private func run() {
        guard !running else { return }
        running = true
        Task {
            await process()
            running = false
        }
    }

    private func process() async {
        while let item = items.first(where: { $0.status == .waiting }) {
            let id = item.id
            update(id) { $0.status = .preparing }
            do {
                guard let client = model?.client else { throw APIError.signInRequired }
                let (data, type, name) = try await load(item.source)
                update(id) { $0.name = name }
                let prepared = try await Task.detached(priority: .userInitiated) {
                    try ImageProcessing.prepare(data: data, contentType: type, filename: name)
                }.value
                update(id) {
                    $0.photoId = prepared.id
                    $0.preview = UIImage(data: prepared.thumb)
                }
                if try await client.findPhoto(prepared.id) != nil {
                    update(id) { $0.status = .duplicate }
                    continue
                }
                update(id) { $0.status = .uploading }
                try await client.uploadVariant(prepared.id, .thumb, data: prepared.thumb, contentType: "image/jpeg")
                update(id) { $0.progress = 0.15 }
                try await client.uploadVariant(prepared.id, .display, data: prepared.display, contentType: "image/jpeg")
                update(id) { $0.progress = 0.4 }
                try await client.uploadVariant(prepared.id, .original, data: prepared.original, contentType: prepared.originalType)
                update(id) { $0.progress = 0.9 }
                let meta = try await client.createPhoto(prepared.id, CreatePhotoRequest(
                    takenAt: prepared.takenAt, dateSource: prepared.dateSource,
                    width: prepared.width, height: prepared.height, originalName: prepared.originalName
                ))
                update(id) {
                    $0.status = .done
                    $0.progress = 1
                }
                model?.patch(meta)
            } catch {
                update(id) { $0.status = .failed }
                if case APIError.signInRequired = error { model?.handle(error) }
            }
        }
    }

    /// The original file's bytes, type and a file name.
    private func load(_ source: Source) async throws -> (Data, String, String) {
        let stamp = LocalDate.string(from: Date()).replacingOccurrences(of: ":", with: "")
        switch source {
        case let .camera(jpeg):
            return (jpeg, "image/jpeg", "IMG_\(stamp).jpg")
        case let .library(item):
            guard let data = try await item.loadTransferable(type: Data.self) else { throw ImageProcessingError.unreadable }
            let type = item.supportedContentTypes.first { $0.conforms(to: .image) } ?? .jpeg
            let ext = type.preferredFilenameExtension ?? "jpg"
            return (data, type.preferredMIMEType ?? "image/jpeg", "IMG_\(stamp).\(ext)")
        }
    }
}

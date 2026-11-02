import AlbumKit
import SwiftUI
import UIKit

/// Photos being added, with their progress; "Who is in it?" opens each one to tag people.
struct UploadSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var route: PhotoRoute?

    var body: some View {
        let s = model.strings
        let queue = model.uploads
        NavigationStack {
            List {
                if queue.isActive {
                    Text(s.keepAppOpen).foregroundStyle(model.theme.inkSoft)
                }
                ForEach(queue.items) { item in
                    row(item)
                }
                Section {
                    AddPhotosMenu(onAdded: {}) {
                        Label(s.addPhotos, systemImage: "plus").font(.body.weight(.semibold))
                    }
                }
            }
            .navigationTitle(s.uploadTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(s.done) {
                        queue.clearFinished()
                        dismiss()
                    }
                }
            }
        }
        .fullScreenCover(item: $route) { route in PhotoPagerView(ids: route.ids, start: route.id) }
    }

    private func row(_ item: UploadQueue.Item) -> some View {
        let s = model.strings
        let status: String = switch item.status {
        case .waiting, .preparing: s.preparing
        case .uploading: "\(s.uploading) \(Int(item.progress * 100)) %"
        case .done: s.uploaded
        case .duplicate: s.duplicate
        case .failed: s.failed
        }
        return HStack(spacing: 12) {
            Group {
                if let preview = item.preview {
                    Image(uiImage: preview).resizable().scaledToFill()
                } else {
                    Image(systemName: "photo").foregroundStyle(model.theme.accent)
                }
            }
            .frame(width: 60, height: 60)
            .background(model.theme.accentSoft)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(alignment: .bottomTrailing) {
                if item.status == .done || item.status == .duplicate {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(.white, .green).font(.title3).offset(x: 4, y: 4)
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(status)
                    .fontWeight(.bold)
                    .foregroundStyle(item.status == .failed ? .red : item.status == .done ? .green : model.theme.ink)
                if item.status == .uploading { ProgressView(value: item.progress) }
                else if item.status == .preparing { ProgressView() }
            }
            Spacer()
            if (item.status == .done || item.status == .duplicate), let id = item.photoId {
                Button(s.tagThis) { route = PhotoRoute(id: id, ids: [id]) }.buttonStyle(.bordered)
            }
            if item.status == .failed {
                Button(s.retry) { model.uploads.retry(item.id) }.buttonStyle(.bordered)
            }
        }
        .padding(.vertical, 4)
    }
}

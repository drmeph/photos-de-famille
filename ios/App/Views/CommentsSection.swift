import AlbumKit
import SwiftUI

/// Comments on one photo, oldest first, with a box to add one. The first time, it also asks
/// for the name shown with comments (unless it was given on the first visit).
struct CommentsSection: View {
    let editor: PhotoEditor

    @Environment(AppModel.self) private var model
    @State private var text = ""
    @State private var nameInput = ""
    @State private var editingName = false
    @State private var busy = false
    @State private var failed = false
    @State private var toDelete: Comment?

    private var askName: Bool { model.me?.name == nil || editingName }

    var body: some View {
        let s = model.strings
        let comments = editor.meta?.comments ?? []
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Label(s.comments, systemImage: "bubble.left").font(.serif(.title3))
                if !comments.isEmpty {
                    Text("\(comments.count)")
                        .font(.subheadline.weight(.heavy))
                        .foregroundStyle(model.theme.accent)
                        .padding(.horizontal, 8)
                        .background(model.theme.accentSoft, in: Capsule())
                }
            }
            if comments.isEmpty { Text(s.noComments).foregroundStyle(model.theme.inkSoft) }
            ForEach(comments) { comment in
                HStack(alignment: .top, spacing: 12) {
                    Avatar(name: comment.name)
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text(comment.name).fontWeight(.bold)
                            Text(s.timeAgo(comment.at)).font(.subheadline).foregroundStyle(model.theme.inkSoft)
                        }
                        Text(comment.text)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(model.theme.card, in: UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 16, bottomTrailingRadius: 16, topTrailingRadius: 16))
                            .overlay(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 16, bottomTrailingRadius: 16, topTrailingRadius: 16).stroke(model.theme.line))
                            .textSelection(.enabled)
                        if comment.by == model.me?.user {
                            Button(role: .destructive) { toDelete = comment } label: { Label(s.deleteComment, systemImage: "trash") }
                                .font(.subheadline)
                                .foregroundStyle(model.theme.inkSoft)
                                .buttonStyle(.plain)
                                .frame(minHeight: 36)
                        }
                    }
                }
            }

            // Composer
            VStack(alignment: .leading, spacing: 10) {
                if askName {
                    TextField(s.yourName, text: $nameInput)
                        .textContentType(.givenName)
                        .textInputAutocapitalization(.words)
                        .padding(12)
                        .background(model.theme.card, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(model.theme.line, lineWidth: 1.5))
                    Text(s.yourNameHint).font(.footnote).foregroundStyle(model.theme.inkSoft)
                } else if let name = model.me?.name {
                    HStack(spacing: 6) {
                        Text(s.commentingAs(name)).foregroundStyle(model.theme.inkSoft)
                        Button(s.changeName) {
                            nameInput = name
                            editingName = true
                        }
                        .font(.body.weight(.semibold))
                    }
                }
                TextField(s.writeComment, text: $text, axis: .vertical)
                    .lineLimit(2...6)
                    .padding(12)
                    .background(model.theme.card, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(model.theme.line, lineWidth: 1.5))
                if failed { Text(s.errorGeneric).foregroundStyle(.red) }
                Button { Task { await publish() } } label: {
                    if busy { ProgressView() } else { Label(s.publish, systemImage: "bubble.left") }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(busy || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    || (askName && nameInput.trimmingCharacters(in: .whitespaces).isEmpty))
            }
        }
        .confirmationDialog(s.confirmDeleteComment, isPresented: Binding(get: { toDelete != nil }, set: { if !$0 { toDelete = nil } }), titleVisibility: .visible) {
            Button(s.deleteComment, role: .destructive) {
                if let comment = toDelete { Task { await editor.deleteComment(comment.id) } }
            }
            Button(s.cancel, role: .cancel) {}
        }
    }

    private func publish() async {
        let trimmed = String(text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(2000))
        guard !trimmed.isEmpty else { return }
        busy = true
        failed = false
        defer { busy = false }
        if askName {
            let name = nameInput.trimmingCharacters(in: .whitespaces)
            guard !name.isEmpty else { return }
            do { try await model.setMyName(name) } catch {
                failed = true
                return
            }
        }
        if await editor.addComment(trimmed) {
            text = ""
            editingName = false
        } else {
            failed = true
        }
    }
}

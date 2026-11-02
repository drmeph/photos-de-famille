import AlbumKit
import SwiftUI
import UIKit

/// One photo: the image, then its date, caption, people, comments and who added it.
struct PhotoDetailView: View {
    let id: String

    @Environment(AppModel.self) private var model
    @State private var editor = PhotoEditor()
    @State private var editingDate = false
    @State private var editingCaption = false
    @State private var share: IdentifiedURL?
    @State private var downloading = false
    @State private var zooming = false

    var body: some View {
        let s = model.strings
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                stage
                if let meta = editor.meta {
                    VStack(alignment: .leading, spacing: 22) {
                        if editor.saving > 0 || editor.saveError {
                            Text(editor.saving > 0 ? s.saving : s.errorGeneric)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(editor.saveError ? .red : model.theme.inkSoft)
                        }
                        dateBlock(meta)
                        Divider()
                        captionBlock(meta)
                        Divider()
                        peopleBlock(meta)
                        Divider()
                        CommentsSection(editor: editor)
                        Divider()
                        footer(meta)
                    }
                    .padding(20)
                    .frame(maxWidth: 680, alignment: .leading)
                    .frame(maxWidth: .infinity)
                } else if editor.failed {
                    Text(s.errorGeneric).foregroundStyle(.red).padding(20)
                } else {
                    ProgressView().frame(maxWidth: .infinity).padding(40)
                }
            }
        }
        .background(model.theme.paper)
        .task(id: id) { await editor.load(id, model: model) }
        .sheet(isPresented: $editingDate) {
            if let meta = editor.meta { DateSheet(meta: meta) { date in Task { await editor.setDate(date) } } }
        }
        .sheet(isPresented: $editingCaption) {
            if let meta = editor.meta { CaptionSheet(caption: meta.caption) { text in Task { await editor.setCaption(text) } } }
        }
        .sheet(item: $share) { file in ShareSheet(items: [file.url]) }
        .fullScreenCover(isPresented: $zooming) { ZoomViewer(id: id) }
    }

    /// The photo on a dark stage, with a blurred glow of its own colors behind it.
    /// The stage's size is fixed first; the glow (which overflows: it *fills*) and the photo
    /// (which *fits*, so landscape photos show whole) are overlays, so they can't widen the page.
    private var stage: some View {
        Color(red: 0.08, green: 0.07, blue: 0.055)
            .frame(maxWidth: .infinity)
            .containerRelativeFrame(.vertical) { height, _ in height * 0.58 }
            .overlay {
                RemoteImage(id: id, variant: .thumb, placeholder: .clear)
                    .blur(radius: 40)
                    .opacity(0.55)
            }
            .overlay {
                RemoteImage(id: id, variant: .display, contentMode: .fit, placeholder: .clear)
                    .padding(8)
            }
            .clipped()
            .contentShape(Rectangle())
            .onTapGesture { zooming = true }
            .overlay(alignment: .bottomTrailing) {
                Button { zooming = true } label: {
                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                        .font(.headline)
                        .foregroundStyle(.white)
                        .frame(width: 48, height: 48)
                        .background(.black.opacity(0.45), in: Circle())
                }
                .padding(12)
                .accessibilityLabel(model.strings.enlarge)
            }
    }

    private func dateBlock(_ meta: PhotoMeta) -> some View {
        let s = model.strings
        let note: String = switch meta.dateSource {
        case .exif: s.dateFromCamera
        case .upload: s.dateFromUpload
        case .manual: s.dateManual
        }
        return VStack(alignment: .leading, spacing: 6) {
            Text(s.formatDate(meta.takenAt)).font(.serif(.title))
            Group {
                if let years = LocalDate.yearsAgo(meta.takenAt) {
                    Text(s.yearsAgo(years)).fontWeight(.bold).foregroundStyle(model.theme.accent) + Text(" · \(note)")
                } else {
                    Text(note)
                }
            }
            .foregroundStyle(model.theme.inkSoft)
            .fixedSize(horizontal: false, vertical: true)
            Button { editingDate = true } label: { Label(s.changeDate, systemImage: "pencil") }
                .buttonStyle(.bordered)
                .padding(.top, 6)
        }
    }

    private func captionBlock(_ meta: PhotoMeta) -> some View {
        let s = model.strings
        return Group {
            if meta.caption.isEmpty {
                Button { editingCaption = true } label: { Label(s.addCaption, systemImage: "plus") }
                    .buttonStyle(.bordered)
            } else {
                Button { editingCaption = true } label: {
                    HStack(alignment: .top) {
                        Text("« \(meta.caption) »").font(.serif(.title3, weight: .regular).italic()).foregroundStyle(model.theme.ink)
                            .multilineTextAlignment(.leading)
                        Spacer()
                        Image(systemName: "pencil").foregroundStyle(model.theme.inkSoft)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityHint(s.editCaption)
            }
        }
    }

    private func peopleBlock(_ meta: PhotoMeta) -> some View {
        let s = model.strings
        return VStack(alignment: .leading, spacing: 12) {
            Label(s.onThisPhoto, systemImage: "person.2").font(.serif(.title3))
            if meta.people.isEmpty { Text(s.tapToTag).foregroundStyle(model.theme.inkSoft) }
            PeopleChips(
                people: model.people,
                selected: meta.people,
                onToggle: { personId in Task { await editor.toggle(personId) } },
                onAdd: { name in
                    if let person = try? await model.addPerson(name), editor.meta?.people.contains(person.id) == false {
                        await editor.toggle(person.id)
                    }
                }
            )
        }
    }

    private func footer(_ meta: PhotoMeta) -> some View {
        let s = model.strings
        let who = model.name(of: meta.uploadedBy)
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Avatar(name: who, size: 32)
                Text(s.addedBy(who, s.shortDate(meta.uploadedAt))).foregroundStyle(model.theme.inkSoft)
            }
            Button { Task { await shareOriginal(meta) } } label: {
                if downloading { ProgressView() } else { Label(s.shareOriginal, systemImage: "square.and.arrow.up") }
            }
            .buttonStyle(.bordered)
            .disabled(downloading)
        }
        .padding(.bottom, 20)
    }

    /// Downloads the original file, then opens the share sheet (Save Image, AirDrop, Messages…).
    private func shareOriginal(_ meta: PhotoMeta) async {
        guard let client = model.client else { return }
        downloading = true
        defer { downloading = false }
        do {
            let data = try await client.data(for: client.imageRequest(meta.id, .original, download: true))
            let safeName = meta.original.name.replacingOccurrences(of: "/", with: "_")
            let file = FileManager.default.temporaryDirectory.appendingPathComponent(safeName.isEmpty ? "\(meta.id).jpg" : safeName)
            try data.write(to: file, options: .atomic)
            share = IdentifiedURL(url: file)
        } catch {
            model.handle(error)
        }
    }
}

/// Fix the date: a wheel is easiest for old photos far in the past.
struct DateSheet: View {
    let meta: PhotoMeta
    let onSave: (Date) -> Void
    @State private var date: Date
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    init(meta: PhotoMeta, onSave: @escaping (Date) -> Void) {
        self.meta = meta
        self.onSave = onSave
        _date = State(initialValue: LocalDate.date(from: meta.takenAt) ?? Date())
    }

    var body: some View {
        let s = model.strings
        let earliest = LocalDate.date(from: "1826-01-01T12:00:00") ?? .distantPast
        NavigationStack {
            DatePicker(s.date, selection: $date, in: earliest...Date(), displayedComponents: .date)
                .datePickerStyle(.wheel)
                .labelsHidden()
                .environment(\.locale, model.strings.lang.locale)
                .padding()
                .navigationTitle(s.changeDate)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button(s.cancel) { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button(s.save) {
                            onSave(date)
                            dismiss()
                        }
                    }
                }
        }
        .presentationDetents([.medium])
    }
}

struct CaptionSheet: View {
    let onSave: (String) -> Void
    @State private var text: String
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    init(caption: String, onSave: @escaping (String) -> Void) {
        self.onSave = onSave
        _text = State(initialValue: caption)
    }

    var body: some View {
        let s = model.strings
        NavigationStack {
            VStack(alignment: .leading, spacing: 8) {
                Text(s.captionPlaceholder).foregroundStyle(model.theme.inkSoft)
                TextEditor(text: $text)
                    .font(.body)
                    .padding(8)
                    .scrollContentBackground(.hidden)
                    .background(model.theme.card, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(model.theme.line, lineWidth: 1.5))
                    .onChange(of: text) { _, new in if new.count > 2000 { text = String(new.prefix(2000)) } }
            }
            .padding()
            .background(model.theme.paper)
            .navigationTitle(s.caption)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(s.cancel) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(s.save) {
                        onSave(text)
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

/// The system share sheet.
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

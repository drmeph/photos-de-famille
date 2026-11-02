import AlbumKit
import SwiftUI

/// First visit: the first name shown on one's photos and comments. "Later" asks again next launch.
struct WelcomeNameView: View {
    @Environment(AppModel.self) private var model
    @State private var name = ""
    @State private var busy = false
    @State private var failed = false

    var body: some View {
        let s = model.strings
        VStack(spacing: 18) {
            Spacer(minLength: 20)
            Image(systemName: "photo.on.rectangle.angled")
                .font(.system(size: 30, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 68, height: 68)
                .background(model.theme.accent, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                .rotationEffect(.degrees(-4))
            Text(model.albumTitle).foregroundStyle(model.theme.inkSoft)
            Text(s.welcomeTitle).font(.serif(.largeTitle)).multilineTextAlignment(.center)
            Text(s.welcomeText).multilineTextAlignment(.center)
            TextField(s.yourName, text: $name)
                .textContentType(.givenName)
                .textInputAutocapitalization(.words)
                .submitLabel(.done)
                .padding(14)
                .background(model.theme.card, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(model.theme.accentLine, lineWidth: 1.5))
                .onSubmit { Task { await save() } }
            if failed { Text(s.errorGeneric).foregroundStyle(.red) }
            Spacer()
            Button { Task { await save() } } label: {
                if busy { ProgressView().tint(.white) } else { Text(s.continueLabel) }
            }
            .buttonStyle(BigButtonStyle(color: model.theme.accent))
            .disabled(busy || name.trimmingCharacters(in: .whitespaces).isEmpty)
            Button(s.later) { model.nameLater = true }
                .font(.headline)
                .frame(minHeight: 50)
        }
        .padding(24)
        .frame(maxWidth: 520)
        .frame(maxWidth: .infinity)
        .background(model.theme.paper)
    }

    private func save() async {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, !busy else { return }
        busy = true
        failed = false
        do { try await model.setMyName(trimmed) } catch { failed = true } // once saved, the sheet closes by itself
        busy = false
    }
}

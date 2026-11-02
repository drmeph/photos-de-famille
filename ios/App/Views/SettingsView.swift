import AlbumKit
import SwiftUI

/// Which album, who is signed in, one's display name, and signing out.
struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var confirmSignOut = false
    @State private var saving = false

    var body: some View {
        let s = model.strings
        NavigationStack {
            Form {
                Section(model.albumTitle) {
                    if let host = model.client?.baseURL.host { LabeledContent(s.albumAddress, value: host) }
                    if let user = model.me?.user { LabeledContent(s.signedInAs, value: user) }
                }
                Section(s.yourName) {
                    TextField(s.yourName, text: $name)
                        .textContentType(.givenName)
                        .textInputAutocapitalization(.words)
                    Button(s.save) {
                        Task {
                            saving = true
                            try? await model.setMyName(name.trimmingCharacters(in: .whitespaces))
                            saving = false
                        }
                    }
                    .disabled(saving || name.trimmingCharacters(in: .whitespaces).isEmpty || name == model.me?.name)
                }
                Section {
                    Button(s.signOut, role: .destructive) { confirmSignOut = true }
                }
            }
            .navigationTitle(s.settings)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button(s.done) { dismiss() } }
            }
            .confirmationDialog(s.confirmSignOut, isPresented: $confirmSignOut, titleVisibility: .visible) {
                Button(s.signOut, role: .destructive) {
                    dismiss()
                    model.signOut()
                }
                Button(s.cancel, role: .cancel) {}
            }
            .onAppear { name = model.me?.name ?? "" }
        }
    }
}

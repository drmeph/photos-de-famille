import AlbumKit
import SwiftUI

/// Enter the album's address, then sign in the way that album asks for:
/// Cloudflare Access (its email-code page, inside the app) or the shared family password.
struct LoginView: View {
    var message: String?

    @Environment(AppModel.self) private var model
    /// The album signed in to before: only a "Sign in" button, no address to type again.
    @State private var savedAlbum = SessionStore.albumURL
    @State private var address = SessionStore.albumURL.map(SessionStore.display) ?? ""
    @State private var passwordFor: URL?
    @State private var name = ""
    @State private var password = ""
    @State private var accessLogin: IdentifiedURL?
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        let s = model.strings
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Image(systemName: "photo.on.rectangle.angled")
                    .font(.system(size: 34, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 72, height: 72)
                    .background(model.theme.accent, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .rotationEffect(.degrees(-4))
                    .frame(maxWidth: .infinity)
                    .padding(.top, 40)
                Text(s.loginTitle).font(.serif(.largeTitle)).frame(maxWidth: .infinity)
                Text(savedAlbum == nil ? s.loginIntro : s.loginAgain)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(model.theme.inkSoft)
                    .frame(maxWidth: .infinity)
                if let message {
                    Text(message)
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(model.theme.accentSoft, in: RoundedRectangle(cornerRadius: 14))
                }

                if let savedAlbum {
                    VStack(spacing: 4) {
                        Text(model.albumTitle).font(.serif(.title2))
                        Text(SessionStore.display(savedAlbum)).font(.subheadline).foregroundStyle(model.theme.inkSoft)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity)
                    .background(model.theme.card, in: RoundedRectangle(cornerRadius: 16))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(model.theme.line, lineWidth: 1.5))
                } else {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(s.albumAddress).font(.subheadline.weight(.semibold)).foregroundStyle(model.theme.inkSoft)
                        TextField("album-familial.pages.dev", text: $address)
                            .textContentType(.URL)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .padding(14)
                            .background(model.theme.card, in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(model.theme.line, lineWidth: 1.5))
                            .onChange(of: address) { _, _ in passwordFor = nil }
                    }
                }

                if passwordFor != nil {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(s.yourName).font(.subheadline.weight(.semibold)).foregroundStyle(model.theme.inkSoft)
                        TextField("", text: $name)
                            .textContentType(.givenName)
                            .padding(14)
                            .background(model.theme.card, in: RoundedRectangle(cornerRadius: 12))
                        Text(s.familyPassword).font(.subheadline.weight(.semibold)).foregroundStyle(model.theme.inkSoft)
                        SecureField("", text: $password)
                            .textContentType(.password)
                            .padding(14)
                            .background(model.theme.card, in: RoundedRectangle(cornerRadius: 12))
                    }
                }

                if let error { Text(error).foregroundStyle(.red) }

                Button {
                    Task { await connect() }
                } label: {
                    if busy { ProgressView().tint(.white) } else { Text(s.connect) }
                }
                .buttonStyle(BigButtonStyle(color: model.theme.accent))
                .disabled(busy || address.trimmingCharacters(in: .whitespaces).isEmpty)

                if savedAlbum != nil {
                    Button(s.otherAlbum) {
                        savedAlbum = nil
                        passwordFor = nil
                        error = nil
                    }
                    .font(.body.weight(.semibold))
                    .foregroundStyle(model.theme.accent)
                    .frame(maxWidth: .infinity, minHeight: 44)
                }
            }
            .padding(24)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .background(model.theme.paper)
        .sheet(item: $accessLogin) { login in
            NavigationStack {
                AccessLoginView(url: login.url) { token in
                    accessLogin = nil
                    Task { await finish(login.url, .accessToken(token)) }
                }
                .navigationTitle(s.loginTitle)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button(s.cancel) { accessLogin = nil } }
                }
            }
        }
    }

    private func connect() async {
        let s = model.strings
        error = nil
        guard let url = savedAlbum ?? APIClient.albumURL(from: address) else {
            error = s.unreachable
            return
        }
        if let passwordFor, passwordFor == url {
            await finish(url, .basic(name: name.trimmingCharacters(in: .whitespaces), password: password), wrong: s.wrongPassword)
            return
        }
        busy = true
        let needs = await APIClient(baseURL: url, credentials: .none).probe()
        busy = false
        switch needs {
        case .access: accessLogin = IdentifiedURL(url: url)
        case .password: passwordFor = url
        case .open: await finish(url, .none)
        case .unreachable: error = s.unreachable
        }
    }

    private func finish(_ url: URL, _ credentials: Credentials, wrong: String? = nil) async {
        busy = true
        let ok = await model.signIn(url: url, credentials: credentials)
        busy = false
        if !ok { error = wrong ?? model.strings.unreachable }
    }
}

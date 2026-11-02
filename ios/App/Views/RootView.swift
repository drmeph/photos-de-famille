import AlbumKit
import SwiftUI

/// Sign-in, loading, or the album.
struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            switch model.phase {
            case let .signedOut(message):
                LoginView(message: message)
            case .loading:
                ProgressView(model.strings.loading)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(model.theme.paper)
            case .failed:
                VStack(spacing: 20) {
                    Image(systemName: "exclamationmark.triangle").font(.largeTitle).foregroundStyle(model.theme.accent)
                    Text(model.strings.errorGeneric).multilineTextAlignment(.center)
                    Button(model.strings.retry) { Task { await model.loadAll() } }
                        .buttonStyle(BigButtonStyle(color: model.theme.accent))
                }
                .padding(32)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(model.theme.paper)
            case .ready:
                MainView()
            }
        }
        // Pick up what others added while the app was in the background.
        .onChange(of: scenePhase) { _, phase in
            if phase == .active, model.phase == .ready { Task { await model.loadAll() } }
        }
        .onChange(of: model.filters) { _, filters in AppModel.save(filters: filters, sort: model.sort) }
        .onChange(of: model.sort) { _, sort in AppModel.save(filters: model.filters, sort: sort) }
        .alert(model.lastError ?? "", isPresented: Binding(get: { model.lastError != nil }, set: { if !$0 { model.lastError = nil } })) {
            Button("OK", role: .cancel) {}
        }
    }
}

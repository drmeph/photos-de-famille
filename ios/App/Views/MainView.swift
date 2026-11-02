import AlbumKit
import SwiftUI

/// Opening a photo: which one, and the order to swipe through.
struct PhotoRoute: Identifiable {
    let id: String
    let ids: [String]
}

/// The album: header buttons, the timeline, the big "Add photos" button, and the sheets.
struct MainView: View {
    @Environment(AppModel.self) private var model
    @State private var showFilters = false
    @State private var showSettings = false
    @State private var showUploads = false
    @State private var route: PhotoRoute?

    var body: some View {
        let s = model.strings
        NavigationStack {
            AlbumTimelineView { entry in
                route = PhotoRoute(id: entry.id, ids: model.visible.map(\.id))
            }
            .navigationTitle(model.albumTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { showSettings = true } label: { Image(systemName: "person.crop.circle") }
                        .accessibilityLabel(s.settings)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showFilters = true } label: {
                        Label(s.filters, systemImage: model.filters.isActive ? "line.3.horizontal.decrease.circle.fill" : "magnifyingglass")
                            .labelStyle(.titleAndIcon)
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                AddPhotosMenu(onAdded: { showUploads = true }) {
                    Label(s.addPhotos, systemImage: "plus")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: 420, minHeight: 60)
                        .background(model.theme.accent, in: Capsule())
                        .shadow(color: .black.opacity(0.2), radius: 12, y: 6)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 8)
            }
        }
        .sheet(isPresented: $showFilters) { FilterSheet() }
        .sheet(isPresented: $showSettings) { SettingsView() }
        .sheet(isPresented: $showUploads) { UploadSheet() }
        .fullScreenCover(item: $route) { route in PhotoPagerView(ids: route.ids, start: route.id) }
        .sheet(isPresented: Binding(
            get: { model.me != nil && model.me?.name == nil && !model.nameLater },
            set: { if !$0 { model.nameLater = true } }
        )) {
            WelcomeNameView().interactiveDismissDisabled()
        }
    }
}

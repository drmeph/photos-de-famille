import SwiftUI

@main
struct AlbumFamilialApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .tint(model.theme.accent)
                .preferredColorScheme(.light) // the palette is designed for light paper
        }
    }
}

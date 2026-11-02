import AlbumKit
import SwiftUI

/// Full-screen photos: swipe left/right (or the buttons) through the timeline's current order.
struct PhotoPagerView: View {
    let ids: [String]
    @State private var current: String

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    init(ids: [String], start: String) {
        self.ids = ids.contains(start) ? ids : [start]
        _current = State(initialValue: start)
    }

    var body: some View {
        let s = model.strings
        let index = ids.firstIndex(of: current) ?? 0
        NavigationStack {
            TabView(selection: $current) {
                ForEach(ids, id: \.self) { id in
                    PhotoDetailView(id: id).tag(id)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .background(model.theme.paper)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { dismiss() } label: { Label(s.back, systemImage: "chevron.backward").labelStyle(.titleAndIcon) }
                }
                ToolbarItem(placement: .principal) {
                    Text(s.photoPosition(index + 1, ids.count)).font(.subheadline.weight(.semibold)).monospacedDigit()
                }
                ToolbarItemGroup(placement: .bottomBar) {
                    Button { withAnimation { current = ids[index - 1] } } label: { Label(s.previous, systemImage: "chevron.left").labelStyle(.titleAndIcon) }
                        .disabled(index == 0)
                    Spacer()
                    Button { withAnimation { current = ids[index + 1] } } label: { Label(s.next, systemImage: "chevron.right").labelStyle(.titleAndIcon) }
                        .disabled(index >= ids.count - 1)
                }
            }
        }
    }
}

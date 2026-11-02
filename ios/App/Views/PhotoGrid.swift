import AlbumKit
import SwiftUI

/// A group of photos in the grid: a month ("1985-12") or one person's additions on a day.
struct GridGroup {
    var key: String
    var photos: [TimelineEntry]
    var by: String? = nil
}

/// Groups laid out in lines (AlbumKit's `layoutGroups`, same as the website): small groups
/// share a line at one height, big ones get justified rows. Photos keep their shape.
struct PhotoGrid: View {
    let groups: [GridGroup]
    let width: Double
    var label: ((GridGroup, Double) -> String)? = nil
    var showYear = false
    let onOpen: (TimelineEntry) -> Void

    @Environment(AppModel.self) private var model

    var body: some View {
        let o = LayoutOptions.forWidth(width)
        let lines = layoutGroups(groups.map { GroupInput(key: $0.key, ratios: $0.photos.map(tileRatio)) }, o)
        let byKey = Dictionary(groups.map { ($0.key, $0) }, uniquingKeysWith: { first, _ in first })
        VStack(alignment: .leading, spacing: o.gap * 3) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                HStack(alignment: .top, spacing: o.monthGap) {
                    ForEach(line, id: \.key) { placed in
                        if let group = byKey[placed.key] {
                            VStack(alignment: .leading, spacing: 8) {
                                if let label {
                                    let text = label(group, placed.width)
                                    if !text.isEmpty {
                                        Text(text)
                                            .font(.serif(.headline, weight: .medium).italic())
                                            .foregroundStyle(model.theme.inkSoft)
                                            .lineLimit(1)
                                    }
                                }
                                VStack(alignment: .leading, spacing: o.gap) {
                                    ForEach(Array(placed.rows.enumerated()), id: \.offset) { _, row in
                                        HStack(spacing: o.gap) {
                                            ForEach(row, id: \.index) { p in
                                                Tile(entry: group.photos[p.index], width: p.width, height: p.height, showYear: showYear, onOpen: onOpen)
                                            }
                                        }
                                    }
                                }
                            }
                            .frame(width: placed.width, alignment: .leading)
                        }
                    }
                }
            }
        }
    }
}

/// One thumbnail at the size the layout gave it.
struct Tile: View {
    let entry: TimelineEntry
    let width: Double
    let height: Double
    let showYear: Bool
    let onOpen: (TimelineEntry) -> Void

    @Environment(AppModel.self) private var model

    var body: some View {
        Button { onOpen(entry) } label: {
            RemoteImage(id: entry.id, variant: .thumb)
                .frame(width: width, height: height)
                .clipped()
                .overlay(alignment: .topLeading) {
                    if showYear {
                        Text(String(entry.t.prefix(4)))
                            .font(.serif(.caption))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(.black.opacity(0.55), in: Capsule())
                            .padding(6)
                    }
                }
                .overlay(alignment: .bottomTrailing) {
                    if let count = entry.c, count > 0 {
                        Label("\(count)", systemImage: "bubble.left")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(.black.opacity(0.55), in: Capsule())
                            .padding(6)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityText)
    }

    private var accessibilityText: String {
        let s = model.strings
        var parts = [s.formatDate(entry.t, weekday: false)]
        parts += entry.p.map { id in model.people.first { $0.id == id }?.name ?? id }
        if let c = entry.c, c > 0 { parts.append(s.commentCount(c)) }
        return parts.joined(separator: ", ")
    }
}

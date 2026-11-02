import Foundation

// Timeline layout, ported from the website (src/lib/layout.ts). Photos keep their own shape and
// are grouped by month:
// - months with few photos sit side by side on one line, all at the same height;
// - a month too wide for one line gets its own justified rows.

public struct LayoutOptions: Equatable, Sendable {
    public var width: Double
    public var target: Double // preferred row height
    public var gap: Double // between photos
    public var monthGap: Double // between groups on the same line

    public init(width: Double, target: Double, gap: Double, monthGap: Double) {
        self.width = width
        self.target = target
        self.gap = gap
        self.monthGap = monthGap
    }

    /// Row height and spacing that suit the available width (phone, iPad).
    public static func forWidth(_ width: Double) -> LayoutOptions {
        let gap: Double = width < 600 ? 6 : 8
        return LayoutOptions(width: width, target: min(240, max(120, width / 4.6)), gap: gap, monthGap: gap * 3)
    }
}

public struct GroupInput: Sendable {
    public var key: String
    public var ratios: [Double]
    public init(key: String, ratios: [Double]) {
        self.key = key
        self.ratios = ratios
    }
}

public struct PlacedPhoto: Hashable, Sendable {
    public var index: Int // position in the group's photo list
    public var width: Double
    public var height: Double
}

public struct PlacedGroup: Hashable, Sendable {
    public var key: String
    public var width: Double
    public var rows: [[PlacedPhoto]]
}

public typealias LayoutLine = [PlacedGroup]

/// Very tall or very wide photos are cropped a little so rows stay tidy.
public func tileRatio(_ e: TimelineEntry) -> Double {
    guard e.h > 0 else { return 1 }
    return min(2.2, max(0.6, Double(e.w) / Double(e.h)))
}

/// Lines may grow taller than the target to fill the width, but not by more than this.
private let maxStretch = 1.25

private func naturalWidth(_ ratios: [Double], _ o: LayoutOptions) -> Double {
    ratios.reduce(0, +) * o.target + o.gap * Double(ratios.count - 1)
}

public func layoutGroups(_ groups: [GroupInput], _ o: LayoutOptions) -> [LayoutLine] {
    var lines: [LayoutLine] = []
    var pending: [GroupInput] = []
    var pendingWidth = 0.0

    func flush() {
        if !pending.isEmpty { lines.append(fitLine(pending, o)) }
        pending = []
        pendingWidth = 0
    }

    for group in groups where !group.ratios.isEmpty {
        let w = naturalWidth(group.ratios, o)
        if w > o.width {
            flush()
            lines.append([bigGroup(group, o)])
            continue
        }
        let added = (pending.isEmpty ? 0 : o.monthGap) + w
        if pendingWidth + added > o.width { flush() }
        pendingWidth += (pending.isEmpty ? 0 : o.monthGap) + w
        pending.append(group)
    }
    flush()
    return lines
}

/// Several small groups on one line, scaled together to fill the width (within limits).
private func fitLine(_ groups: [GroupInput], _ o: LayoutOptions) -> LayoutLine {
    let ratioSum = groups.flatMap(\.ratios).reduce(0, +)
    let gaps = groups.map { o.gap * Double($0.ratios.count - 1) }.reduce(0, +) + o.monthGap * Double(groups.count - 1)
    var height = (o.width - gaps) / ratioSum
    if height > o.target * maxStretch { height = o.target } // too few photos to fill the line: leave it short
    return groups.map { g in
        PlacedGroup(
            key: g.key,
            width: g.ratios.reduce(0, +) * height + o.gap * Double(g.ratios.count - 1),
            rows: [g.ratios.enumerated().map { PlacedPhoto(index: $0.offset, width: $0.element * height, height: height) }]
        )
    }
}

/// One group wider than the line: justified rows; the last row keeps the target height.
private func bigGroup(_ group: GroupInput, _ o: LayoutOptions) -> PlacedGroup {
    var rows: [[PlacedPhoto]] = []
    var start = 0
    func place(_ end: Int, _ height: Double) {
        rows.append((start..<end).map { PlacedPhoto(index: $0, width: group.ratios[$0] * height, height: height) })
        start = end
    }
    for i in group.ratios.indices {
        let row = Array(group.ratios[start...i])
        if naturalWidth(row, o) >= o.width {
            place(i + 1, (o.width - o.gap * Double(row.count - 1)) / row.reduce(0, +))
        }
    }
    if start < group.ratios.count {
        let row = Array(group.ratios[start...])
        place(group.ratios.count, min(o.target, (o.width - o.gap * Double(row.count - 1)) / row.reduce(0, +)))
    }
    return PlacedGroup(key: group.key, width: o.width, rows: rows)
}

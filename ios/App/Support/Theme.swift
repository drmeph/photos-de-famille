import AlbumKit
import SwiftUI

/// The website's warm paper palette, tinted by the family's color (ALBUM_COLOR).
struct Theme {
    let accent: Color
    let accentSoft: Color
    let accentLine: Color
    let paper: Color
    let paperDeep: Color
    let card: Color
    let ink: Color
    let inkSoft: Color
    let line: Color

    init(hex: String) {
        let a = RGB(hex: hex) ?? RGB(hex: "#7a4b2a")!
        func color(_ c: RGB) -> Color { Color(red: c.r, green: c.g, blue: c.b) }
        func base(_ h: String) -> RGB { RGB(hex: h)! }
        let paperRGB = a.mixed(0.04, with: base("#fdf9f3"))
        accent = color(a)
        accentSoft = color(a.mixed(0.11, with: paperRGB))
        accentLine = color(a.mixed(0.38, with: paperRGB))
        paper = color(paperRGB)
        paperDeep = color(a.mixed(0.09, with: base("#f6f0e7")))
        card = color(a.mixed(0.015, with: base("#fffefb")))
        ink = color(a.mixed(0.18, with: base("#1e1a17")))
        inkSoft = color(a.mixed(0.22, with: base("#5d564f")))
        line = color(a.mixed(0.14, with: base("#ece6dd")))
    }
}

extension Font {
    /// Titles in a warm serif (New York), following the phone's text size.
    static func serif(_ style: Font.TextStyle, weight: Font.Weight = .semibold) -> Font {
        .system(style, design: .serif, weight: weight)
    }
}

/// The big filled button used for the main actions.
struct BigButtonStyle: ButtonStyle {
    var color: Color
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 56)
            .padding(.horizontal, 20)
            .background(color.opacity(configuration.isPressed ? 0.85 : 1), in: Capsule())
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

/// Flow layout for name chips: as many per line as fit.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0, widest: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > maxWidth {
                y += rowHeight + spacing
                x = 0
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            widest = max(widest, x - spacing)
        }
        return CGSize(width: min(widest, maxWidth), height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                y += rowHeight + spacing
                x = bounds.minX
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

/// Lets a URL be used with `.sheet(item:)`.
struct IdentifiedURL: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}

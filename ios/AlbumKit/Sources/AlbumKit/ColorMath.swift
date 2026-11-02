import Foundation

/// An sRGB color with components in 0...1, for deriving the app's palette from ALBUM_COLOR.
public struct RGB: Equatable, Sendable {
    public var r: Double
    public var g: Double
    public var b: Double

    public init(r: Double, g: Double, b: Double) {
        self.r = r
        self.g = g
        self.b = b
    }

    /// "#7a4b2a" or "7a4b2a" (or "#abc").
    public init?(hex: String) {
        var h = hex.trimmingCharacters(in: .whitespaces)
        if h.hasPrefix("#") { h.removeFirst() }
        if h.count == 3 { h = h.map { "\($0)\($0)" }.joined() }
        guard h.count == 6, let v = UInt32(h, radix: 16) else { return nil }
        self.init(r: Double((v >> 16) & 0xFF) / 255, g: Double((v >> 8) & 0xFF) / 255, b: Double(v & 0xFF) / 255)
    }

    /// Like CSS `color-mix(in srgb, self <amount>, other)`.
    public func mixed(_ amount: Double, with other: RGB) -> RGB {
        RGB(r: r * amount + other.r * (1 - amount), g: g * amount + other.g * (1 - amount), b: b * amount + other.b * (1 - amount))
    }
}

/// "Mamie Jeanne" -> "MJ", "Léo" -> "L".
public func initials(_ name: String) -> String {
    name.split(whereSeparator: { $0 == " " || $0 == "-" })
        .prefix(2)
        .compactMap { $0.first.map { String($0).uppercased() } }
        .joined()
}

/// A stable hue (0..<360) per name, same as the website, so each person keeps their color.
public func avatarHue(_ name: String) -> Double {
    var h: UInt32 = 0
    for unit in name.utf16 { h = h &* 31 &+ UInt32(unit) }
    return Double(h % 360)
}

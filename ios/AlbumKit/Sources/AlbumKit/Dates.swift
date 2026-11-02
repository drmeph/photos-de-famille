import Foundation

// Dates as the server stores them: photo dates are wall-clock "YYYY-MM-DDTHH:mm:ss" without
// timezone (like EXIF); upload/comment times are ISO 8601 instants.

private func makeISOFormatter(fractional: Bool) -> ISO8601DateFormatter {
    let f = ISO8601DateFormatter()
    f.formatOptions = fractional ? [.withInternetDateTime, .withFractionalSeconds] : [.withInternetDateTime]
    return f
}

/// "2026-10-31T19:12:34.567Z" (or without milliseconds) -> Date.
public func parseISODate(_ s: String) -> Date? {
    makeISOFormatter(fractional: true).date(from: s) ?? makeISOFormatter(fractional: false).date(from: s)
}

/// Local calendar day of an instant: "2026-10-31".
public func localDay(_ date: Date, calendar: Calendar = .current) -> String {
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}

public enum LocalDate {
    /// "1985-12-24T20:15:00" -> a Date at that wall-clock time in the given calendar's timezone.
    public static func date(from local: LocalDateTime, calendar: Calendar = .current) -> Date? {
        let parts = local.split(whereSeparator: { "-T:".contains($0) }).compactMap { Int($0) }
        guard parts.count >= 3 else { return nil }
        var c = DateComponents()
        c.year = parts[0]
        c.month = parts[1]
        c.day = parts[2]
        c.hour = parts.count > 3 ? parts[3] : 12
        c.minute = parts.count > 4 ? parts[4] : 0
        c.second = parts.count > 5 ? parts[5] : 0
        return calendar.date(from: c)
    }

    /// A Date -> "YYYY-MM-DDTHH:mm:ss" in the given calendar's timezone.
    public static func string(from date: Date, calendar: Calendar = .current) -> LocalDateTime {
        let c = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
        return String(
            format: "%04d-%02d-%02dT%02d:%02d:%02d",
            c.year ?? 0, c.month ?? 0, c.day ?? 0, c.hour ?? 0, c.minute ?? 0, c.second ?? 0
        )
    }

    /// "2019:07:14 15:32:10" (EXIF) -> "2019-07-14T15:32:10". Nil for missing or bogus dates
    /// (same rule as the website's parseExifDate).
    public static func parseExif(_ raw: String?) -> LocalDateTime? {
        guard let raw = raw?.trimmingCharacters(in: .whitespaces), raw.count >= 19 else { return nil }
        let chars = Array(raw)
        func num(_ range: Range<Int>) -> Int? { Int(String(chars[range])) }
        let seps: [(Int, Set<Character>)] = [(4, [":", "-"]), (7, [":", "-"]), (10, [" ", "T"]), (13, [":"]), (16, [":"])]
        guard seps.allSatisfy({ $0.1.contains(chars[$0.0]) }),
              let y = num(0..<4), let mo = num(5..<7), let d = num(8..<10),
              let h = num(11..<13), let mi = num(14..<16), let s = num(17..<19)
        else { return nil }
        guard y >= 1826, (1...12).contains(mo), (1...31).contains(d) else { return nil }
        return String(format: "%04d-%02d-%02dT%02d:%02d:%02d", y, mo, d, h, mi, s)
    }

    /// Whole years between the photo's date and now; nil for photos less than a year old.
    public static func yearsAgo(_ local: LocalDateTime, now: Date = Date(), calendar: Calendar = .current) -> Int? {
        guard let date = date(from: local, calendar: calendar) else { return nil }
        let years = calendar.dateComponents([.year], from: date, to: now).year ?? 0
        return years >= 1 ? years : nil
    }
}

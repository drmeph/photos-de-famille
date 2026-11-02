import Foundation

// Filtering, sorting and grouping of the timeline, ported from the website (src/lib/filter.ts).

public struct Filters: Codable, Equatable, Sendable {
    public var people: [String] = [] // a photo must include *all* of these
    public var fromYear: Int?
    public var toYear: Int?

    public init(people: [String] = [], fromYear: Int? = nil, toYear: Int? = nil) {
        self.people = people
        self.fromYear = fromYear
        self.toYear = toYear
    }

    public var isActive: Bool { !people.isEmpty || fromYear != nil || toYear != nil }
    public var count: Int { people.count + (fromYear != nil || toYear != nil ? 1 : 0) }
}

public func yearOf(_ e: TimelineEntry) -> Int { Int(e.t.prefix(4)) ?? 0 }

public func applyFilters(_ photos: [TimelineEntry], _ f: Filters) -> [TimelineEntry] {
    guard f.isActive else { return photos }
    return photos.filter { e in
        (f.fromYear.map { yearOf(e) >= $0 } ?? true)
            && (f.toYear.map { yearOf(e) <= $0 } ?? true)
            && f.people.allSatisfy { e.p.contains($0) }
    }
}

/// Distinct years, newest first.
public func yearsOf(_ photos: [TimelineEntry]) -> [Int] {
    Array(Set(photos.map(yearOf))).sorted(by: >)
}

public struct MonthGroup: Identifiable, Hashable, Sendable {
    public var key: String // "1985-12"
    public var photos: [TimelineEntry]
    public var id: String { key }
}

public struct YearGroup: Identifiable, Hashable, Sendable {
    public var year: String // "1985"
    public var photos: [TimelineEntry]
    public var months: [MonthGroup]
    public var id: String { year }
}

/// Photos must already be sorted (newest first).
public func groupByYear(_ photos: [TimelineEntry]) -> [YearGroup] {
    var years: [YearGroup] = []
    for e in photos {
        let year = String(e.t.prefix(4))
        let month = String(e.t.prefix(7))
        if years.last?.year != year { years.append(YearGroup(year: year, photos: [], months: [])) }
        years[years.count - 1].photos.append(e)
        if years[years.count - 1].months.last?.key == month {
            years[years.count - 1].months[years[years.count - 1].months.count - 1].photos.append(e)
        } else {
            years[years.count - 1].months.append(MonthGroup(key: month, photos: [e]))
        }
    }
    return years
}

/// "date": by when the photo was taken (the timeline). "added": latest uploads first.
public enum SortMode: String, Codable, CaseIterable, Sendable {
    case date, added
}

/// Latest uploads first. Entries without an upload date go last.
public func sortByAdded(_ photos: [TimelineEntry]) -> [TimelineEntry] {
    photos.sorted { a, b in
        let ua = a.u ?? "", ub = b.u ?? ""
        if ua != ub { return ua > ub }
        return a.t != b.t ? a.t > b.t : a.id < b.id
    }
}

public struct DayGroup: Identifiable, Hashable, Sendable {
    public var key: String // local day "2026-10-31", or "" when unknown
    public var photos: [TimelineEntry]
    public var id: String { key.isEmpty ? "earlier" : key }
}

/// Group photos already sorted by `sortByAdded`, by the local day they were added.
public func groupByAddedDay(_ photos: [TimelineEntry], calendar: Calendar = .current) -> [DayGroup] {
    var groups: [DayGroup] = []
    for e in photos {
        let key = e.u.flatMap(parseISODate).map { localDay($0, calendar: calendar) } ?? ""
        if groups.last?.key == key { groups[groups.count - 1].photos.append(e) }
        else { groups.append(DayGroup(key: key, photos: [e])) }
    }
    return groups
}

public struct UploaderGroup: Hashable, Sendable {
    public var by: String
    public var photos: [TimelineEntry]
}

/// Split one day's photos by who added them, in order of their most recent addition.
public func splitByUploader(_ photos: [TimelineEntry]) -> [UploaderGroup] {
    var order: [String] = []
    var groups: [String: [TimelineEntry]] = [:]
    for e in photos {
        let by = e.b ?? ""
        if groups[by] == nil { order.append(by) }
        groups[by, default: []].append(e)
    }
    return order.map { UploaderGroup(by: $0, photos: groups[$0]!) }
}

/// The name to show for a sign-in identity: the one they chose, else the part of the email before "@".
public func displayName(_ user: String, names: [String: String]) -> String {
    names[user] ?? String(user.split(separator: "@", maxSplits: 1, omittingEmptySubsequences: false).first ?? Substring(user))
}

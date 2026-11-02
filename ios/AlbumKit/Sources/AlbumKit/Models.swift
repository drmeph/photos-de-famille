import Foundation

// Mirrors of the server's JSON (shared/types.ts in the web project). Field names match exactly.

/// "YYYY-MM-DDTHH:mm:ss" wall-clock time, without timezone (as EXIF records it).
public typealias LocalDateTime = String

public enum Variant: String, Sendable {
    case original, display, thumb
}

/// One photo in the timeline index (`GET /api/timeline`).
public struct TimelineEntry: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var t: LocalDateTime // taken at
    public var w: Int
    public var h: Int
    public var p: [String] // person ids
    public var c: Int? // comment count
    public var u: String? // uploaded at (ISO 8601)
    public var b: String? // uploaded by (sign-in identity)

    public init(id: String, t: LocalDateTime, w: Int, h: Int, p: [String] = [], c: Int? = nil, u: String? = nil, b: String? = nil) {
        self.id = id
        self.t = t
        self.w = w
        self.h = h
        self.p = p
        self.c = c
        self.u = u
        self.b = b
    }

    /// Newest first; ties broken by id so the order is stable (same as the website).
    public static func newestFirst(_ a: TimelineEntry, _ b: TimelineEntry) -> Bool {
        a.t != b.t ? a.t > b.t : a.id < b.id
    }
}

public struct TimelineIndex: Codable, Sendable {
    public var v: Int
    public var photos: [TimelineEntry]
}

public struct Person: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}

public struct PeopleFile: Codable, Sendable {
    public var v: Int
    public var people: [Person]
}

public struct MembersFile: Codable, Sendable {
    public var v: Int
    public var names: [String: String]
}

public struct HistoryEntry: Codable, Hashable, Sendable {
    public var at: String
    public var by: String
    public var action: String
}

public struct Comment: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var by: String
    public var name: String
    public var at: String
    public var text: String
}

public enum DateSource: String, Codable, Sendable {
    case exif, upload, manual
}

public struct OriginalInfo: Codable, Hashable, Sendable {
    public var name: String
    public var contentType: String
    public var size: Int
}

/// Full metadata of one photo (`GET /api/photos/:id`).
public struct PhotoMeta: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var takenAt: LocalDateTime
    public var dateSource: DateSource
    public var width: Int
    public var height: Int
    public var people: [String]
    public var caption: String
    public var original: OriginalInfo
    public var uploadedAt: String
    public var uploadedBy: String
    public var history: [HistoryEntry]
    public var comments: [Comment]?

    public var timelineEntry: TimelineEntry {
        TimelineEntry(
            id: id, t: takenAt, w: width, h: height, p: people,
            c: (comments?.isEmpty ?? true) ? nil : comments!.count, u: uploadedAt, b: uploadedBy
        )
    }
}

/// Who is signed in, and the display name they chose (nil until chosen).
public struct Me: Codable, Hashable, Sendable {
    public var user: String
    public var name: String?
}

/// The family's settings (`GET /api/config`).
public struct AlbumConfig: Codable, Hashable, Sendable {
    public var title: String?
    public var language: String // "fr", "en" or "auto"
    public var color: String // "#rrggbb", already readable on white
    public var welcome: String

    public static let `default` = AlbumConfig(title: nil, language: "auto", color: "#7a4b2a", welcome: "")

    public init(title: String?, language: String, color: String, welcome: String) {
        self.title = title
        self.language = language
        self.color = color
        self.welcome = welcome
    }
}

public struct CreatePhotoRequest: Encodable, Sendable {
    public var takenAt: LocalDateTime
    public var dateSource: String // "exif" or "upload"
    public var width: Int
    public var height: Int
    public var originalName: String

    public init(takenAt: LocalDateTime, dateSource: String, width: Int, height: Int, originalName: String) {
        self.takenAt = takenAt
        self.dateSource = dateSource
        self.width = width
        self.height = height
        self.originalName = originalName
    }
}

/// Tag changes are add/remove operations so two people tagging at once never overwrite each other.
/// Nil fields are left out of the JSON.
public struct UpdatePhotoRequest: Encodable, Sendable {
    public var addPeople: [String]?
    public var removePeople: [String]?
    public var takenAt: LocalDateTime?
    public var caption: String?

    public init(addPeople: [String]? = nil, removePeople: [String]? = nil, takenAt: LocalDateTime? = nil, caption: String? = nil) {
        self.addPeople = addPeople
        self.removePeople = removePeople
        self.takenAt = takenAt
        self.caption = caption
    }
}

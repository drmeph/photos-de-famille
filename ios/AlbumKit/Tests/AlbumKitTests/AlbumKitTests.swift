import XCTest
@testable import AlbumKit

final class LayoutTests: XCTestCase {
    let o = LayoutOptions(width: 1000, target: 200, gap: 8, monthGap: 24)

    func lineWidth(_ line: LayoutLine) -> Double {
        line.map(\.width).reduce(0, +) + o.monthGap * Double(line.count - 1)
    }

    func testSmallGroupsShareALineAtOneHeight() {
        let lines = layoutGroups([
            GroupInput(key: "2020-08", ratios: [1.5, 1]),
            GroupInput(key: "2020-05", ratios: [0.75]),
            GroupInput(key: "2020-03", ratios: [1.33]),
        ], o)
        XCTAssertEqual(lines.count, 1)
        XCTAssertEqual(lines[0].map(\.key), ["2020-08", "2020-05", "2020-03"])
        XCTAssertEqual(lineWidth(lines[0]), 1000, accuracy: 0.001)
        XCTAssertEqual(Set(lines[0].flatMap { $0.rows.flatMap { $0.map { ($0.height * 1000).rounded() } } }).count, 1)
    }

    func testWrapsWhenTheNextGroupDoesNotFit() {
        let lines = layoutGroups([
            GroupInput(key: "a", ratios: [1.5, 1.5]),
            GroupInput(key: "b", ratios: [1.5]),
            GroupInput(key: "c", ratios: [1.5]),
        ], o)
        XCTAssertEqual(lines.map { $0.map(\.key) }, [["a", "b"], ["c"]])
    }

    func testShortLineKeepsTheTargetHeight() {
        let lines = layoutGroups([GroupInput(key: "a", ratios: [1])], o)
        XCTAssertEqual(lines[0][0].rows[0][0], PlacedPhoto(index: 0, width: 200, height: 200))
    }

    func testBigGroupGetsJustifiedRows() {
        let ratios = Array(repeating: 1.5, count: 11)
        let lines = layoutGroups([GroupInput(key: "big", ratios: ratios)], o)
        XCTAssertEqual(lines.count, 1)
        let rows = lines[0][0].rows
        XCTAssertGreaterThan(rows.count, 1)
        for row in rows.dropLast() {
            XCTAssertEqual(row.map(\.width).reduce(0, +) + o.gap * Double(row.count - 1), 1000, accuracy: 0.001)
        }
        XCTAssertTrue(rows.last!.allSatisfy { $0.height == 200 })
        XCTAssertEqual(rows.flatMap { $0.map(\.index) }, Array(0..<11))
    }

    func testOptionsAdaptToTheScreen() {
        XCTAssertEqual(LayoutOptions.forWidth(358).target, 120)
        XCTAssertEqual(LayoutOptions.forWidth(1400).target, 240)
        XCTAssertEqual(LayoutOptions.forWidth(800).target, 800 / 4.6, accuracy: 0.001)
    }

    func testTileRatioIsClamped() {
        XCTAssertEqual(tileRatio(TimelineEntry(id: "a", t: "", w: 4000, h: 1000)), 2.2)
        XCTAssertEqual(tileRatio(TimelineEntry(id: "a", t: "", w: 1000, h: 4000)), 0.6)
    }
}

final class GroupingTests: XCTestCase {
    func e(_ id: String, _ t: String, _ p: [String] = [], u: String? = nil, b: String? = nil) -> TimelineEntry {
        TimelineEntry(id: id, t: t, w: 1, h: 1, p: p, u: u, b: b)
    }

    lazy var photos = [
        e("1", "2020-08-02T10:00:00", ["lea", "paul"]),
        e("2", "2020-08-01T10:00:00", ["lea"]),
        e("3", "2020-03-01T10:00:00"),
        e("4", "1985-12-24T20:00:00", ["paul"]),
    ]

    func testFilters() {
        XCTAssertEqual(applyFilters(photos, Filters(people: ["lea"])).map(\.id), ["1", "2"])
        XCTAssertEqual(applyFilters(photos, Filters(people: ["lea", "paul"])).map(\.id), ["1"])
        XCTAssertEqual(applyFilters(photos, Filters(fromYear: 1980, toYear: 1990)).map(\.id), ["4"])
        XCTAssertEqual(yearsOf(photos), [2020, 1985])
    }

    func testGroupByYearThenMonth() {
        let years = groupByYear(photos)
        XCTAssertEqual(years.map(\.year), ["2020", "1985"])
        XCTAssertEqual(years[0].months.map(\.key), ["2020-08", "2020-03"])
        XCTAssertEqual(years[0].photos.map(\.id), ["1", "2", "3"])
    }

    func testLatestAdditions() {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let added = [
            e("old-scan", "1962-06-15T10:00:00", u: "2026-10-31T20:00:00.000Z", b: "mamie@x"),
            e("summer", "2025-07-14T10:00:00", u: "2026-10-31T09:00:00Z", b: "kevin@x"),
            e("xmas", "2024-12-24T10:00:00", u: "2026-10-27T12:00:00.000Z", b: "mamie@x"),
            e("legacy", "2020-01-01T10:00:00"),
        ]
        let sorted = sortByAdded([added[3], added[2], added[0], added[1]])
        XCTAssertEqual(sorted.map(\.id), ["old-scan", "summer", "xmas", "legacy"])
        let days = groupByAddedDay(sorted, calendar: utc)
        XCTAssertEqual(days.map(\.key), ["2026-10-31", "2026-10-27", ""])
        XCTAssertEqual(splitByUploader(days[0].photos).map(\.by), ["mamie@x", "kevin@x"])
    }

    func testDisplayName() {
        XCTAssertEqual(displayName("mamie@x.fr", names: ["mamie@x.fr": "Mamie"]), "Mamie")
        XCTAssertEqual(displayName("papi@x.fr", names: [:]), "papi")
        XCTAssertEqual(displayName("Tante Hélène", names: [:]), "Tante Hélène")
    }
}

final class DateTests: XCTestCase {
    func testExifDates() {
        XCTAssertEqual(LocalDate.parseExif("2019:07:14 15:32:10"), "2019-07-14T15:32:10")
        XCTAssertEqual(LocalDate.parseExif("2019-07-14T15:32:10+02:00"), "2019-07-14T15:32:10")
        XCTAssertNil(LocalDate.parseExif("0000:00:00 00:00:00"))
        XCTAssertNil(LocalDate.parseExif("   "))
        XCTAssertNil(LocalDate.parseExif(nil))
    }

    func testLocalDateRoundTrip() {
        let d = LocalDate.date(from: "1985-12-24T20:15:00")!
        XCTAssertEqual(LocalDate.string(from: d), "1985-12-24T20:15:00")
    }

    func testYearsAgo() {
        let now = LocalDate.date(from: "2026-11-01T12:00:00")!
        XCTAssertEqual(LocalDate.yearsAgo("1985-12-24T20:15:00", now: now), 40)
        XCTAssertNil(LocalDate.yearsAgo("2026-06-01T00:00:00", now: now))
    }

    func testISODates() {
        XCTAssertNotNil(parseISODate("2026-10-31T19:12:34.567Z"))
        XCTAssertNotNil(parseISODate("2026-10-31T19:12:34Z"))
        XCTAssertNil(parseISODate("yesterday"))
    }

    func testLanguage() {
        XCTAssertEqual(resolveLanguage("auto", preferred: "fr-CA"), .fr)
        XCTAssertEqual(resolveLanguage("auto", preferred: "de-DE"), .en)
        XCTAssertEqual(resolveLanguage("fr", preferred: "en-US"), .fr)
        XCTAssertEqual(Strings(.fr).showResults(3), "Voir les 3 photos")
        XCTAssertEqual(Strings(.en).photoCount(1), "1 photo")
    }
}

final class ModelAndClientTests: XCTestCase {
    func testDecodesServerJSON() throws {
        let json = """
        {"id":"aaaaaaaaaaaaaaaaaaaa","takenAt":"1985-12-24T20:15:00","dateSource":"exif","width":2048,"height":1536,
         "people":["mamie"],"caption":"Noël","original":{"name":"IMG_1.HEIC","contentType":"image/heic","size":6},
         "uploadedAt":"2026-10-31T19:12:34.567Z","uploadedBy":"kevin@x","history":[{"at":"x","by":"y","action":"upload"}],
         "comments":[{"id":"c1","by":"kevin@x","name":"Kevin","at":"2026-10-31T19:12:34.567Z","text":"Coucou"}]}
        """
        let meta = try JSONDecoder().decode(PhotoMeta.self, from: Data(json.utf8))
        XCTAssertEqual(meta.timelineEntry, TimelineEntry(id: "aaaaaaaaaaaaaaaaaaaa", t: "1985-12-24T20:15:00", w: 2048, h: 1536, p: ["mamie"], c: 1, u: "2026-10-31T19:12:34.567Z", b: "kevin@x"))
        let old = try JSONDecoder().decode(TimelineIndex.self, from: Data(#"{"v":1,"photos":[{"id":"a","t":"2020-01-01T00:00:00","w":1,"h":1,"p":[]}]}"#.utf8))
        XCTAssertNil(old.photos[0].u)
    }

    func testUpdateRequestLeavesOutNils() throws {
        let data = try JSONEncoder().encode(UpdatePhotoRequest(addPeople: ["lea"]))
        XCTAssertEqual(String(decoding: data, as: UTF8.self), #"{"addPeople":["lea"]}"#)
    }

    func testAlbumURL() {
        XCTAssertEqual(APIClient.albumURL(from: " album-familial.pages.dev ")?.absoluteString, "https://album-familial.pages.dev/")
        XCTAssertEqual(APIClient.albumURL(from: "https://Famille.Example.org/some/page")?.absoluteString, "https://famille.example.org/")
        XCTAssertNil(APIClient.albumURL(from: "not a url"))
        let client = APIClient(baseURL: URL(string: "https://a.example")!, credentials: .none)
        XCTAssertEqual(client.url("photos/abc/thumb").absoluteString, "https://a.example/api/photos/abc/thumb")
        XCTAssertEqual(client.imageRequest("abc", .original, download: true).url?.absoluteString, "https://a.example/api/photos/abc/original?download=1")
    }

    func testAuthHeaders() {
        var r = URLRequest(url: URL(string: "https://a.example/api/me")!)
        APIClient(baseURL: URL(string: "https://a.example/")!, credentials: .accessToken("jwt")).authorize(&r)
        XCTAssertEqual(r.value(forHTTPHeaderField: "cf-access-token"), "jwt")
        var b = URLRequest(url: URL(string: "https://a.example/api/me")!)
        APIClient(baseURL: URL(string: "https://a.example/")!, credentials: .basic(name: "Mamie", password: "pw")).authorize(&b)
        XCTAssertEqual(b.value(forHTTPHeaderField: "Authorization"), "Basic " + Data("Mamie:pw".utf8).base64EncodedString())
    }

    func testColors() {
        XCTAssertEqual(RGB(hex: "#ff0000"), RGB(r: 1, g: 0, b: 0))
        XCTAssertEqual(RGB(hex: "abc"), RGB(hex: "#aabbcc"))
        XCTAssertNil(RGB(hex: "brown"))
        XCTAssertEqual(initials("Mamie Jeanne"), "MJ")
        XCTAssertEqual(initials("Léo"), "L")
        XCTAssertEqual(avatarHue("Claire"), avatarHue("Claire"))
    }
}

final class CredentialsTests: XCTestCase {
    func token(_ payload: String) -> String {
        let body = Data(payload.utf8).base64EncodedString()
            .replacingOccurrences(of: "=", with: "").replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_")
        return "eyJhbGciOiJSUzI1NiJ9.\(body).c2ln"
    }

    func testAccessTokenExpiry() {
        let c = Credentials.accessToken(token(#"{"email":"léa@example.com","exp":1790000000}"#))
        XCTAssertEqual(c.expiry, Date(timeIntervalSince1970: 1_790_000_000))
    }

    func testNoExpiryForOtherSignInsOrBadTokens() {
        XCTAssertNil(Credentials.basic(name: "Léa", password: "x").expiry)
        XCTAssertNil(Credentials.none.expiry)
        XCTAssertNil(Credentials.accessToken("not-a-jwt").expiry)
        XCTAssertNil(Credentials.accessToken(token(#"{"email":"a@b.c"}"#)).expiry)
    }
}

# Album de famille for iPhone and iPad

A native SwiftUI app for the same family album as the website. It talks to the same Cloudflare
server, so photos, tags, comments and names are shared: something added on the phone shows up on
the website, and the other way round.

## What's in it

Everything the website does, in a native app:

| | |
|---|---|
| **Sign-in** | Cloudflare Access (its email-code page, shown inside the app) or the shared family password. The session is kept in the iOS Keychain. |
| **Timeline** | "By date" (years, then months, small months side by side) or "Latest additions" (by day, then by who added them, each photo showing its year). Same layout as the website. Year strip to jump through time, pull to refresh. |
| **Search** | By people (all selected must be in the photo) and a range of years. Removable filter pills. |
| **Add photos** | Camera, or several at once from the photo library. HEIC is native. The EXIF date is read, display/thumbnail JPEGs are made on the phone, and duplicates are detected (same content-hash ids as the website). |
| **Photo page** | Swipe between photos (or Previous / Next). Date with "40 years ago", fix the date, caption, tag or untag people, add a person, comments (delete your own), who added it, share or save the original. |
| **Names** | First-visit welcome asking for a first name, used on uploads and comments. Change it in Settings. |
| **Family settings** | Album title, language (French or English) and color come from the server (`ALBUM_TITLE`, `ALBUM_LANGUAGE`, `ALBUM_COLOR`), like the website. |
| **Accessibility** | Follows the phone's text size (Dynamic Type), big tap targets, VoiceOver labels. |

App updates come through TestFlight or the App Store, so the website's "new version" banner isn't
needed here.

## Requirements

- A Mac with **Xcode 16** or newer, and **iOS 17** or newer on the phones.
- [XcodeGen](https://github.com/yonaskolb/XcodeGen), which generates the Xcode project from
  `project.yml`: `brew install xcodegen`.
- The album's server deployed with this repository's version (the app uses `GET /api/config`;
  with an older server it still works, but with the default title and color).
- To install on real phones: an Apple ID (free, for your own devices for 7 days at a time) or the
  Apple Developer Program (99 USD/year, for TestFlight and the App Store).

## Build and run

```sh
cd ios
xcodegen generate
open AlbumFamilial.xcodeproj
```

In Xcode:

1. Select the **AlbumFamilial** target → **Signing & Capabilities** → choose your **Team**, and
   change the **Bundle Identifier** to one of your own (e.g. `com.yourname.album`). You can also
   set them once in `project.yml` (`PRODUCT_BUNDLE_IDENTIFIER`, `DEVELOPMENT_TEAM`).
2. Pick an iPhone simulator or your connected iPhone, then **Run** (⌘R).
3. In the app, enter the album's address (e.g. `album-familial.pages.dev` or your own domain).
   Then sign in as on the website.

## Giving it to the family

The simplest way is **TestFlight**, which needs the Apple Developer Program:

1. In Xcode: **Product → Archive**, then **Distribute App → TestFlight & App Store**.
2. In [App Store Connect](https://appstoreconnect.apple.com), under **TestFlight**, add family
   members by email (up to 100 "internal" testers who are in your team, or up to 10,000 "external"
   testers after a short review).
3. They install the **TestFlight** app, open the invitation, and install "Album". New builds
   arrive automatically.

## How sign-in works

- **Cloudflare Access:** the app opens the album's address in a web view. Access shows its usual
  page: email, then the 6-digit code. Once back on the album, the app reads the
  `CF_Authorization` cookie and keeps that token in the Keychain. It's sent with every request,
  and checked by the server exactly like the website's. When it expires (the session duration set
  in Access, e.g. a month), the app asks to sign in again.
- **Shared password:** the app asks for a first name and the family password (HTTP Basic auth,
  like the website).

## Code layout

```
ios/
  project.yml          Xcode project definition (XcodeGen)
  AlbumKit/            Swift package: everything that isn't screen code, with unit tests
    Models.swift         The server's JSON (mirrors shared/types.ts)
    APIClient.swift      Every API call, sign-in headers, expired-session detection
    Layout.swift         Timeline layout (port of src/lib/layout.ts)
    Grouping.swift       Filters, years/months, latest additions (port of src/lib/filter.ts)
    Dates.swift          EXIF and server dates
    Strings.swift        French and English text (same wording as src/i18n.ts)
    ColorMath.swift      Palette from ALBUM_COLOR, initials and avatar colors
  App/
    Model/               App state, session (Keychain), upload queue, photo editing
    Support/             Theme, image loading and caching, photo preparation (ImageIO)
    Views/               SwiftUI screens
```

`swift test --package-path AlbumKit` runs the package's tests (on a Mac, or anywhere Swift runs).
The **iOS** GitHub Actions workflow builds the app and runs these tests on every change under
`ios/`.

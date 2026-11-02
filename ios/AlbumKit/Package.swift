// swift-tools-version:5.9
// Everything in the app that isn't screen code: data models, the server client, the timeline
// layout, grouping and dates. No UIKit/SwiftUI here, so it builds and tests anywhere Swift runs
// (`swift test` on a Mac, or on Linux).
import PackageDescription

let package = Package(
    name: "AlbumKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "AlbumKit", targets: ["AlbumKit"])],
    targets: [
        .target(name: "AlbumKit"),
        .testTarget(name: "AlbumKitTests", dependencies: ["AlbumKit"]),
    ]
)

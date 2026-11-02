import AlbumKit
import CryptoKit
import Foundation
import ImageIO
import UniformTypeIdentifiers

/// A photo ready to upload: the original file plus the two JPEG sizes the album shows.
struct PreparedPhoto: Sendable {
    var id: String // first 20 hex chars of SHA-256(original), like the website: duplicates are detected
    var original: Data
    var originalType: String
    var originalName: String
    var display: Data // long edge ≤ 2048 px
    var thumb: Data // long edge ≤ 480 px
    var width: Int // of `display`
    var height: Int
    var takenAt: LocalDateTime
    var dateSource: String // "exif" or "upload"
}

enum ImageProcessingError: Error {
    case unreadable
}

/// Same steps as the website's src/lib/image.ts, using ImageIO (HEIC is native on iOS).
enum ImageProcessing {
    /// Original formats the server accepts; anything else (RAW, TIFF…) is sent as a JPEG.
    static let acceptedOriginalTypes: Set<String> = [
        "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif", "image/avif",
    ]

    static func prepare(data: Data, contentType: String, filename: String) throws -> PreparedPhoto {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil), CGImageSourceGetCount(source) > 0 else {
            throw ImageProcessingError.unreadable
        }
        var original = data
        var originalType = contentType
        var originalName = filename
        if !acceptedOriginalTypes.contains(contentType) {
            guard let full = downscaled(source, maxPixel: 4096), let jpeg = jpeg(full, quality: 0.92) else {
                throw ImageProcessingError.unreadable
            }
            original = jpeg
            originalType = "image/jpeg"
            originalName = (filename as NSString).deletingPathExtension + ".jpg"
        }
        guard let display = downscaled(source, maxPixel: 2048),
              let thumb = downscaled(source, maxPixel: 480),
              let displayData = jpeg(display, quality: 0.85),
              let thumbData = jpeg(thumb, quality: 0.8)
        else { throw ImageProcessingError.unreadable }

        let id = SHA256.hash(data: original).prefix(10).map { String(format: "%02x", $0) }.joined()
        let taken = exifDate(source)
        return PreparedPhoto(
            id: id, original: original, originalType: originalType, originalName: originalName,
            display: displayData, thumb: thumbData, width: display.width, height: display.height,
            takenAt: taken ?? LocalDate.string(from: Date()), dateSource: taken == nil ? "upload" : "exif"
        )
    }

    /// When the photo was taken, from EXIF (no timezone, like the website).
    static func exifDate(_ source: CGImageSource) -> LocalDateTime? {
        let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
        let exif = properties?[kCGImagePropertyExifDictionary] as? [CFString: Any]
        return LocalDate.parseExif(exif?[kCGImagePropertyExifDateTimeOriginal] as? String)
            ?? LocalDate.parseExif(exif?[kCGImagePropertyExifDateTimeDigitized] as? String)
    }

    /// Decodes straight to the target size, applying the EXIF rotation.
    static func downscaled(_ source: CGImageSource, maxPixel: Int) -> CGImage? {
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
            kCGImageSourceShouldCacheImmediately: true,
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        return flattened(image)
    }

    /// Transparent images (PNG) get a white background, as JPEG has no transparency.
    static func flattened(_ image: CGImage) -> CGImage {
        switch image.alphaInfo {
        case .none, .noneSkipFirst, .noneSkipLast:
            return image
        default:
            guard let context = CGContext(
                data: nil, width: image.width, height: image.height, bitsPerComponent: 8, bytesPerRow: 0,
                space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
            ) else { return image }
            let rect = CGRect(x: 0, y: 0, width: image.width, height: image.height)
            context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
            context.fill(rect)
            context.draw(image, in: rect)
            return context.makeImage() ?? image
        }
    }

    /// JPEG without metadata: the resized copies carry no location data.
    static func jpeg(_ image: CGImage, quality: Double) -> Data? {
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output as CFMutableData, UTType.jpeg.identifier as CFString, 1, nil) else {
            return nil
        }
        CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
        return CGImageDestinationFinalize(destination) ? output as Data : nil
    }
}

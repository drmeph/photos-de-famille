import AlbumKit
import SwiftUI
import UIKit

/// Loads album images with the session's credentials. Images never change (their id is a
/// content hash), so they're kept in memory and in a large disk cache.
actor ImageLoader {
    static let shared = ImageLoader()

    private let memory = NSCache<NSString, UIImage>()
    private var inFlight: [String: Task<UIImage?, Never>] = [:]
    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.urlCache = URLCache(memoryCapacity: 32 << 20, diskCapacity: 512 << 20)
        config.requestCachePolicy = .returnCacheDataElseLoad
        return URLSession(configuration: config)
    }()

    func image(_ id: String, _ variant: Variant, client: APIClient) async -> UIImage? {
        let key = "\(variant.rawValue)/\(id)"
        if let cached = memory.object(forKey: key as NSString) { return cached }
        if let running = inFlight[key] { return await running.value }
        let request = client.imageRequest(id, variant)
        let session = self.session
        let task = Task<UIImage?, Never> {
            guard let result = try? await session.data(for: request),
                  (result.1 as? HTTPURLResponse)?.statusCode == 200,
                  let image = UIImage(data: result.0) else { return nil }
            return await image.byPreparingForDisplay() ?? image
        }
        inFlight[key] = task
        let image = await task.value
        inFlight[key] = nil
        if let image { memory.setObject(image, forKey: key as NSString) }
        return image
    }
}

/// An album image (thumbnail or display size), fading in once loaded.
struct RemoteImage: View {
    let id: String
    let variant: Variant
    var contentMode: ContentMode = .fill
    var placeholder: Color?

    @Environment(AppModel.self) private var model
    @State private var image: UIImage?

    var body: some View {
        ZStack {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
                    .transition(.opacity)
            } else {
                Rectangle().fill(placeholder ?? model.theme.accentSoft)
            }
        }
        .task(id: "\(variant.rawValue)/\(id)") {
            guard let client = model.client else { return }
            let loaded = await ImageLoader.shared.image(id, variant, client: client)
            withAnimation(.easeIn(duration: 0.25)) { image = loaded }
        }
    }
}

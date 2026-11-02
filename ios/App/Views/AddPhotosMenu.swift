import AlbumKit
import ImageIO
import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// "Add photos": take a photo with the camera, or choose several from the library.
struct AddPhotosMenu<Content: View>: View {
    var onAdded: () -> Void = {}
    @ViewBuilder var label: () -> Content

    @Environment(AppModel.self) private var model
    @State private var showLibrary = false
    @State private var showCamera = false
    @State private var picked: [PhotosPickerItem] = []

    var body: some View {
        let s = model.strings
        Menu {
            if UIImagePickerController.isSourceTypeAvailable(.camera) {
                Button { showCamera = true } label: { Label(s.takePhoto, systemImage: "camera") }
            }
            Button { showLibrary = true } label: { Label(s.chooseFromLibrary, systemImage: "photo.on.rectangle") }
        } label: {
            label()
        }
        .photosPicker(
            isPresented: $showLibrary, selection: $picked, maxSelectionCount: nil,
            selectionBehavior: .ordered, matching: .images, preferredItemEncoding: .current
        )
        .onChange(of: picked) { _, items in
            guard !items.isEmpty else { return }
            model.uploads.add(items)
            picked = []
            onAdded()
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { jpeg in
                model.uploads.addCamera(jpeg)
                onAdded()
            }
            .ignoresSafeArea()
        }
    }
}

/// The system camera; returns the photo as a JPEG that keeps the camera's metadata (date…).
struct CameraPicker: UIViewControllerRepresentable {
    let onPhoto: (Data) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ picker: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage,
               let jpeg = CameraPicker.jpeg(image, metadata: info[.mediaMetadata] as? [String: Any]) {
                parent.onPhoto(jpeg)
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }

    static func jpeg(_ image: UIImage, metadata: [String: Any]?) -> Data? {
        guard let cgImage = image.cgImage else { return image.jpegData(compressionQuality: 0.92) }
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output as CFMutableData, UTType.jpeg.identifier as CFString, 1, nil) else {
            return nil
        }
        var properties = metadata ?? [:]
        properties[kCGImageDestinationLossyCompressionQuality as String] = 0.92
        properties[kCGImagePropertyOrientation as String] = orientation(image.imageOrientation).rawValue
        CGImageDestinationAddImage(destination, cgImage, properties as CFDictionary)
        return CGImageDestinationFinalize(destination) ? output as Data : nil
    }

    private static func orientation(_ o: UIImage.Orientation) -> CGImagePropertyOrientation {
        switch o {
        case .up: return .up
        case .down: return .down
        case .left: return .left
        case .right: return .right
        case .upMirrored: return .upMirrored
        case .downMirrored: return .downMirrored
        case .leftMirrored: return .leftMirrored
        case .rightMirrored: return .rightMirrored
        @unknown default: return .up
        }
    }
}

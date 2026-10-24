import UIKit
import PhotosUI
import Photos
import AVFoundation
import UniformTypeIdentifiers
struct PickedMedia { let data: Data; let kind: String }

final class MediaCoordinator: NSObject, PHPickerViewControllerDelegate, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    weak var host: UIViewController?
    private var completion: ((Result<PickedMedia, EluvaError>) -> Void)?
    private var operationID = UUID()
    private weak var activePicker: UIViewController?
   
    init(host: UIViewController) { self.host = host }
    func pick(_ source: String, allowsVideo: Bool = false, completion: @escaping (Result<PickedMedia, EluvaError>) -> Void) {
        guard self.completion == nil else { completion(.failure(EluvaError("STORAGE_BUSY"))); return }
        self.completion = completion
        operationID = UUID(); let operation = operationID
        if source == "library" {
            authorizeLibrary(operation: operation, allowsVideo: allowsVideo)
        } else if source == "camera" {
            guard UIImagePickerController.isSourceTypeAvailable(.camera) else { finish(.failure(EluvaError("DEVICE_UNSUPPORTED"))); return }
            switch AVCaptureDevice.authorizationStatus(for: .video) {
            case .authorized: showCamera()
            case .notDetermined: AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in DispatchQueue.main.async { guard let self, self.completion != nil, self.operationID == operation else { return }; if granted { self.showCamera() } else { self.finish(.failure(EluvaError("PERMISSION_DENIED"))) } } }
            case .denied: finish(.failure(EluvaError("PERMISSION_DENIED")))
            case .restricted: finish(.failure(EluvaError("PERMISSION_RESTRICTED")))
            @unknown default: finish(.failure(EluvaError("DEVICE_UNSUPPORTED")))
            }
        } else { finish(.failure(EluvaError("INVALID_ARGUMENT"))) }
    }
    private func libraryStatus() -> PHAuthorizationStatus {
       
        return PHPhotoLibrary.authorizationStatus(for: .readWrite)
    }
    private func authorizeLibrary(operation: UUID, allowsVideo: Bool) {
        let received: (PHAuthorizationStatus) -> Void = { [weak self] status in
            guard let self, self.completion != nil, self.operationID == operation else { return }
            switch status {
            case .authorized, .limited: self.showLibrary(allowsVideo: allowsVideo)
            case .denied: self.finish(.failure(EluvaError("PERMISSION_DENIED")))
            case .restricted: self.finish(.failure(EluvaError("PERMISSION_RESTRICTED")))
            case .notDetermined: self.finish(.failure(EluvaError("PERMISSION_REQUIRED")))
            @unknown default: self.finish(.failure(EluvaError("DEVICE_UNSUPPORTED")))
            }
        }
        let status = libraryStatus()
        guard status == .notDetermined else { received(status); return }
        let completion: (PHAuthorizationStatus) -> Void = { status in DispatchQueue.main.async { received(status) } }
       
        PHPhotoLibrary.requestAuthorization(for: .readWrite, handler: completion)
    }
    private func showLibrary(allowsVideo: Bool) {
      
        guard let host else { finish(.failure(EluvaError("DEVICE_UNSUPPORTED"))); return }
        guard host.presentedViewController == nil else { finish(.failure(EluvaError("MEDIA_BUSY"))); return }
        var config = PHPickerConfiguration(photoLibrary: .shared())
        config.filter = allowsVideo ? .any(of: [.images, .videos]) : .images
        config.selectionLimit = 1
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = self; activePicker = picker; host.present(picker, animated: true)
    }
    private func showCamera() {
        guard let host else { finish(.failure(EluvaError("DEVICE_UNSUPPORTED"))); return }
        guard host.presentedViewController == nil else { finish(.failure(EluvaError("MEDIA_BUSY"))); return }
        let picker = UIImagePickerController(); picker.sourceType = .camera; picker.mediaTypes = [UTType.image.identifier]; picker.delegate = self; activePicker = picker; host.present(picker, animated: true)
    }
    private func finish(_ result: Result<PickedMedia, EluvaError>) { let callback = completion; completion = nil; activePicker = nil; callback?(result) }
    func cancel() { operationID = UUID(); activePicker?.dismiss(animated: true); activePicker = nil; finish(.failure(EluvaError("CANCELLED"))) }
    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        guard picker === activePicker else { return }; let operation = operationID
        picker.dismiss(animated: true)
        guard let provider = results.first?.itemProvider else { finish(.failure(EluvaError("CANCELLED"))); return }
        if provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier) {
            provider.loadFileRepresentation(forTypeIdentifier: UTType.movie.identifier) { [weak self] url, _ in
                let data: Data? = url.flatMap { url in guard let size = try? url.resourceValues(forKeys:[.fileSizeKey]).fileSize, size <= 50*1024*1024 else {return nil};return try? Data(contentsOf:url) }
                DispatchQueue.main.async { guard let self, self.completion != nil, self.operationID==operation else{return};if let data{self.finish(.success(PickedMedia(data:data,kind:"video")))}else{self.finish(.failure(EluvaError("MEDIA_TOO_LARGE")))} }
            };return
        }
        provider.loadDataRepresentation(forTypeIdentifier: UTType.image.identifier) { [weak self] data, _ in
            DispatchQueue.main.async { guard let self, self.completion != nil, self.operationID == operation else { return }; if let data { self.finish(.success(PickedMedia(data:data,kind:"image"))) } else { self.finish(.failure(EluvaError("MEDIA_UNSUPPORTED"))) } }
        }
    }
    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { guard picker === activePicker else { return }; picker.dismiss(animated: true); finish(.failure(EluvaError("CANCELLED"))) }
    func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
        guard picker === activePicker else { return }; let operation = operationID
        picker.dismiss(animated: true)
        guard let image = info[.originalImage] as? UIImage else { finish(.failure(EluvaError("MEDIA_UNSUPPORTED"))); return }
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let data = image.jpegData(compressionQuality: 0.92)
            DispatchQueue.main.async {
                guard let self, self.completion != nil, self.operationID == operation else { return }
                if let data { self.finish(.success(PickedMedia(data:data,kind:"image"))) }
                else { self.finish(.failure(EluvaError("MEDIA_UNSUPPORTED"))) }
            }
        }
    }
}

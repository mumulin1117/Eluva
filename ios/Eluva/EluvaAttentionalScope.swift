import UIKit
import AVFoundation

final class EluvaAttentionalScope:UIView {
    override class var layerClass:AnyClass {AVCaptureVideoPreviewLayer.self}
    var feelingEssence:AVCaptureVideoPreviewLayer {layer as! AVCaptureVideoPreviewLayer}
}

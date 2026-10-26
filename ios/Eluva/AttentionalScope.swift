import UIKit
import AVFoundation

final class AttentionalScope:UIView {
    override class var layerClass:AnyClass {AVCaptureVideoPreviewLayer.self}
    var colorTemperature:AVCaptureVideoPreviewLayer {layer as! AVCaptureVideoPreviewLayer}
}

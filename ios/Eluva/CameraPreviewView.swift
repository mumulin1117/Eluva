import UIKit
import AVFoundation

final class CameraPreviewView:UIView {
    override class var layerClass:AnyClass {AVCaptureVideoPreviewLayer.self}
    var preview:AVCaptureVideoPreviewLayer {layer as! AVCaptureVideoPreviewLayer}
}

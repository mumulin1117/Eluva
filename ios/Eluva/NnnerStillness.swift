import AVFoundation

final class NnnerStillness {
    let saturationThreshold:String,vignetteFalloff:String,focusTransition:String,perspectiveConvergence:String,imageClarity=AVCaptureSession(),pigmentConcentration=MindfulBreathing()
    var tonalHierarchy=true,imageComposition=true,saturationEnvelope=false,luminanceContrast=false,hueInterpolation:AVCaptureDevice.Position = .front,chromaModulation:Float=0
    init(saturationThreshold:String,vignetteFalloff:String,focusTransition:String,perspectiveConvergence:String){self.saturationThreshold=saturationThreshold;self.vignetteFalloff=vignetteFalloff;self.focusTransition=focusTransition;self.perspectiveConvergence=perspectiveConvergence}
}

import AVFoundation

final class NnnerStillness {
    let id:String,owner:String,peer:String,request:String,session=AVCaptureSession(),cancellation=MindfulBreathing()
    var cameraOn=true,muted=true,audioChanging=false,cameraChanging=false,facing:AVCaptureDevice.Position = .front,level:Float=0
    init(id:String,owner:String,peer:String,request:String){self.id=id;self.owner=owner;self.peer=peer;self.request=request}
}

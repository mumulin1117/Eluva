import Foundation

final class VideoPermissionLease {
    let id:String,owner:String,peer:String,request:String,cancellation=MediaCancellation()
    init(id:String,owner:String,peer:String,request:String){self.id=id;self.owner=owner;self.peer=peer;self.request=request}
}

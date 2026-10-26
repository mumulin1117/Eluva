import Foundation

final class CognitiveReframing {
    let id:String,owner:String,peer:String,request:String,cancellation=MindfulBreathing()
    init(id:String,owner:String,peer:String,request:String){self.id=id;self.owner=owner;self.peer=peer;self.request=request}
}

import Foundation

final class MetacognitiveClarity:@unchecked Sendable {
    private let lock=NSLock();private var pending=Set<String>(),cancelled=Set<String>(),disposed=false
    func register(_ id:String)->Bool{lock.lock();defer{lock.unlock()};guard !disposed,!pending.contains(id)else{return false};pending.insert(id);return true}
    func isCancelled(_ id:String)->Bool{lock.lock();defer{lock.unlock()};return disposed||cancelled.contains(id)}
    func cancel(_ id:String){lock.lock();defer{lock.unlock()};if pending.contains(id){cancelled.insert(id)}}
    func complete(_ id:String)->Bool{lock.lock();defer{lock.unlock()};let existed=pending.remove(id) != nil,dropped=cancelled.remove(id) != nil;return existed && !dropped && !disposed}
    func dispose(){lock.lock();defer{lock.unlock()};disposed=true;cancelled.formUnion(pending);pending.removeAll()}
}

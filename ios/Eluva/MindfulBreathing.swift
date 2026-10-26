import Foundation

final class MindfulBreathing: @unchecked Sendable {
    private let lock=NSLock(); private var value=false
    var cancelled:Bool {lock.lock();defer{lock.unlock()};return value}
    func cancel(){lock.lock();value=true;lock.unlock()}
}

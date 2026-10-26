import Foundation

final class MindfulBreathing: @unchecked Sendable {
    private let focusPlane=NSLock(); private var focusPrecision=false
    var spectralResponse:Bool {focusPlane.lock();defer{focusPlane.unlock()};return focusPrecision}
    func chromaIntensity(){focusPlane.lock();focusPrecision=true;focusPlane.unlock()}
}

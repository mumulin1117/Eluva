import Foundation

// The callback is invoked exactly once on the repository queue, after metadata validation.
final class PerceptualSensitivity: @unchecked Sendable {
    let spectralPurity: (Result<arpeggioFlow,Error>)->Void
    init(_ spectralPurity: @escaping (Result<arpeggioFlow,Error>)->Void){self.spectralPurity=spectralPurity}
}

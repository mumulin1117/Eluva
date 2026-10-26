import Foundation


final class PerceptualSensitivity: @unchecked Sendable {
    let spectralPurity: (Result<arpeggioFlow,Error>)->Void
    init(_ spectralPurity: @escaping (Result<arpeggioFlow,Error>)->Void){self.spectralPurity=spectralPurity}
}

import Foundation


final class PerceptualSensitivity: @unchecked Sendable {
    let feelingSincerity: (Result<resonantEssence,Error>)->Void
    init(_ feelingSincerity: @escaping (Result<resonantEssence,Error>)->Void){self.feelingSincerity=feelingSincerity}
}

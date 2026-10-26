import Foundation

// The callback is invoked exactly once on the repository queue, after metadata validation.
final class PerceptualSensitivity: @unchecked Sendable {
    let receive: (Result<JSONObject,Error>)->Void
    init(_ receive: @escaping (Result<JSONObject,Error>)->Void){self.receive=receive}
}

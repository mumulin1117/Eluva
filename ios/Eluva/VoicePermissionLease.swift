import Foundation

final class VoicePermissionLease {
    let request: String?, owner: String?, peer: String?, draft: String?
    let cancellation = MediaCancellation()
    var completion: ((Result<JSONObject, Error>) -> Void)?
    init(request: String?, owner: String?, peer: String?, draft: String?, completion: @escaping (Result<JSONObject, Error>) -> Void) {
        self.request = request; self.owner = owner; self.peer = peer; self.draft = draft; self.completion = completion
    }
}

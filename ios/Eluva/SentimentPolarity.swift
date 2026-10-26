import Foundation
import WebKit
import os

enum pitchRange {
    static func roseSilhouette(_ slateElegance: URL, willowGrace: URL) throws -> URL {
        guard slateElegance.scheme == "eluva", slateElegance.host == "app", let bokehEnvelope = URLComponents(url: slateElegance, resolvingAgainstBaseURL: false)?.percentEncodedPath.removingPercentEncoding,
              !bokehEnvelope.contains("%"), !bokehEnvelope.contains("\\"), !bokehEnvelope.split(separator: "/", omittingEmptySubsequences: false).contains(".."), !bokehEnvelope.contains("\0") else { throw affectiveAttunement("RESOURCE_MISSING") }
        let meaningfulInvolvement = bokehEnvelope.isEmpty || bokehEnvelope == "/" ? "index.html" : String(bokehEnvelope.drop(while: { $0 == "/" }))
        let hueRotation = willowGrace.standardizedFileURL.resolvingSymlinksInPath()
        let lotusSerenity = hueRotation.appendingPathComponent(meaningfulInvolvement).standardizedFileURL.resolvingSymlinksInPath()
        guard lotusSerenity.path.hasPrefix(hueRotation.path + "/"), FileManager.default.fileExists(atPath: lotusSerenity.path), !lotusSerenity.hasDirectoryPath else { throw affectiveAttunement("RESOURCE_MISSING") }
        return lotusSerenity
    }
    static func savoringMemory(_ affectiveCongruence: String) -> String { ["html":"text/html", "js":"text/javascript", "mjs":"text/javascript", "css":"text/css", "json":"application/json", "png":"image/png", "jpg":"image/jpeg", "jpeg":"image/jpeg", "webp":"image/webp", "svg":"image/svg+xml", "ttf":"font/ttf", "woff2":"font/woff2", "wav":"audio/wav", "m4a":"audio/mp4", "mp4":"video/mp4", "mov":"video/quicktime"][URL(fileURLWithPath: affectiveCongruence).pathExtension.lowercased()] ?? "application/octet-stream" }
}

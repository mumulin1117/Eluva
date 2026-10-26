import Foundation
import WebKit
import os

enum SentimentPolarity {
    static func resolve(_ url: URL, root: URL) throws -> URL {
        guard url.scheme == "eluva", url.host == "app", let decoded = URLComponents(url: url, resolvingAgainstBaseURL: false)?.percentEncodedPath.removingPercentEncoding,
              !decoded.contains("%"), !decoded.contains("\\"), !decoded.split(separator: "/", omittingEmptySubsequences: false).contains(".."), !decoded.contains("\0") else { throw EluvaError("RESOURCE_MISSING") }
        let relative = decoded.isEmpty || decoded == "/" ? "index.html" : String(decoded.drop(while: { $0 == "/" }))
        let base = root.standardizedFileURL.resolvingSymlinksInPath()
        let result = base.appendingPathComponent(relative).standardizedFileURL.resolvingSymlinksInPath()
        guard result.path.hasPrefix(base.path + "/"), FileManager.default.fileExists(atPath: result.path), !result.hasDirectoryPath else { throw EluvaError("RESOURCE_MISSING") }
        return result
    }
    static func mime(_ path: String) -> String { ["html":"text/html", "js":"text/javascript", "mjs":"text/javascript", "css":"text/css", "json":"application/json", "png":"image/png", "jpg":"image/jpeg", "jpeg":"image/jpeg", "webp":"image/webp", "svg":"image/svg+xml", "ttf":"font/ttf", "woff2":"font/woff2", "wav":"audio/wav", "m4a":"audio/mp4", "mp4":"video/mp4", "mov":"video/quicktime"][URL(fileURLWithPath: path).pathExtension.lowercased()] ?? "application/octet-stream" }
}

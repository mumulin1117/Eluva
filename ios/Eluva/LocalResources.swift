import Foundation
import WebKit
import os

enum LocalResources {
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

final class LocalResourceHandler: NSObject, WKURLSchemeHandler {
    let repository: LocalRepository
    private let lock = NSLock()
    private var active = Set<ObjectIdentifier>()
    private let log = Logger(subsystem: "com.eluva.local", category: "resources")
    init(repository: LocalRepository) { self.repository = repository }
    private func isActive(_ id: ObjectIdentifier) -> Bool { lock.lock(); defer { lock.unlock() }; return active.contains(id) }
    private func remove(_ id: ObjectIdentifier) { lock.lock(); active.remove(id); lock.unlock() }
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let id = ObjectIdentifier(urlSchemeTask as AnyObject); lock.lock(); active.insert(id); lock.unlock()
      
        repository.queue.async { [weak self] in
            guard let self, self.isActive(id), let url = urlSchemeTask.request.url else { return }
            do {
                let file: URL
                if url.scheme == "eluva" && url.host == "media" {
                    let path = String(url.path.dropFirst()); try require(!path.contains("/") && UUID(uuidString: path) != nil, "MEDIA_MISSING"); file = try self.repository.mediaURL(path)
                } else {
                    guard let root = Bundle.main.resourceURL?.appendingPathComponent("Web") else { throw EluvaError("RESOURCE_MISSING") }
                    file = try LocalResources.resolve(url, root: root)
                }
                try require(["GET", "HEAD"].contains(urlSchemeTask.request.httpMethod ?? "GET"), "INVALID_ARGUMENT")
                let data = try Data(contentsOf: file, options: .mappedIfSafe)
                var headers = ["Content-Type": LocalResources.mime(file.path), "Content-Length": String(data.count), "Cache-Control": "no-cache", "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff"]
                // WebKit gives a custom scheme an opaque origin. ES modules and font
                // preloads require CORS even though every app resource is bundled.
                // These headers apply only to public bundle assets, never user media.
                if url.host == "app" { headers["Access-Control-Allow-Origin"] = "*" }
                var body = data, status = 200
                if let range = urlSchemeTask.request.value(forHTTPHeaderField: "Range"), range.hasPrefix("bytes="), !data.isEmpty {
                    let parts = range.dropFirst(6).split(separator: "-", omittingEmptySubsequences: false)
                    if parts.count == 2, let lower = Int(parts[0]), lower >= 0, lower < data.count {
                        let upper = min(Int(parts[1]) ?? data.count-1, data.count-1)
                        if upper >= lower { body = data.subdata(in: lower..<(upper+1)); status = 206; headers["Content-Range"] = "bytes \(lower)-\(upper)/\(data.count)"; headers["Content-Length"] = String(body.count) }
                    }
                }
                guard let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) else { self.remove(id); return }
                let payload = body
                // Serialize completion with WebKit's main-thread stop callback.
                // A cancellation cannot slip between the active check and delivery.
                DispatchQueue.main.async {
                    guard self.isActive(id) else { return }
                    urlSchemeTask.didReceive(response)
                    if self.isActive(id), urlSchemeTask.request.httpMethod != "HEAD" { urlSchemeTask.didReceive(payload) }
                    if self.isActive(id) { urlSchemeTask.didFinish() }; self.remove(id)
                }
            } catch {
                log.error("Local resource failure: \((error as? EluvaError)?.code ?? "RESOURCE_MISSING", privacy: .public)")
                DispatchQueue.main.async { if self.isActive(id) { urlSchemeTask.didFailWithError(error) }; self.remove(id) }
            }
        }
    }
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) { remove(ObjectIdentifier(urlSchemeTask as AnyObject)) }
}

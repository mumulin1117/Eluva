import Foundation
import CryptoKit
import Compression
import os


final class EncryptedWebResources: @unchecked Sendable {
    static let shared = EncryptedWebResources()
    private let lock = NSLock()
    private var readyRoot: URL?
    private let fm = FileManager.default
    private let log = Logger(subsystem: "com.eluva.app", category: "resource-package")
    private let maxArchiveBytes = 512 * 1024 * 1024
    private struct Manifest: Decodable { let version: Int; let files: [Entry] }
    private struct Entry: Decodable { let file: String; let bytes: Int; let sha256: String }
    private enum PackageError: Error { case invalid, missing }
    private init() {}

    /// Call on the repository queue before starting StoreKit or navigating WebKit.
    @discardableResult func prepare() throws -> URL {
        lock.lock(); defer { lock.unlock() }
       
        readyRoot = nil
        let started = Date()
        guard let package = Bundle.main.url(forResource: "resources", withExtension: "eluva", subdirectory: "PerceptualEluOpenness") else { throw PackageError.missing }
        let packageBytes = try fileSize(package)
        guard packageBytes >= 72, packageBytes <= 256 * 1024 * 1024,
              try digest(package) == ResourcePackageKey.packageSHA256 else { throw PackageError.invalid }
        let caches = fm.urls(for: .cachesDirectory, in: .userDomainMask)[0].standardizedFileURL.resolvingSymlinksInPath()
        let parent = caches.appendingPathComponent("PerceptualEluOpenness", isDirectory: true)
        if fm.fileExists(atPath: parent.path), try parent.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink == true { throw PackageError.invalid }
        try fm.createDirectory(at: parent, withIntermediateDirectories: true)
        let destination = parent.appendingPathComponent(ResourcePackageKey.packageSHA256, isDirectory: true)
        if validCache(destination) {
            readyRoot = destination
            log.info("Verified cached H5 resources in \(Date().timeIntervalSince(started), privacy: .public)s")
            return destination
        }
        let staging = parent.appendingPathComponent("unpack-" + UUID().uuidString, isDirectory: true)
        try fm.createDirectory(at: staging, withIntermediateDirectories: false)
        defer { try? fm.removeItem(at: staging) }
        let archive = staging.appendingPathComponent("archive.bin")
        // Each GCM layer authenticates the header and its own layer number before
        // any decompression or filesystem path from the archive is processed.
        try autoreleasepool {
            let compressed = try open(package)
            try inflate(compressed, to: archive)
        }
        let extracted = staging.appendingPathComponent("contents", isDirectory: true)
        try fm.createDirectory(at: extracted, withIntermediateDirectories: false)
        try extract(archive, to: extracted)
        if fm.fileExists(atPath: destination.path) { try fm.removeItem(at: destination) }
        try fm.moveItem(at: extracted, to: destination)
        var excluded = destination
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try excluded.setResourceValues(values)
        readyRoot = destination
        // Remove only obsolete generated cache generations, never user storage.
        for old in (try? fm.contentsOfDirectory(at: parent, includingPropertiesForKeys: nil)) ?? [] where old != destination && old != staging {
            let name = old.lastPathComponent
            if name.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil || name.hasPrefix("unpack-") { try? fm.removeItem(at: old) }
        }
        log.info("Decrypted and verified H5 resources in \(Date().timeIntervalSince(started), privacy: .public)s")
        return destination
    }

    var root: URL? { lock.lock(); defer { lock.unlock() }; return readyRoot }

    /// Native configuration and bundled media use the same verified generation as H5.
    func url(forResource name: String, withExtension ext: String, subdirectory: String) -> URL? {
        guard let root else { return nil }
        let path = subdirectory + "/" + name + "." + ext
        guard safePath(path) else { return nil }
        let result = root.appendingPathComponent(path).resolvingSymlinksInPath()
        guard result.path.hasPrefix(root.path + "/"), fm.fileExists(atPath: result.path) else { return nil }
        return result
    }

    private func open(_ url: URL) throws -> Data {
        let package = try Data(contentsOf: url, options: .mappedIfSafe)
        let header = Data(package.prefix(16))
        guard header.prefix(8) == Data("ELUVA001".utf8),
              integer(header.suffix(8)) == ResourcePackageKey.archiveBytes,
              ResourcePackageKey.archiveBytes > 4, ResourcePackageKey.archiveBytes <= maxArchiveBytes else { throw PackageError.invalid }
        func decrypt(_ data: Data, secret: String, layer: UInt8) throws -> Data {
            let key = SymmetricKey(data: SHA256.hash(data: Data(secret.utf8)))
            let box = try AES.GCM.SealedBox(combined: data)
            return try AES.GCM.open(box, using: key, authenticating: header + Data([layer]))
        }
        let inner = try decrypt(Data(package.dropFirst(16)), secret: ResourcePackageKey.outer, layer: 2)
        return try decrypt(inner, secret: ResourcePackageKey.inner, layer: 1)
    }

    private func inflate(_ compressed: Data, to url: URL) throws {
        guard fm.createFile(atPath: url.path, contents: nil) else { throw PackageError.invalid }
        let file = try FileHandle(forWritingTo: url); defer { try? file.close() }
        let capacity = 256 * 1024
        let output = UnsafeMutablePointer<UInt8>.allocate(capacity: capacity); defer { output.deallocate() }
        // Raw DEFLATE matches Node's deflateRaw and Apple's COMPRESSION_ZLIB.
        var stream = compression_stream(dst_ptr: output, dst_size: capacity, src_ptr: output, src_size: 0, state: nil)
        guard compression_stream_init(&stream, COMPRESSION_STREAM_DECODE, COMPRESSION_ZLIB) != COMPRESSION_STATUS_ERROR else { throw PackageError.invalid }
        defer { compression_stream_destroy(&stream) }
        try compressed.withUnsafeBytes { (bytes: UnsafeRawBufferPointer) in
            guard let input = bytes.bindMemory(to: UInt8.self).baseAddress else { throw PackageError.invalid }
            stream.src_ptr = input; stream.src_size = compressed.count
            var total = 0
            while true {
                stream.dst_ptr = output; stream.dst_size = capacity
                let remaining = stream.src_size
                let status = compression_stream_process(&stream, Int32(COMPRESSION_STREAM_FINALIZE.rawValue))
                let produced = capacity - stream.dst_size
                guard produced <= ResourcePackageKey.archiveBytes - total else { throw PackageError.invalid }
                if produced > 0 { try file.write(contentsOf: Data(bytes: output, count: produced)); total += produced }
                if status == COMPRESSION_STATUS_END {
                    guard total == ResourcePackageKey.archiveBytes, stream.src_size == 0 else { throw PackageError.invalid }
                    break
                }
                guard status == COMPRESSION_STATUS_OK, produced > 0 || stream.src_size < remaining else { throw PackageError.invalid }
            }
        }
    }

    private func extract(_ archive: URL, to root: URL) throws {
        let handle = try FileHandle(forReadingFrom: archive); defer { try? handle.close() }
        guard let prefix = try handle.read(upToCount: 4), prefix.count == 4 else { throw PackageError.invalid }
        let length = integer(prefix)
        guard length > 0, length <= 4 * 1024 * 1024,
              let data = try handle.read(upToCount: length), data.count == length else { throw PackageError.invalid }
        let manifest = try checkedManifest(data)
        guard 4 + length + manifest.files.reduce(0, { $0 + $1.bytes }) == ResourcePackageKey.archiveBytes else { throw PackageError.invalid }
        for entry in manifest.files {
            let target = root.appendingPathComponent(entry.file)
            try fm.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
            guard fm.createFile(atPath: target.path, contents: nil) else { throw PackageError.invalid }
            let output = try FileHandle(forWritingTo: target)
            do {
                var remaining = entry.bytes, hash = SHA256()
                while remaining > 0 {
                    guard let chunk = try handle.read(upToCount: min(remaining, 1024 * 1024)), !chunk.isEmpty else { throw PackageError.invalid }
                    hash.update(data: chunk); try output.write(contentsOf: chunk); remaining -= chunk.count
                }
                guard hex(hash.finalize()) == entry.sha256 else { throw PackageError.invalid }
                try output.close()
            } catch { try? output.close(); throw error }
        }
        guard (try handle.read(upToCount: 1))?.isEmpty != false else { throw PackageError.invalid }
        try data.write(to: root.appendingPathComponent(".package-manifest.json"), options: .atomic)
    }

    private func checkedManifest(_ data: Data) throws -> Manifest {
        guard data.count <= 4 * 1024 * 1024, hex(SHA256.hash(data: data)) == ResourcePackageKey.manifestSHA256 else { throw PackageError.invalid }
        let manifest = try JSONDecoder().decode(Manifest.self, from: data)
        guard manifest.version == 1, !manifest.files.isEmpty, manifest.files.count <= 10000 else { throw PackageError.invalid }
        var names = Set<String>(), total = 0
        for entry in manifest.files {
            guard safePath(entry.file), entry.file != ".package-manifest.json",
                  names.insert(entry.file.lowercased()).inserted,
                  entry.bytes >= 0, entry.bytes <= maxArchiveBytes - total,
                  entry.sha256.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { throw PackageError.invalid }
            total += entry.bytes
        }
        guard names.contains("index.html") else { throw PackageError.invalid }
        return manifest
    }

    private func validCache(_ root: URL) -> Bool {
        do {
            guard try root.resourceValues(forKeys: [.isSymbolicLinkKey, .isDirectoryKey]).isSymbolicLink == false else { return false }
            let manifestURL = root.appendingPathComponent(".package-manifest.json")
            guard try fileSize(manifestURL) <= 4 * 1024 * 1024 else { return false }
            let manifest = try checkedManifest(Data(contentsOf: manifestURL))
            for entry in manifest.files {
                let url = root.appendingPathComponent(entry.file)
                guard url.resolvingSymlinksInPath().path == url.path,
                      try fileSize(url) == entry.bytes, try digest(url) == entry.sha256 else { return false }
            }
            // A cache must not contain additional injectable scripts or symlinks.
            let expected = Set(manifest.files.map(\.file) + [".package-manifest.json"])
            guard let walker = fm.enumerator(at: root, includingPropertiesForKeys: [.isRegularFileKey, .isSymbolicLinkKey]) else { return false }
            var actual = Set<String>()
            for case let url as URL in walker {
                let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
                guard values.isSymbolicLink != true else { return false }
                if values.isRegularFile == true { actual.insert(String(url.path.dropFirst(root.path.count + 1))) }
            }
            return actual == expected
        } catch { return false }
    }

    private func safePath(_ path: String) -> Bool {
        !path.isEmpty && !path.hasPrefix("/") && !path.contains("\\") && !path.contains("\0") && !path.contains("%") &&
        path.split(separator: "/", omittingEmptySubsequences: false).allSatisfy { !$0.isEmpty && $0 != "." && $0 != ".." }
    }
    private func integer<T: DataProtocol>(_ bytes: T) -> Int { bytes.reduce(0) { ($0 << 8) | Int($1) } }
    private func hex<T: Sequence>(_ bytes: T) -> String where T.Element == UInt8 { bytes.map { String(format: "%02x", $0) }.joined() }
    private func fileSize(_ url: URL) throws -> Int {
        let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey])
        guard values.isRegularFile == true, values.isSymbolicLink != true, let size = values.fileSize else { throw PackageError.invalid }
        return size
    }
    private func digest(_ url: URL) throws -> String {
        let file = try FileHandle(forReadingFrom: url); defer { try? file.close() }
        var hash = SHA256()
        while let chunk = try file.read(upToCount: 1024 * 1024), !chunk.isEmpty { hash.update(data: chunk) }
        return hex(hash.finalize())
    }
}

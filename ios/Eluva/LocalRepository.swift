import Foundation
import CryptoKit
import Security
import CommonCrypto
import ImageIO
import UniformTypeIdentifiers
import os

typealias JSONObject = [String: Any]
struct EluvaError: Error { let code: String; init(_ code: String) { self.code = code } }
func require(_ condition: @autoclosure () -> Bool, _ code: String) throws { if !condition() { throw EluvaError(code) } }

// Mutable account state is confined to `queue`; startup UI preferences use thread-safe UserDefaults.
final class LocalRepository: @unchecked Sendable {
    static let legalVersion = "local-preview-2026-10-17"
    static let testID = "eluva-test-user-v1"
    let queue = DispatchQueue(label: "com.eluva.repository", qos: .userInitiated)
    let root: URL
    private let preferences = UserDefaults.standard
    var snapshot: JSONObject?
    private var key: SymmetricKey?
    private var flows: [String: Flow] = [:]
    var staging: [String: (flow: String, url: URL)] = [:]
    var contentDrafts: [String: String] = [:]
    var stagedKinds: [String: String] = [:]
    var socialDrafts: [String:(owner:String,peer:String)] = [:]
    var profileMediaGrants: [String:Set<String>] = [:]
    var callLeases = Set<String>()
    private struct Flow { var purpose: String; var email: String; var password: String; var userID: String?; var verified: Bool; var version: String? = nil }

    init() {
        self.root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Eluva", isDirectory: true)
    }
    static func language(_ preferred: [String], saved: String?) -> String {
        if let saved, ["en", "fr"].contains(saved) { return saved }
        for code in preferred { let base = code.lowercased().replacingOccurrences(of: "_", with: "-").split(separator: "-").first.map(String.init) ?? ""; if ["en", "fr"].contains(base) { return base } }
        return "en"
    }
    var bootLocale: String { Self.language(Locale.preferredLanguages, saved: preferences.string(forKey: "eluva.locale")) }
    // Installation-scoped presentation only; this never changes the encrypted account vault.
    var welcomeRelaySeen: Bool { preferences.bool(forKey: "eluva.welcomeRelaySeen.v1") }
    func markWelcomeRelaySeen() { preferences.set(true, forKey: "eluva.welcomeRelaySeen.v1") }
    func object(_ value: Any?) -> JSONObject { value as? JSONObject ?? [:] }
    func array(_ value: Any?) -> [JSONObject] { value as? [JSONObject] ?? [] }
    private func email(_ text: String) -> String { text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
    private func validEmail(_ value: String) -> Bool { value.count <= 254 && value.range(of: #"^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$"#, options: .regularExpression) != nil }
    private func validPassword(_ value: String) -> Bool { value.count >= 8 && value.utf8.contains(where: { $0 >= 48 && $0 <= 57 }) }
    private func credentials(_ value: String, _ password: String) throws { try require(validEmail(value), "INVALID_EMAIL"); try require(validPassword(password), "WEAK_PASSWORD") }
    private func account(_ state: JSONObject, email value: String) -> JSONObject? { object(state["accounts"]).values.compactMap { $0 as? JSONObject }.first { $0["email"] as? String == email(value) } }
    private func publicUser(_ account: JSONObject?) -> Any { guard let account else { return NSNull() }; return ["id": account["id"]!, "email": account["email"]!, "profile": account["profile"] ?? [:], "isTest": account["isTest"] ?? false,"registrationVersion":object(account["onboarding"])["version"] ?? NSNull()] as JSONObject }
    func currentUser(_ state: JSONObject) -> JSONObject? { guard let id = object(state["session"])["userId"] as? String else { return nil }; return object(state["accounts"])[id] as? JSONObject }
    private func flow(_ id: String, purpose: String) throws -> Flow { guard let flow = flows[id], flow.purpose == purpose else { throw EluvaError("FLOW_EXPIRED") }; return flow }
    private func keychainKey(installID: String) throws -> SymmetricKey {
        let query: JSONObject = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "com.eluva.local.vault", kSecAttrAccount as String: installID]
        var find = query; find[kSecReturnData as String] = true; find[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(find as CFDictionary, &result)
        if status == errSecSuccess, let data = result as? Data, data.count == 32 { return SymmetricKey(data: data) }
        try require(status == errSecItemNotFound, "STORAGE_UNAVAILABLE")
        try require(status == errSecItemNotFound && !FileManager.default.fileExists(atPath: root.appendingPathComponent("accounts.vault").path), "STORAGE_CORRUPT")
        let generated = SymmetricKey(size: .bits256), data = generated.withUnsafeBytes { Data($0) }
        var add = query; add[kSecValueData as String] = data; add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        try require(SecItemAdd(add as CFDictionary, nil) == errSecSuccess, "STORAGE_FAILED")
        return generated
    }
    func prepare() throws {
        if snapshot != nil { return }
        do {
            try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
            let installID = preferences.string(forKey: "eluva.installID") ?? UUID().uuidString.lowercased()
            preferences.set(installID, forKey: "eluva.installID")
        
            key = try keychainKey(installID: installID)
           
            let url = root.appendingPathComponent("accounts.vault")
            if FileManager.default.fileExists(atPath: url.path) {
                let box = try AES.GCM.SealedBox(combined: Data(contentsOf: url))
                let data = try AES.GCM.open(box, using: key!)
                guard let saved = try JSONSerialization.jsonObject(with: data) as? JSONObject,
                      saved["version"] as? Int == 1, saved["accounts"] is JSONObject, saved["preferences"] is JSONObject, saved["commits"] is JSONObject else { throw EluvaError("STORAGE_CORRUPT") }
                if let raw=saved["content"] {guard let content=raw as? JSONObject,content["version"] as? Int==1,["posts","comments","echoes","events","collections","operations","preferences","hidden","blocks","reports","quota","files"].allSatisfy({content[$0] is JSONObject})else{throw EluvaError("STORAGE_CORRUPT")}}
                var checked=saved;try upgradePresentation(&checked);try upgradeSuppliedDemoContent(&checked);upgradeContentSafety(&checked);if saved["commerce"] != nil {try ensureCommerce(&checked)};if saved["personal"] != nil {try ensurePersonal(&checked)};if saved["social"] != nil {try ensureSocial(&checked)};if saved["realtime"] != nil {try ensureRealtime(&checked)}
                if try JSONSerialization.data(withJSONObject:checked,options:[.sortedKeys]) != JSONSerialization.data(withJSONObject:saved,options:[.sortedKeys]){try persist(checked)}else{snapshot=checked}
            } else {
                let test: JSONObject = ["id": Self.testID, "email": "eluva@gmail.com", "credential": try hash("123qweasd"), "isTest": true,
                  "profile": ["displayName": "Eluva Demo", "birthday": "2000-01-01", "photos": [], "about": "", "interestIds": [], "goalIds": [], "icebreakerIds": []]]
                var initial: JSONObject = ["version": 1, "installId": installID, "accounts": [Self.testID: test], "preferences": ["locale": bootLocale, "eulaConsent": false, "eulaVersion": Self.legalVersion], "commits": [:], "session": NSNull(), "fixtures": [Self.testID: Self.fixtures()]]
                try upgradePresentation(&initial);try persist(initial)
            }
            // Only unreferenced files from an earlier process are removed; account data is never cleared.
            let temporary = root.appendingPathComponent("Staging", isDirectory: true)
            if FileManager.default.fileExists(atPath: temporary.path) { try? FileManager.default.removeItem(at: temporary) }
            try FileManager.default.createDirectory(at: temporary, withIntermediateDirectories: true)
            try FileManager.default.createDirectory(at: root.appendingPathComponent("Media"), withIntermediateDirectories: true)
            pruneOrphanMedia()
        } catch let error as EluvaError { throw error }
        catch { throw EluvaError(FileManager.default.fileExists(atPath: root.appendingPathComponent("accounts.vault").path) ? "STORAGE_CORRUPT" : "STORAGE_FAILED") }
    }
    func persist(_ next: JSONObject) throws {
        do {
            let data = try JSONSerialization.data(withJSONObject: next, options: [.sortedKeys])
            let encrypted = try AES.GCM.seal(data, using: key!).combined!
            let url = root.appendingPathComponent("accounts.vault")
            try encrypted.write(to: url, options: [.atomic, .completeFileProtection])
            snapshot = next // Publish only after the durable atomic replacement succeeds.
        } catch let error as EluvaError { throw error }
        catch { throw EluvaError("STORAGE_FAILED") }
    }
    private func hash(_ password: String, salt: Data? = nil) throws -> JSONObject {
        var bytes = [UInt8](repeating: 0, count: 16)
        if salt == nil { try require(SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess, "STORAGE_FAILED") }
        let saltData = salt ?? Data(bytes)
        var derived = [UInt8](repeating: 0, count: 32)
        let status = password.withCString { pointer in saltData.withUnsafeBytes { buffer in
            CCKeyDerivationPBKDF(CCPBKDFAlgorithm(kCCPBKDF2), pointer, password.utf8.count, buffer.bindMemory(to: UInt8.self).baseAddress, saltData.count, CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256), 120000, &derived, 32)
        } }
        try require(status == kCCSuccess, "STORAGE_FAILED")
        return ["salt": saltData.base64EncodedString(), "hash": Data(derived).base64EncodedString(), "iterations": 120000]
    }
    private func equal(_ a: String, _ b: String) -> Bool { let x = Array(a.utf8), y = Array(b.utf8); var diff = x.count ^ y.count; for i in 0..<max(x.count,y.count) { diff |= Int((i < x.count ? x[i] : 0) ^ (i < y.count ? y[i] : 0)) }; return diff == 0 }
    static func age(_ birthday: String, today: Date = Date()) -> Int? {
        guard birthday.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil else { return nil }
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = .current
        let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.calendar = calendar; formatter.dateFormat = "yyyy-MM-dd"; formatter.isLenient = false; formatter.timeZone = .current
        guard let date = formatter.date(from: birthday), formatter.string(from: date) == birthday, date <= calendar.startOfDay(for: today), calendar.component(.year, from: date) >= 1900 else { return nil }
        let birth = calendar.dateComponents([.year,.month,.day], from: date), current = calendar.dateComponents([.year,.month,.day], from: today)
        let beforeBirthday = current.month! < birth.month! || (current.month == birth.month && current.day! < birth.day!)
        return current.year! - birth.year! - (beforeBirthday ? 1 : 0)
    }
    private func choiceIDs() throws -> [String: Set<String>] {
        guard let url = EncryptedWebResources.shared.url(forResource: "choices", withExtension: "json", subdirectory: "config"), let value = try? JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: [JSONObject]] else { throw EluvaError("RESOURCE_MISSING") }
        return value.mapValues { Set($0.compactMap { $0["id"] as? String }) }
    }
    func validateProfile(_ raw: JSONObject, existing: JSONObject? = nil, sparse: Bool = false) throws -> JSONObject {
        let name = (raw["displayName"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        try require(!name.isEmpty && name.count <= 60, "INVALID_NAME")
        guard let age = Self.age(raw["birthday"] as? String ?? "") else { throw EluvaError("INVALID_BIRTHDAY") }
        try require(age >= 18, "AGE_RESTRICTED")
        let photos = array(raw["photos"]), ids = photos.compactMap { $0["id"] as? String }
        try require(ids.count == photos.count && (sparse || ids.count >= 2 || ids == array(existing?["photos"]).compactMap{$0["id"] as? String} && existing != nil) && Set(ids).count == ids.count, "PHOTOS_REQUIRED")
        let choices = try choiceIDs()
        let interests = raw["interestIds"] as? [String] ?? [], ice = raw["icebreakerIds"] as? [String] ?? [], goals = raw["goalIds"] as? [String] ?? []
        try require((sparse || Set(interests).count >= 3 || existing != nil && interests == existing?["interestIds"] as? [String]) && interests.allSatisfy { choices["interests"]?.contains($0) == true }, "INTERESTS_REQUIRED")
        try require((sparse || ice.count == 3 || existing != nil && ice == existing?["icebreakerIds"] as? [String]) && Set(ice).count == ice.count && ice.allSatisfy { choices["icebreakers"]?.contains($0) == true }, "ICEBREAKERS_REQUIRED")
        try require(goals.allSatisfy { choices["goals"]?.contains($0) == true }, "INVALID_PROFILE")
        let about = raw["about"] as? String ?? ""; try require(about.count <= 300, "ABOUT_TOO_LONG")
        for (field, group) in [("gender","genders"),("year","years"),("major","majors")] {
            let value = raw[field] as? String ?? ""
            try require(value.isEmpty || choices[group]?.contains(value) == true, "INVALID_PROFILE")
        }
        for (field, maximum) in [("pronouns",60),("university",120),("otherMajor",120)] { try require((raw[field] as? String ?? "").count <= maximum, "INVALID_PROFILE") }
        let notification = raw["notificationChoice"] as? String ?? ""
        try require(notification.isEmpty || ["notNow","notDetermined","authorized","provisional","ephemeral","denied","unsupported"].contains(notification), "INVALID_PROFILE")
        var profile: JSONObject = ["displayName": name, "birthday": raw["birthday"]!, "photos": ids.map { ["id": $0] }, "interestIds": interests, "goalIds": goals, "icebreakerIds": ice, "about": about, "communityVersion": Self.legalVersion]
        for field in ["gender", "pronouns", "university", "year", "major", "otherMajor", "notificationChoice"] { profile[field] = raw[field] as? String ?? "" }
        return profile
    }
    func validateConversationOnboarding(_ raw:JSONObject)throws->JSONObject {
        guard let url=EncryptedWebResources.shared.url(forResource:"auth-conversation",withExtension:"json",subdirectory:"config"),let data=try? Data(contentsOf:url),let policy=try? JSONSerialization.jsonObject(with:data) as? JSONObject else{throw EluvaError("RESOURCE_MISSING")}
        try require(raw["version"] as? String==policy["version"] as? String,"INVALID_PROFILE")
        let theme=raw["theme"] as? String ?? "";try require((policy["themes"] as? [String] ?? []).contains(theme),"INVALID_PROFILE")
        let rows=array(raw["answers"]),questions=array(policy["questions"]);try require(rows.count==questions.count && questions.count==10,"INVALID_PROFILE")
        var answers=[JSONObject]()
        for (i,q) in questions.enumerated(){let a=rows[i],status=a["status"] as? String ?? "";try require(a["questionId"] as? String==q["id"] as? String && ["answered","skipped","timeout"].contains(status),"INVALID_PROFILE")
            guard let elapsed=a["elapsedMs"] as? NSNumber else{throw EluvaError("INVALID_PROFILE")};let ms=elapsed.doubleValue;try require(ms.isFinite && ms>=0 && ms<=60000,"INVALID_PROFILE")
            if status=="answered"{try require((q["optionIds"] as? [String] ?? []).contains(a["optionId"] as? String ?? ""),"INVALID_PROFILE")}else{try require(a["optionId"] is NSNull,"INVALID_PROFILE")}
            answers.append(["questionId":q["id"]!,"status":status,"optionId":a["optionId"] ?? NSNull(),"elapsedMs":Int(ms.rounded())])
        }
        return ["version":policy["version"]!,"theme":theme,"answers":answers]
    }
    func execute(service: String, method: String, params: JSONObject) throws -> JSONObject {
        try prepare(); var next = snapshot!
        if service == "content" { return try executeContent(method, params: params) }
        if service == "social" { return try executeSocial(method, params: params) }
        if service == "commerce" { return try executeCommerce(method, params: params) }
        if service == "personal" { return try executePersonal(method, params: params) }
        if service == "realtime" { return try executeRealtime(method, params: params) }
        let value = { (key: String) in params[key] as? String ?? "" }
        switch service + "." + method {
        case "app.bootstrap":
            let prefs = object(next["preferences"]), user = currentUser(next)
            return ["theme":object(object(object(next["personal"])["preferences"])[user?["id"] as? String ?? ""])["theme"] ?? "purple","locale": prefs["locale"] ?? bootLocale, "eulaConsent": prefs["eulaConsent"] as? Bool == true && prefs["eulaVersion"] as? String == Self.legalVersion, "user": publicUser(user), "session": user != nil ? next["session"] ?? NSNull() : NSNull(), "environment": "ios", "fixtures": user.flatMap { object(next["fixtures"])[$0["id"] as? String ?? ""] } ?? ["threads": [], "friends": [], "requests": []]]
        case "preferences.locale":
            try require(["en", "fr"].contains(value("locale")), "INVALID_ARGUMENT")
            var prefs = object(next["preferences"]); prefs["locale"] = value("locale"); next["preferences"] = prefs; try persist(next); preferences.set(value("locale"), forKey: "eluva.locale")
            return ["locale": value("locale")]
        case "preferences.consent":
            try require(params["accepted"] is Bool && value("version") == Self.legalVersion, "INVALID_ARGUMENT")
            var prefs = object(next["preferences"]); prefs["eulaConsent"] = params["accepted"]; prefs["eulaVersion"] = Self.legalVersion; next["preferences"] = prefs; try persist(next); return ["accepted": params["accepted"]!]
        case "auth.checkEmail":
            let address = email(value("email")); try require(validEmail(address), "INVALID_EMAIL"); try require(account(next, email: address) == nil, "ACCOUNT_EXISTS"); return ["email": address]
        case "auth.beginRegistration":
            let version=value("version");try require(version.isEmpty || version=="lanhu-conversation-v1","INVALID_ARGUMENT")
            let address = email(value("email"));if version.isEmpty{try credentials(address,value("password"))}else{try require(validEmail(address),"INVALID_EMAIL")}; try require(object(next["preferences"])["eulaConsent"] as? Bool == true, "CONSENT_REQUIRED"); try require(account(next, email: address) == nil, "ACCOUNT_EXISTS")
            let previous = flows[value("flowId")]; try require(previous == nil || previous?.purpose == "signup", "INVALID_ARGUMENT")
            let id = previous != nil ? value("flowId") : UUID().uuidString.lowercased()
            flows[id] = Flow(purpose: "signup", email: address, password: version.isEmpty ? value("password") : "", userID: nil, verified: previous?.verified == true && previous?.email == address,version:version.isEmpty ? nil:version)
            return ["flowId": id, "email": address]
        case "auth.setRegistrationPassword":
            let id=value("flowId");var item=try flow(id,purpose:"signup");try require(item.version=="lanhu-conversation-v1","INVALID_ARGUMENT");try require(item.verified,"VERIFICATION_REQUIRED");try credentials(item.email,value("password"));item.password=value("password");flows[id]=item;return ["saved":true]
        case "auth.startVerification":
            let id = value("flowId"); var item = try flow(id, purpose: "signup"); let address = email(value("email"))
            try require(validEmail(address), "INVALID_EMAIL"); try require(account(next, email: address) == nil, "ACCOUNT_EXISTS")
            if item.email != address { item.verified = false }; item.email = address; flows[id] = item; return ["simulation": true, "codeLength": 6]
        case "auth.verify":
            let id = value("flowId"); try require(["signup", "reset"].contains(value("purpose")), "INVALID_ARGUMENT"); var item = try flow(id, purpose: value("purpose"))
            try require(value("code") == "567567", "INVALID_VERIFICATION_CODE"); item.verified = true; flows[id] = item; return ["verified": true, "email": item.email, "simulation": true]
        case "auth.resend": _ = try flow(value("flowId"), purpose: value("purpose")); return ["simulation": true, "codeLength": 6]
        case "auth.beginReset":
            let address = email(value("email")); try require(validEmail(address), "INVALID_EMAIL")
            guard let user = account(next, email: address) else { throw EluvaError("ACCOUNT_NOT_FOUND") }; try require(user["isTest"] as? Bool != true, "TEST_ACCOUNT_READ_ONLY")
            let id = UUID().uuidString.lowercased(); flows[id] = Flow(purpose: "reset", email: address, password: "", userID: user["id"] as? String, verified: false)
            return ["flowId": id, "email": address, "simulation": true]
        case "auth.cancelReset": flows.removeValue(forKey: value("flowId")); return ["cancelled": true]
        case "auth.resetPassword":
            let item = try flow(value("flowId"), purpose: "reset"); try require(item.verified, "VERIFICATION_REQUIRED"); try credentials(item.email, value("password"))
            var accounts = object(next["accounts"]); guard let id = item.userID, var user = accounts[id] as? JSONObject else { throw EluvaError("ACCOUNT_NOT_FOUND") }; try require(user["isTest"] as? Bool != true, "TEST_ACCOUNT_READ_ONLY")
            user["credential"] = try hash(value("password")); accounts[id] = user; next["accounts"] = accounts
            if object(next["session"])["userId"] as? String == id { next["session"] = NSNull() }; try persist(next); flows.removeValue(forKey: value("flowId")); return ["reset": true]
        case "auth.login":
            try require(object(next["preferences"])["eulaConsent"] as? Bool == true, "CONSENT_REQUIRED")
            let address = email(value("email")); try require(validEmail(address), "INVALID_EMAIL")
            guard let user = account(next, email: address) else { throw EluvaError("ACCOUNT_NOT_FOUND") }
            let stored = object(user["credential"]); guard let salt = Data(base64Encoded: stored["salt"] as? String ?? "") else { throw EluvaError("STORAGE_CORRUPT") }
            let candidate = try hash(value("password"), salt: salt); try require(equal(candidate["hash"] as? String ?? "", stored["hash"] as? String ?? ""), "WRONG_PASSWORD")
            let session: JSONObject = ["userId": user["id"]!, "token": UUID().uuidString.lowercased()]; next["session"] = session; try persist(next)
            return ["theme":object(object(object(next["personal"])["preferences"])[user["id"] as? String ?? ""])["theme"] ?? "purple","user": publicUser(user), "session": session, "fixtures": object(next["fixtures"])[user["id"] as? String ?? ""] ?? ["threads": [], "friends": [], "requests": []]]
        case "auth.logout": next["session"] = NSNull(); try persist(next); flows.removeAll(); callLeases.removeAll(); socialDrafts.removeAll();profileMediaGrants.removeAll();contentDrafts.removeAll(); stagedKinds.removeAll(); removeStaging(); return ["loggedOut": true]
        case "auth.completeRegistration":
            let commit = value("commitId"), flowID = value("flowId"); try require(UUID(uuidString: commit) != nil, "INVALID_ARGUMENT")
            let commits = object(next["commits"])
            if let existing = commits[commit] as? JSONObject { try require(existing["flowId"] as? String == flowID, "COMMIT_CONFLICT");try require(object(next["session"])["userId"] as? String==existing["userId"] as? String,"AUTH_REQUIRED"); return ["user": publicUser(object(next["accounts"])[existing["userId"] as? String ?? ""] as? JSONObject), "session": next["session"] ?? NSNull(), "commitId": commit,"theme":object(object(object(next["personal"])["preferences"])[existing["userId"] as? String ?? ""])["theme"] ?? "purple"] }
            let item = try flow(flowID, purpose: "signup"); try require(item.verified, "VERIFICATION_REQUIRED"); try require(params["communityAccepted"] as? Bool == true && object(next["preferences"])["eulaConsent"] as? Bool == true, "CONSENT_REQUIRED"); try require(account(next, email: item.email) == nil, "ACCOUNT_EXISTS")
            try credentials(item.email,item.password)
            let onboarding:JSONObject?=item.version=="lanhu-conversation-v1" ? try validateConversationOnboarding(object(params["onboarding"])) : nil
            let profile = try validateProfile(object(params["profile"]),sparse:onboarding != nil), id = UUID().uuidString.lowercased()
            var user: JSONObject = ["id": id, "email": item.email, "credential": try hash(item.password), "profile": profile, "isTest": false]
            if let onboarding{user["onboarding"]=onboarding;try ensurePersonal(&next);var p=object(next["personal"]),prefs=object(p["preferences"]);prefs[id]=["theme":onboarding["theme"]!];p["preferences"]=prefs;next["personal"]=p}
            var copied: [URL] = []
            do {
                for photo in array(profile["photos"]) {
                    guard let mediaID = photo["id"] as? String, let staged = staging[mediaID], staged.flow == flowID else { throw EluvaError("MEDIA_MISSING") }
                    let destination = root.appendingPathComponent("Media").appendingPathComponent(mediaID + ".jpg")
                    if FileManager.default.fileExists(atPath: destination.path) { try FileManager.default.removeItem(at: destination) }
                    try FileManager.default.copyItem(at: staged.url, to: destination); copied.append(destination)
                }
                var accounts = object(next["accounts"]); accounts[id] = user; next["accounts"] = accounts
                var commits = commits; commits[commit] = ["userId": id, "flowId": flowID]; next["commits"] = commits
                next["session"] = ["userId": id, "token": UUID().uuidString.lowercased()]; try persist(next)
            } catch { copied.forEach { try? FileManager.default.removeItem(at: $0) }; throw (error as? EluvaError) ?? EluvaError("STORAGE_FAILED") }
            flows.removeValue(forKey: flowID); removeStaging(flowID: flowID)
            return ["user": publicUser(user), "session": next["session"]!, "commitId": commit,"theme":onboarding?["theme"] ?? "purple", "fixtures": ["threads": [], "friends": [], "requests": []]]
        case "auth.cancelRegistration": flows.removeValue(forKey: value("flowId")); removeStaging(flowID: value("flowId")); return ["cancelled": true]
        case "media.resolve": let id = value("id"); _ = try mediaURL(id); return ["id": id, "url": "eluva://media/" + id]
        case "media.remove": let id = value("id"), flowID = value("draftId").isEmpty ? value("flowId") : value("draftId"); try validateMediaFlow(flowID); try require(staging[id]?.flow == flowID, "MEDIA_MISSING"); if let url = staging[id]?.url { try? FileManager.default.removeItem(at: url) }; staging.removeValue(forKey: id); stagedKinds.removeValue(forKey: id); return ["removed": true]
        default: throw EluvaError("METHOD_NOT_FOUND")
        }
    }
    func clearPersonalRuntime(){ flows.removeAll();callLeases.removeAll();socialDrafts.removeAll();profileMediaGrants.removeAll();contentDrafts.removeAll();stagedKinds.removeAll();removeStaging() }
    func validateMediaFlow(_ id: String) throws { try prepare(); if let draft=socialDrafts[id] {try require(currentUser(snapshot!)?["id"] as? String==draft.owner,"DRAFT_EXPIRED");try requireSocialPeer(snapshot!,draft.owner,draft.peer,friend:true);return}; if let owner = contentDrafts[id] { try require(currentUser(snapshot!)?["id"] as? String == owner, "DRAFT_EXPIRED"); return }; let item = try flow(id, purpose: "signup"); try require(item.verified, "VERIFICATION_REQUIRED") }
    func importImage(_ data: Data, flowID: String) throws -> JSONObject {
        try validateMediaFlow(flowID); try require(data.count <= 20 * 1024 * 1024, "MEDIA_TOO_LARGE")
        guard let source = CGImageSourceCreateWithData(data as CFData, nil), let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceThumbnailMaxPixelSize: 1600, kCGImageSourceCreateThumbnailWithTransform: true] as CFDictionary) else { throw EluvaError("MEDIA_UNSUPPORTED") }
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output, UTType.jpeg.identifier as CFString, 1, nil) else { throw EluvaError("MEDIA_UNSUPPORTED") }
        CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.88] as CFDictionary); try require(CGImageDestinationFinalize(destination), "MEDIA_UNSUPPORTED")
        let id = UUID().uuidString.lowercased(), url = root.appendingPathComponent("Staging").appendingPathComponent(id + ".jpg")
        do { try (output as Data).write(to: url, options: [.atomic, .completeFileProtection]) } catch { throw EluvaError("STORAGE_FAILED") }
        staging[id] = (flowID, url); stagedKinds[id] = "image"; return ["id": id, "url": "eluva://media/" + id, "kind": "image"]
    }
    func mediaURL(_ id: String) throws -> URL {
        try prepare(); try require(UUID(uuidString: id) != nil, "MEDIA_MISSING")
        if let temporary = staging[id] { if flows[temporary.flow] != nil {return try checkedMediaFile(temporary.url,folder:"Staging")};if let owner=contentDrafts[temporary.flow], owner == currentUser(snapshot!)?["id"] as? String {return try checkedMediaFile(temporary.url,folder:"Staging")} }
        if let temporary=staging[id],let draft=socialDrafts[temporary.flow] {try require(currentUser(snapshot!)?["id"] as? String==draft.owner,"DRAFT_EXPIRED");try requireSocialPeer(snapshot!,draft.owner,draft.peer,friend:true);return try checkedMediaFile(temporary.url,folder:"Staging")}
        if let contentURL = try contentMediaURL(id) { return contentURL }
        if let profileURL=try socialProfilePhotoURL(id){return profileURL}
        guard let user = currentUser(snapshot!), array(object(user["profile"])["photos"]).contains(where: { $0["id"] as? String == id }) else { throw EluvaError("MEDIA_MISSING") }
        let url = root.appendingPathComponent("Media").appendingPathComponent(id + ".jpg"); return try checkedMediaFile(url,folder:"Media")
    }
    func checkedMediaFile(_ url: URL, folder: String) throws -> URL {
        let baseRoot=root.standardizedFileURL.resolvingSymlinksInPath(),base=root.appendingPathComponent(folder).standardizedFileURL.resolvingSymlinksInPath(),file=url.standardizedFileURL.resolvingSymlinksInPath()
        try require(base.path.hasPrefix(baseRoot.path+"/") && file.path.hasPrefix(base.path+"/") && (try? file.resourceValues(forKeys:[.isRegularFileKey]).isRegularFile)==true,"MEDIA_MISSING");return file
    }
    func removeStaging(flowID: String? = nil) { for (id, value) in staging where flowID == nil || value.flow == flowID { try? FileManager.default.removeItem(at: value.url); staging.removeValue(forKey: id); stagedKinds.removeValue(forKey: id) } }
    private func pruneOrphanMedia() {
        let referenced = Set(object(snapshot?["accounts"]).values.flatMap { array(object(object($0)["profile"])["photos"]).compactMap { $0["id"] as? String } } + Array(object(object(snapshot?["content"])["files"]).keys))
        let files = (try? FileManager.default.contentsOfDirectory(at: root.appendingPathComponent("Media"), includingPropertiesForKeys: nil)) ?? []
        for file in files where !referenced.contains(file.deletingPathExtension().lastPathComponent) { try? FileManager.default.removeItem(at: file) }
    }
    static func fixtures() -> JSONObject {
        let threads: [JSONObject] = ["echo", "notes"].enumerated().map { index, name in ["id": "demo-thread-" + name, "participantId": "demo-friend-" + name, "title": ["en": "Local demo \(index+1)", "fr": "Démo locale \(index+1)"], "messages": [["id": name + "-text", "kind": "text", "body": ["en": "A small hello from the local demo.", "fr": "Un petit bonjour de la démo locale."], "sentByMe": false]]] }
        return ["friends": ["demo-friend-echo", "demo-friend-notes"], "threads": threads, "requests": [["id": "demo-request-in", "direction": "received"], ["id": "demo-request-out", "direction": "sent"]], "scenarios": ["empty": true, "failed": true, "blockedUserId": "demo-blocked-user"]]
    }
}

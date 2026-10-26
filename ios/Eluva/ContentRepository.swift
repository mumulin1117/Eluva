import Foundation
import AVFoundation

extension EmpathyOrientation {
    var contentPolicy: JSONObject {
        guard let url = CognitiveFlexibility.shared.url(forResource: "content-policy", withExtension: "json", subdirectory: "config"), let data = try? Data(contentsOf: url), let policy = try? JSONSerialization.jsonObject(with: data) as? JSONObject else { return ["bodyLimit":2000,"commentLimit":1000,"imageLimit":9,"videoLimit":1,"videoBytes":52428800,"videoSeconds":60,"dailyPublicPosts":NSNull(),"proAudienceEnabled":false] }
        return policy
    }
    func emptyContent() -> JSONObject {
        var posts: JSONObject=[:]
        if let url=CognitiveFlexibility.shared.url(forResource:"content-demo",withExtension:"json",subdirectory:"config"),let data=try? Data(contentsOf:url),let list=try? JSONSerialization.jsonObject(with:data) as? [JSONObject] {for post in list {if let id=post["id"] as? String {posts[id]=post}}}
        return ["version":1,"safetyVersion":1,"fixtureVersion":(try? suppliedDemoConfiguration())?["version"] ?? 0,"posts":posts,"comments":[:],"echoes":[:],"events":[:],"collections":[:],"operations":[:],"preferences":[:],"hidden":[:],"blocks":[:],"reports":[:],"quota":[:],"files":[:]]
    }
    func content(_ state: JSONObject) -> JSONObject { state["content"] as? JSONObject ?? emptyContent() }
    // Preserve legacy hidden records, adding only their account-scoped author
    // block. Explicit blacklist restoration removes that account's old flags.
    func upgradeContentSafety(_ state:inout JSONObject) {
        guard var c=state["content"] as? JSONObject,(c["safetyVersion"] as? Int ?? 0)<1 else{return}
        var blocks=object(c["blocks"]);let hidden=object(c["hidden"]),posts=object(c["posts"]).values.map(object)
        for viewer in object(state["accounts"]).keys {for post in posts {
            guard let id=post["id"] as? String,let author=post["authorId"] as? String,!author.isEmpty,author != viewer,hidden[viewer+":"+id] as? Bool==true else{continue}
            blocks[viewer+":"+author]=true
        }}
        c["blocks"]=blocks;c["safetyVersion"]=1;state["content"]=c
    }
    func setContentAuthorBlock(_ state:inout JSONObject,content c:inout JSONObject,viewer:String,author:String,blocked:Bool) {
        var blocks=object(c["blocks"])
        if blocked {
            blocks[viewer+":"+author]=true
            var realtime=object(state["realtime"]),calls=object(realtime["calls"]);let now=ISO8601DateFormatter().string(from:Date())
            for (id,var call) in calls.mapValues(object) where [call["ownerId"] as? String,call["peerId"] as? String].contains(viewer) && [call["ownerId"] as? String,call["peerId"] as? String].contains(author) && call["state"] as? String != "ended" {call["state"]="ended";call["reason"]="blocked";call["endedAt"]=now;calls[id]=call}
            if !realtime.isEmpty{realtime["calls"]=calls;state["realtime"]=realtime}
        } else {
            blocks.removeValue(forKey:viewer+":"+author);var hidden=object(c["hidden"])
            for post in object(c["posts"]).values.map(object) where post["authorId"] as? String==author {if let id=post["id"] as? String{hidden.removeValue(forKey:viewer+":"+id)}}
            c["hidden"]=hidden
        }
        c["blocks"]=blocks
    }
    func contentOwner(_ state: JSONObject) throws -> String { guard let id = currentUser(state)?["id"] as? String else { throw EluvaError("AUTH_REQUIRED") }; return id }
    func friends(_ state: JSONObject, _ a: String, _ b: String) -> Bool { if state["social"] != nil {let s=object(state["social"]);if s["conversationRulesVersion"] != nil{let f=object(s["follows"]);return f[a+":"+b] != nil && f[b+":"+a] != nil};return object(s["friendships"])[socialPair(a,b)] != nil};return (object(object(state["fixtures"])[a])["friends"] as? [String] ?? []).contains(b) || (object(object(state["fixtures"])[b])["friends"] as? [String] ?? []).contains(a) }
    func canReadPost(_ state: JSONObject, _ post: JSONObject, _ viewer: String, ignoreHidden: Bool = false) -> Bool {
        guard let id=post["id"] as? String, let author=post["authorId"] as? String, post["deletedAt"] == nil else { return false }
        if let scope=post["demoScope"] as? String, scope != viewer { return false }
        let c=content(state), blocks=object(c["blocks"])
        if blocks[viewer+":"+author] as? Bool == true || blocks[author+":"+viewer] as? Bool == true || (!ignoreHidden && object(c["hidden"])[viewer+":"+id] as? Bool == true) { return false }
        if author==viewer { return true }; let v=object(post["visibility"])
        return v["private"] as? Bool != true && (v["audience"] as? String=="everyone" || friends(state,viewer,author))
    }
    func discoveryEligible(_ state:JSONObject,_ post:JSONObject,_ viewer:String)->Bool {
        if post["authorId"] as? String==viewer{return true}
        let gender=object(object(object(state["accounts"])[viewer])["profile"])["gender"] as? String ?? ""
        switch post["audienceFilter"] as? String ?? "any" {
        case "men":return gender=="man"
        case "women":return gender=="woman"
        case "excludeMen":return gender != "man"
        case "excludeWomen":return gender != "woman"
        default:return true
        }
    }
    func availablePost(_ state: JSONObject, _ id: String, _ viewer: String) throws -> JSONObject { let p=object(object(content(state)["posts"])[id]); try require(canReadPost(state,p,viewer),"POST_UNAVAILABLE"); return p }
    func contentSnapshot(_ state: JSONObject) throws -> JSONObject {
        let viewer=try contentOwner(state), c=content(state), all=object(c["posts"]).values.map(object), posts=all.filter{canReadPost(state,$0,viewer)}, ids=Set(posts.compactMap{$0["id"] as? String}), echoes=object(c["echoes"]), comments=object(c["comments"]).values.map(object).filter{object(c["blocks"])[viewer+":"+($0["authorId"] as? String ?? "")] as? Bool != true && object(c["blocks"])[($0["authorId"] as? String ?? "")+":"+viewer] as? Bool != true}, accounts=object(state["accounts"])
        let visible: [JSONObject]=posts.map { p in
            var post=p;let id=p["id"] as! String, authorID=p["authorId"] as! String, profile=object(object(accounts[authorID])["profile"] ?? object(object(state["social"])["profiles"])[authorID])
            var author:JSONObject=["id":authorID,"displayName":profile["displayName"] ?? p["demoName"] ?? "Eluva","age":(profile["birthday"] != nil ? Self.age(profile["birthday"] as? String ?? "") as Any? : profile["age"]) ?? NSNull(),"about":profile["about"] ?? "","interestIds":profile["interestIds"] ?? []]
            author.merge(proAppearance(state,authorID)){_,new in new};post["author"]=author;post["discoveryEligible"]=discoveryEligible(state,p,viewer)
            post["lit"]=echoes[viewer+":"+id] != nil;post["litAt"]=object(echoes[viewer+":"+id])["createdAt"] ?? NSNull();post["echoCount"]=echoes.values.map(object).filter{$0["postId"] as? String==id}.count;post["commentCount"]=comments.filter{$0["postId"] as? String==id}.count;return post
        }
        let visibleComments=comments.filter{ids.contains($0["postId"] as? String ?? "")}.map{ x -> JSONObject in var v=x;v["authorName"]=object(object(accounts[x["authorId"] as? String ?? ""])["profile"])["displayName"] ?? "Eluva";return v }
        let collections=object(c["collections"]).values.map(object).filter{$0["ownerId"] as? String==viewer}.map { x -> JSONObject in var v=x;v["postIds"]=(x["postIds"] as? [String] ?? []).filter{ids.contains($0)};return v }
        let day=quotaDay(Date());var verifiedPolicy=contentPolicy;verifiedPolicy["proAudienceEnabled"]=hasProAccess(state,owner:viewer)
        return ["ownerId":viewer,"blockedAuthors":object(c["blocks"]).keys.filter{$0.hasPrefix(viewer+":")}.map{key -> JSONObject in let id=String(key.dropFirst(viewer.count+1));return ["id":id,"name":object(object(accounts[id])["profile"])["displayName"] ?? object(object(object(state["social"])["profiles"])[id])["displayName"] ?? all.first{$0["authorId"] as? String==id}?["demoName"] ?? "Eluva"]},"hiddenPosts":all.filter{object(c["hidden"])[viewer+":"+($0["id"] as? String ?? "")] as? Bool==true && canReadPost(state,$0,viewer,ignoreHidden:true)}.map{["id":$0["id"]!,"authorId":$0["authorId"]!,"body":$0["body"] ?? "","demoKey":$0["demoKey"] ?? NSNull()]},"posts":visible,"comments":visibleComments,"events":object(c["events"]).values.map(object).filter{$0["recipientId"] as? String==viewer && object(c["blocks"])[viewer+":"+($0["senderId"] as? String ?? "")] as? Bool != true && object(c["blocks"])[($0["senderId"] as? String ?? "")+":"+viewer] as? Bool != true && ids.contains($0["postId"] as? String ?? "")},"collections":collections,"preferences":object(c["preferences"])[viewer] ?? ["guideDone":false,"feedFilter":["media":"all","topic":"all"]],"quota":["day":day,"used":object(object(object(object(state["commerce"])["accounts"])[viewer])["usage"])["publicPost:"+day] ?? object(c["quota"])[viewer+":"+day] ?? 0,"limit":contentPolicy["dailyPublicPosts"] ?? NSNull(),"simulation":true],"policy":verifiedPolicy]
    }
    func executeContent(_ method: String, params: JSONObject) throws -> JSONObject {
        var next=snapshot!;let viewer=try contentOwner(next), string={ (key:String) in params[key] as? String ?? "" }
        if method=="snapshot" { return try contentSnapshot(next) }
        if method=="post" { _=try availablePost(next,string("id"),viewer);return try contentSnapshot(next) }
        if method=="beginDraft" { let id=string("draftId");try require(UUID(uuidString:id) != nil && (contentDrafts[id]==nil || contentDrafts[id]==viewer),"INVALID_ARGUMENT");contentDrafts[id]=viewer;return ["draftId":id] }
        if method=="discardDraft" { let id=string("draftId");try require(contentDrafts[id]==viewer,"DRAFT_EXPIRED");removeStaging(flowID:id);contentDrafts.removeValue(forKey:id);return ["discarded":true] }
        var c=content(next);let opKey=viewer+":"+string("commitId"), idempotent=["publish","comment","createCollection","report"].contains(method), target=string("postId").isEmpty ? string("draftId") : string("postId")
        let payload = String(data:try JSONSerialization.data(withJSONObject:params,options:[.sortedKeys]),encoding:.utf8)!
        if idempotent {
            try require(UUID(uuidString:string("commitId")) != nil,"INVALID_ARGUMENT")
            if let prior=object(c["operations"])[opKey] as? JSONObject { try require(prior["method"] as? String==method && prior["target"] as? String==target && prior["payload"] as? String==payload,"COMMIT_CONFLICT");var out=try contentSnapshot(next);out["resultId"]=prior["resultId"];return out }
        }
        var resultID: String?, copied: [URL]=[];let now=ISO8601DateFormatter().string(from:Date())
        do {
            switch method {
            case "publish":
                let draft=string("draftId");try require(contentDrafts[draft]==viewer,"DRAFT_EXPIRED")
                let body=string("body").trimmingCharacters(in:.whitespacesAndNewlines), media=array(params["media"]), mids=media.compactMap{$0["id"] as? String}, videos=media.filter{$0["kind"] as? String=="video"}.count
                try require(body.count <= (contentPolicy["bodyLimit"] as? Int ?? 2000),"POST_TOO_LONG");try require(!body.isEmpty || !media.isEmpty,"EMPTY_POST")
                try require(mids.count==media.count && Set(mids).count==mids.count && media.allSatisfy{["image","video"].contains($0["kind"] as? String ?? "")},"INVALID_MEDIA")
                try require(videos>0 ? videos==1 && media.count==1 : media.count <= (contentPolicy["imageLimit"] as? Int ?? 9),"MEDIA_LIMIT")
                let audienceFilter=string("audienceFilter");try require(["any","men","women","excludeMen","excludeWomen"].contains(audienceFilter),"INVALID_FILTER")
                try require(audienceFilter=="any" || hasProAccess(next,owner:viewer),"PRO_LOCKED")
                let v=object(params["visibility"]);try require(v["private"] is Bool && v["discover"] is Bool && v["profile"] is Bool && ["everyone","friends"].contains(v["audience"] as? String ?? ""),"INVALID_VISIBILITY")
                var visibility=v;if v["private"] as? Bool==true {visibility["discover"]=false;visibility["profile"]=false}
                let tags=params["tagIds"] as? [String] ?? [];try require(tags.allSatisfy{contentInterestIDs.contains($0)},"INVALID_FILTER")
                for m in media { let id=m["id"] as! String;try require(staging[id]?.flow==draft && stagedKinds[id]==m["kind"] as? String,"MEDIA_MISSING");try promoteContentMedia(id,viewer:viewer,content:&c,copied:&copied) }
                let collection=string("collectionId");var collections=object(c["collections"]);if !collection.isEmpty {try require(object(collections[collection])["ownerId"] as? String==viewer,"COLLECTION_UNAVAILABLE")}
                let newPostID=UUID().uuidString.lowercased();try consumePublicPost(&next,owner:viewer,commit:string("commitId"),post:newPostID,hidden:visibility["private"] as? Bool==true,date:Date())
                if visibility["private"] as? Bool != true {var q=object(c["quota"]);let key=viewer+":"+quotaDay(Date()), used=q[key] as? Int ?? 0;q[key]=used+1;c["quota"]=q}
                let id=newPostID;resultID=id;var posts=object(c["posts"]);posts[id]=["id":id,"authorId":viewer,"body":body,"media":media.map{["id":$0["id"]!,"kind":$0["kind"]!]},"visibility":visibility,"audienceFilter":audienceFilter,"tagIds":Array(Set(tags)),"createdAt":now];c["posts"]=posts
                if !collection.isEmpty {var item=object(collections[collection]);var refs=item["postIds"] as? [String] ?? [];refs.append(id);item["postIds"]=refs;collections[collection]=item;c["collections"]=collections}
            case "echo":
                let p=try availablePost(next,string("postId"),viewer), id=p["id"] as! String, key=viewer+":"+id;try require(params["lit"] is Bool,"INVALID_ARGUMENT");var echoes=object(c["echoes"]), events=object(c["events"])
                if params["lit"] as? Bool==true { if echoes[key]==nil {echoes[key]=["id":key,"postId":id,"userId":viewer,"createdAt":now]};if p["authorId"] as? String != viewer {events[key]=["id":key,"kind":"echo","postId":id,"senderId":viewer,"recipientId":p["authorId"]!,"createdAt":object(echoes[key])["createdAt"] ?? now]} }
                else {echoes.removeValue(forKey:key);events.removeValue(forKey:key)};c["echoes"]=echoes;c["events"]=events
            case "comment":
                let p=try availablePost(next,string("postId"),viewer),body=string("body").trimmingCharacters(in:.whitespacesAndNewlines);try require(!body.isEmpty && body.count <= (contentPolicy["commentLimit"] as? Int ?? 1000),"INVALID_COMMENT");try require(p["authorId"] as? String==viewer || object(c["echoes"])[viewer+":"+string("postId")] != nil,"ECHO_REQUIRED")
                let id=UUID().uuidString.lowercased();resultID=id;var comments=object(c["comments"]);comments[id]=["id":id,"postId":string("postId"),"authorId":viewer,"body":body,"createdAt":now];c["comments"]=comments
            case "createCollection":
                let name=string("name").trimmingCharacters(in:.whitespacesAndNewlines),description=string("description").trimmingCharacters(in:.whitespacesAndNewlines);try require(!name.isEmpty && name.count<=60 && description.count<=300,"INVALID_COLLECTION")
                let cover=string("coverId");if !cover.isEmpty {try require(staging[cover]?.flow==string("draftId") && contentDrafts[string("draftId")]==viewer && stagedKinds[cover]=="image","MEDIA_MISSING");try promoteContentMedia(cover,viewer:viewer,content:&c,copied:&copied)}
                let id=UUID().uuidString.lowercased();resultID=id;var collections=object(c["collections"]);collections[id]=["id":id,"ownerId":viewer,"name":name,"description":description,"coverId":cover.isEmpty ? NSNull() : cover as Any,"postIds":[],"createdAt":now];c["collections"]=collections
            case "preferences":
                var all=object(c["preferences"]),p=object(all[viewer]);if let done=params["guideDone"] {try require(done is Bool,"INVALID_ARGUMENT");p["guideDone"]=done}
                if let filter=params["feedFilter"] as? JSONObject {try require(["all","image","video","text"].contains(filter["media"] as? String ?? "") && ((filter["topic"] as? String)=="all" || contentInterestIDs.contains(filter["topic"] as? String ?? "")),"INVALID_FILTER");p["feedFilter"]=["media":filter["media"]!,"topic":filter["topic"]!]}
                all[viewer]=p;c["preferences"]=all
            case "hide":
                let p=object(object(c["posts"])[string("postId")]);try require(canReadPost(next,p,viewer,ignoreHidden:true),"POST_UNAVAILABLE");try require(params["hidden"] is Bool,"INVALID_ARGUMENT")
                if params["hidden"] as? Bool==true,let author=p["authorId"] as? String,author != viewer {setContentAuthorBlock(&next,content:&c,viewer:viewer,author:author,blocked:true)}else{var h=object(c["hidden"]);if params["hidden"] as? Bool==true {h[viewer+":"+string("postId")]=true}else{h.removeValue(forKey:viewer+":"+string("postId"))};c["hidden"]=h}
            case "report":
                _=try availablePost(next,string("postId"),viewer);try require(["harassment","hate","sexual","violence","spam","impersonation","misinformation"].contains(string("reason")) && string("details").count<=500,"INVALID_REPORT");let id=UUID().uuidString.lowercased();resultID=id;var reports=object(c["reports"]);reports[id]=["id":id,"ownerId":viewer,"postId":string("postId"),"reason":string("reason"),"details":string("details"),"simulation":true,"createdAt":now];c["reports"]=reports
            case "block":
                let author=string("authorId");try require(author != viewer && params["blocked"] is Bool,"INVALID_ARGUMENT");try require(object(next["accounts"])[author] != nil || object(c["posts"]).values.map(object).contains{$0["authorId"] as? String==author},"ACCOUNT_NOT_FOUND");setContentAuthorBlock(&next,content:&c,viewer:viewer,author:author,blocked:params["blocked"] as? Bool==true)
            default: throw EluvaError("METHOD_NOT_FOUND")
            }
            if idempotent {var ops=object(c["operations"]);ops[opKey]=["method":method,"target":target,"payload":payload,"resultId":resultID ?? ""];c["operations"]=ops};next["content"]=c;try persist(next)
        } catch {copied.forEach{try? FileManager.default.removeItem(at:$0)};throw (error as? EluvaError) ?? EluvaError("STORAGE_FAILED")}
        if method=="publish" {removeStaging(flowID:string("draftId"));contentDrafts.removeValue(forKey:string("draftId"))}
        var output=try contentSnapshot(next);if let resultID {output["resultId"]=resultID};return output
    }
    var contentInterestIDs: Set<String> { guard let url=CognitiveFlexibility.shared.url(forResource:"choices",withExtension:"json",subdirectory:"config"),let data=try? Data(contentsOf:url),let all=try? JSONSerialization.jsonObject(with:data) as? JSONObject else {return []};return Set(array(all["interests"]).compactMap{$0["id"] as? String}) }
    func promoteContentMedia(_ id: String, viewer: String, content c: inout JSONObject, copied: inout [URL]) throws {
        var files=object(c["files"]);if let existing=files[id] as? JSONObject {try require(existing["ownerId"] as? String==viewer,"MEDIA_MISSING");return}
        guard let staged=staging[id],contentDrafts[staged.flow]==viewer else {throw EluvaError("MEDIA_MISSING")}
        let source=try checkedMediaFile(staged.url,folder:"Staging"),ext=source.pathExtension,destination=root.appendingPathComponent("Media").appendingPathComponent(id+"."+ext);try FileManager.default.copyItem(at:source,to:destination);copied.append(destination);files[id]=["ownerId":viewer,"kind":stagedKinds[id] ?? "image","extension":ext];c["files"]=files
    }
    func contentMediaURL(_ id: String) throws -> URL? {
        guard let state=snapshot, let f=object(content(state)["files"])[id] as? JSONObject else{return nil};let viewer=try contentOwner(state)
        let readable=f["socialPeerId"] != nil ? socialMediaReadable(state,id,viewer) : f["ownerId"] as? String==viewer || object(content(state)["posts"]).values.map(object).contains{p in canReadPost(state,p,viewer) && array(p["media"]).contains{$0["id"] as? String==id}}
        try require(readable,"MEDIA_MISSING");let ext=f["extension"] as? String ?? "";try require(["jpg","mp4","mov","wav","m4a"].contains(ext),"MEDIA_MISSING");let url=root.appendingPathComponent("Media").appendingPathComponent(id+"."+ext);return try checkedMediaFile(url,folder:"Media")
    }
    func importVideo(_ data: Data, draftID: String, completion: @escaping (Result<JSONObject,Error>)->Void) throws {
        try validateMediaFlow(draftID);try require(contentDrafts[draftID] != nil,"DRAFT_EXPIRED");try require(data.count<=(contentPolicy["videoBytes"] as? Int ?? 52428800),"MEDIA_TOO_LARGE")
        let id=UUID().uuidString.lowercased(),brand=String(data:data.dropFirst(8).prefix(4),encoding:.ascii) ?? "",ext=brand=="qt  " ? "mov" : "mp4",url=root.appendingPathComponent("Staging").appendingPathComponent(id+"."+ext)
        do{try data.write(to:url,options:[.atomic,.completeFileProtection])}catch{throw EluvaError("STORAGE_FAILED")}
        let asset=AVURLAsset(url:url),limit=Double(contentPolicy["videoSeconds"] as? Int ?? 60),callback=PerceptualSensitivity(completion)
        Task {
            do {
                async let duration=asset.load(.duration)
                async let tracks=asset.loadTracks(withMediaType:.video)
                let (length,videoTracks)=try await(duration,tracks),seconds=length.seconds,hasVideo = !videoTracks.isEmpty
                self.queue.async {
                    do {try self.validateMediaFlow(draftID);try require(self.contentDrafts[draftID] != nil,"DRAFT_EXPIRED");try require(seconds.isFinite && seconds>0 && seconds<=limit && hasVideo,"INVALID_VIDEO");self.staging[id]=(draftID,url);self.stagedKinds[id]="video";callback.receive(.success(["id":id,"url":"eluva://media/"+id,"kind":"video"]))}
                    catch {try? FileManager.default.removeItem(at:url);callback.receive(.failure(error))}
                }
            }catch{self.queue.async{try? FileManager.default.removeItem(at:url);callback.receive(.failure(EluvaError("INVALID_VIDEO")))}}
        }
    }
}

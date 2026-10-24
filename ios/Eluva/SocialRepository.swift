import Foundation

extension LocalRepository {
    // Inline artwork stays structured data: only bundled sticker IDs and plain text.
    // The body is the text-only preview; it cannot diverge from the rendered parts.
    func normalizedSocialTextParts(_ raw: Any, body: String) throws -> [JSONObject] {
        guard let source = raw as? [JSONObject], !source.isEmpty, source.count <= 2000 else { throw EluvaError("INVALID_MESSAGE") }
        let stickerIDs = Set((1...28).map { String(format: "sticker-%02d", $0) })
        var parts: [JSONObject] = [], plain = "", hasSticker = false
        for item in source {
            guard let type = item["type"] as? String else { throw EluvaError("INVALID_MESSAGE") }
            switch type {
            case "text":
                guard Set(item.keys) == Set(["type", "text"]), let text = item["text"] as? String else { throw EluvaError("INVALID_MESSAGE") }
                plain += text
                guard !text.isEmpty else { continue }
                if parts.last?["type"] as? String == "text" {
                    parts[parts.count - 1]["text"] = (parts.last?["text"] as? String ?? "") + text
                } else { parts.append(["type": "text", "text": text]) }
            case "sticker":
                guard Set(item.keys) == Set(["type", "stickerId"]), let id = item["stickerId"] as? String, stickerIDs.contains(id) else { throw EluvaError("INVALID_MESSAGE") }
                hasSticker = true; parts.append(["type": "sticker", "stickerId": id])
            default: throw EluvaError("INVALID_MESSAGE")
            }
        }
        let count = parts.reduce(0) { $0 + (($1["type"] as? String == "sticker") ? 1 : ($1["text"] as? String ?? "").count) }
        try require(count <= 2000 && (hasSticker || !plain.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty), "INVALID_MESSAGE")
        try require(body == plain.trimmingCharacters(in: .whitespacesAndNewlines), "INVALID_MESSAGE")
        return parts
    }
    func socialPair(_ a:String,_ b:String)->String {[a,b].sorted().joined(separator:"|")}
    func socialBlocked(_ state:JSONObject,_ a:String,_ b:String)->Bool {let blocks=object(content(state)["blocks"]);return blocks[a+":"+b] as? Bool==true || blocks[b+":"+a] as? Bool==true}
    func ensureSocial(_ state:inout JSONObject)throws {
        if state["social"]==nil {
            var s:JSONObject=["version":1];for k in ["profiles","follows","requests","friendships","threads","messages","eventReads","preferences","operations","feedback","reports"]{s[k]=JSONObject()}
            var profiles:JSONObject=[:]
            if let url=Bundle.main.url(forResource:"social-demo",withExtension:"json",subdirectory:"Web/config"),let data=try? Data(contentsOf:url),let list=try? JSONSerialization.jsonObject(with:data) as? [JSONObject]{for var p in list {p["demo"]=true;profiles[p["id"] as! String]=p}}
            s["profiles"]=profiles;var friendships:JSONObject=[:],threads:JSONObject=[:],messages:JSONObject=[:],requests:JSONObject=[:];let stamp="2026-10-17T08:00:00.000Z"
            for (owner,raw) in object(state["fixtures"]) {let fixture=object(raw)
                for peer in fixture["friends"] as? [String] ?? [] {let pair=socialPair(owner,peer);friendships[pair]=["id":pair,"users":[owner,peer],"createdAt":stamp]}
                for t in array(fixture["threads"]){guard let id=t["id"] as? String,let peer=t["participantId"] as? String else{continue};threads[id]=["id":id,"pair":socialPair(owner,peer),"users":[owner,peer],"createdAt":stamp]
                    for (index,m) in array(t["messages"]).enumerated(){let mine=m["sentByMe"] as? Bool==true,mid=owner+":"+(m["id"] as? String ?? String(index));var v:JSONObject=["id":mid,"threadId":id,"senderId":mine ? owner:peer,"recipientId":mine ? peer:owner,"kind":m["kind"] ?? "text","body":object(m["body"])["en"] ?? m["body"] as? String ?? "","createdAt":index==0 ? stamp:"2026-10-17T08:01:00.000Z","readAt":NSNull(),"demo":true];if m["body"] is JSONObject{v["translations"]=m["body"]};if let asset=m["asset"]{v["asset"]=asset};messages[mid]=v}
                }
                if owner==Self.testID {for (id,sender,recipient,body) in [("demo-request-in","demo-requester",owner,"A hello from the local request demo."),("demo-request-out",owner,"demo-recipient","A local introduction waiting for a decision.")]{requests[id]=["id":id,"pair":socialPair(sender,recipient),"senderId":sender,"recipientId":recipient,"body":body,"status":"pending","createdAt":stamp,"demo":true]}}
            }
            s["friendships"]=friendships;s["threads"]=threads;s["messages"]=messages;s["requests"]=requests;state["social"]=s
        }
        guard let s=state["social"] as? JSONObject,s["version"] as? Int==1,["profiles","follows","requests","friendships","threads","messages","eventReads","preferences","operations","feedback","reports"].allSatisfy({s[$0] is JSONObject})else{throw EluvaError("STORAGE_CORRUPT")}
        try upgradeSuppliedDemoSocial(&state)
        var migrated=object(state["social"])
        if migrated["dismissedEvents"]==nil{migrated["dismissedEvents"]=JSONObject()}
        try require(migrated["dismissedEvents"] is JSONObject,"STORAGE_CORRUPT")
        if migrated["connections"]==nil{migrated["connections"]=JSONObject()}
        try require(migrated["connections"] is JSONObject,"STORAGE_CORRUPT")
        if migrated["conversationRulesVersion"]==nil {
            var follows=object(migrated["follows"])
            for f in object(migrated["friendships"]).values.map(object){let users=f["users"] as? [String] ?? [];guard users.count==2 else{continue};for (a,b) in [(users[0],users[1]),(users[1],users[0])] where follows[a+":"+b]==nil{follows[a+":"+b]=["senderId":a,"recipientId":b,"createdAt":f["createdAt"] ?? ""]}}
            migrated["follows"]=follows;migrated["conversationRulesVersion"]=1
        }
        state["social"]=migrated
    }
    func socialProfile(_ state:JSONObject,_ id:String,_ viewer:String)throws->JSONObject {
        let account=object(object(state["accounts"])[id]),p=account.isEmpty ? object(object(object(state["social"])["profiles"])[id]):object(account["profile"])
        try require(!p.isEmpty && (p["scope"]==nil || p["scope"] as? String==viewer),"PROFILE_UNAVAILABLE")
        return ["id":id,"displayName":p["displayName"] ?? "Eluva","about":p["about"] ?? "","aboutTranslations":p["aboutTranslations"] ?? JSONObject(),"age":account.isEmpty ? p["age"] ?? NSNull() : Self.age(p["birthday"] as? String ?? "") as Any? ?? NSNull(),"photos":array(p["photos"]).compactMap{x->JSONObject? in guard let photoID=x["id"] as? String else{return nil};var photo:JSONObject=["id":photoID];if account.isEmpty && p["demo"] as? Bool==true,let asset=suppliedDemoPhotoAsset(id,photoID){photo["asset"]=asset};return photo},"interestIds":p["interestIds"] ?? [],"university":p["university"] ?? "","major":p["major"] ?? "","demo":p["demo"] as? Bool==true || account["isTest"] as? Bool==true]
    }
    func socialRelation(_ state:JSONObject,_ viewer:String,_ peer:String)->JSONObject {
        let s=object(state["social"]),pair=socialPair(viewer,peer);var request:Any=NSNull()
        if var r=object(s["requests"]).values.map(object).first(where:{$0["pair"] as? String==pair}){r["direction"]=r["senderId"] as? String==viewer ? "sent":"received";request=r}
        let follows=object(s["follows"]),following=follows[viewer+":"+peer] != nil,mutual=following && follows[peer+":"+viewer] != nil
        var connection=object(object(s["connections"])[pair]);if !connection.isEmpty{connection["direction"]=connection["senderId"] as? String==viewer ? "sent":"received"}
        return ["blocked":socialBlocked(state,viewer,peer),"blockedByMe":object(content(state)["blocks"])[viewer+":"+peer] as? Bool==true,"following":following,"friends":mutual,"mutual":mutual,"canMessage":mutual || connection["status"] as? String=="connected","connection":connection.isEmpty ? NSNull():connection as Any,"request":request]
    }
    func requireSocialPeer(_ state:JSONObject,_ viewer:String,_ peer:String,friend:Bool=false)throws {
        try require(viewer != peer,"SELF_ACTION");_=try socialProfile(state,peer,viewer);try require(!socialBlocked(state,viewer,peer),"USER_BLOCKED");if friend{try require(socialRelation(state,viewer,peer)["canMessage"] as? Bool==true,"FRIENDSHIP_REQUIRED")}
    }
    func requireSocialThread(_ state:JSONObject,_ viewer:String,_ peer:String)throws {
        try requireSocialPeer(state,viewer,peer);let r=socialRelation(state,viewer,peer)
        try require(r["canMessage"] as? Bool==true || !object(r["connection"]).isEmpty,"FRIENDSHIP_REQUIRED")
    }
    func socialActivities(_ state:JSONObject,_ viewer:String)->[JSONObject] {
        let c=content(state),s=object(state["social"]),posts=object(c["posts"]);var rows:[JSONObject]=[]
        for e in object(c["echoes"]).values.map(object) where e["userId"] as? String==viewer {let post=object(posts[e["postId"] as? String ?? ""]);if post["authorId"] as? String != viewer && canReadPost(state,post,viewer){rows.append(["id":"sent:"+(e["id"] as? String ?? ""),"peerId":post["authorId"]!,"postId":post["id"]!,"direction":"sent","createdAt":e["createdAt"]!,"body":post["body"] ?? ""])}}
        for e in object(c["events"]).values.map(object) where e["recipientId"] as? String==viewer {let post=object(posts[e["postId"] as? String ?? ""]);if canReadPost(state,post,viewer){rows.append(["id":"received:"+(e["id"] as? String ?? ""),"peerId":e["senderId"]!,"postId":post["id"]!,"direction":"received","createdAt":e["createdAt"]!,"body":post["body"] ?? ""])}}
        let messaged=Set(object(s["messages"]).values.map(object).filter{[$0["senderId"] as? String,$0["recipientId"] as? String].contains(viewer)}.compactMap{$0["senderId"] as? String==viewer ? $0["recipientId"] as? String:$0["senderId"] as? String})
        return rows.filter{!socialBlocked(state,viewer,$0["peerId"] as? String ?? "") && object(s["dismissedEvents"])[viewer+":"+($0["id"] as! String)]==nil}.map{x in var v=x;v["lightOnly"] = !messaged.contains(x["peerId"] as? String ?? "");v["read"]=object(s["eventReads"])[viewer+":"+(x["id"] as! String)] != nil;return v}.sorted{($0["createdAt"] as? String ?? "")>($1["createdAt"] as? String ?? "")}
    }
    func socialSnapshot(_ state:JSONObject)throws->JSONObject {
        let viewer=try contentOwner(state),s=object(state["social"]),c=content(state);var profiles:[JSONObject]=[]
        let ids=Set(object(state["accounts"]).keys).union(object(s["profiles"]).keys)
        for id in ids {guard var p=try? socialProfile(state,id,viewer)else{continue};p["relationship"]=id==viewer ? NSNull():socialRelation(state,viewer,id) as Any;let follows=object(s["follows"]).values.map(object);p["counts"]=["following":follows.filter{$0["senderId"] as? String==id}.count,"followers":follows.filter{$0["recipientId"] as? String==id}.count,"friends":follows.filter{let peer=$0["recipientId"] as? String ?? "";return $0["senderId"] as? String==id && object(s["follows"])[peer+":"+id] != nil && !socialBlocked(state,id,peer)}.count];profiles.append(p)}
        let ownThreads=object(s["threads"]).values.map(object).filter{($0["users"] as? [String] ?? []).contains(viewer)},ownThreadIDs=Set(ownThreads.compactMap{$0["id"] as? String})
        let seconds=ISO8601DateFormatter(),fractional=ISO8601DateFormatter();fractional.formatOptions=[.withInternetDateTime,.withFractionalSeconds]
        var datedMessages: [String:[(message:JSONObject,time:TimeInterval,id:String)]] = [:]
        for (key,raw) in object(s["messages"]) {
            let message=object(raw)
            guard let thread=message["threadId"] as? String,ownThreadIDs.contains(thread) else{continue}
            let stamp=message["createdAt"] as? String ?? ""
            // Parse once per row, outside the comparison closure. Historical second
            // precision and new millisecond precision represent the same timeline.
            let date=(stamp.contains(".") ? fractional:seconds).date(from:stamp)
            datedMessages[thread,default:[]].append((message,date?.timeIntervalSince1970 ?? 0,message["id"] as? String ?? key))
        }
        let orderedMessages=datedMessages.mapValues{rows in rows.sorted{a,b in a.time==b.time ? a.id<b.id:a.time<b.time}.map{$0.message}}
        let threads:[JSONObject]=ownThreads.map { t in var v=t;let peer=(t["users"] as? [String] ?? []).first{$0 != viewer} ?? "",blocked=socialBlocked(state,viewer,peer)||(object(state["accounts"])[peer]==nil&&object(s["profiles"])[peer]==nil);let messages=blocked ? []:orderedMessages[t["id"] as? String ?? ""] ?? [];v["peerId"]=peer;v["blocked"]=blocked;v["messages"]=messages;v["unread"]=messages.filter{$0["recipientId"] as? String==viewer && !($0["readAt"] is String)}.count;return v}.filter{$0["blocked"] as? Bool != true}
        let requests=object(s["requests"]).values.map(object).filter{[$0["senderId"] as? String,$0["recipientId"] as? String].contains(viewer) && !socialBlocked(state,$0["senderId"] as? String ?? "",$0["recipientId"] as? String ?? "")}.map {r in var v=r;v["direction"]=r["senderId"] as? String==viewer ? "sent":"received";v["blocked"]=false;return v}
        let events=socialActivities(state,viewer),posts=object(c["posts"]),collections=object(c["collections"]).values.map(object).filter{x in let owner=x["ownerId"] as? String ?? "";return profiles.contains{$0["id"] as? String==owner} && !socialBlocked(state,viewer,owner)}.map{x in var v=x;if x["ownerId"] as? String != viewer{v["coverId"]=NSNull()};v["postIds"]=(x["postIds"] as? [String] ?? []).filter{id in let post=object(posts[id]);return canReadPost(state,post,viewer)&&object(post["visibility"])["profile"] as? Bool==true};return v}.filter{!($0["postIds"] as? [String] ?? []).isEmpty}
        return ["ownerId":viewer,"profiles":profiles,"threads":threads,"requests":requests,"events":events,"unreadCount":threads.reduce(0){$0+($1["unread"] as? Int ?? 0)}+events.filter{$0["lightOnly"] as? Bool==true && $0["read"] as? Bool != true}.count+requests.filter{$0["blocked"] as? Bool != true && $0["direction"] as? String=="received" && $0["status"] as? String=="pending"}.count,"preferences":object(s["preferences"])[viewer] ?? ["filter":"all","unreadOnly":false],"feedback":object(s["feedback"]).values.map(object).filter{$0["ownerId"] as? String==viewer},"profilePosts":posts.values.map(object).filter{canReadPost(state,$0,viewer)&&object($0["visibility"])["profile"] as? Bool==true},"collections":collections]
    }
    func socialThread(_ s:inout JSONObject,_ viewer:String,_ peer:String,_ now:String)->JSONObject {
        let pair=socialPair(viewer,peer);var all=object(s["threads"]);if let t=all.values.map(object).first(where:{$0["pair"] as? String==pair}){return t};let t:JSONObject=["id":"thread:"+pair,"pair":pair,"users":[viewer,peer],"createdAt":now];all[t["id"] as! String]=t;s["threads"]=all;return t
    }
    private func socialMessageCreatedAt() -> String {
        let formatter=ISO8601DateFormatter();formatter.formatOptions=[.withInternetDateTime,.withFractionalSeconds]
        return formatter.string(from:Date())
    }
    func executeSocial(_ method:String,params:JSONObject)throws->JSONObject {
        var next=snapshot!;let viewer=try contentOwner(next);try ensureSocial(&next);let string={(key:String) in params[key] as? String ?? ""},peer=string("peerId")
        if method=="simulateFailure" {try require(currentUser(next)?["isTest"] as? Bool==true && ["send","request","accept","ignore","snapshot","follow","help","replyPost","declineConnection"].contains(string("operation")),"INVALID_ARGUMENT");socialFailure=string("operation");return ["armed":true]}
        if method=="snapshot" && socialFailure==method {socialFailure=nil;throw EluvaError("STORAGE_FAILED")}
        if method=="profile"{let p=try socialProfile(next,peer,viewer);if !socialBlocked(next,viewer,peer){profileMediaGrants[viewer,default:[]].formUnion(array(p["photos"]).compactMap{$0["id"] as? String})};return try socialSnapshot(next)}
        if ["thread","requireFriend"].contains(method){if method=="thread"{try requireSocialThread(next,viewer,peer)}else{try requireSocialPeer(next,viewer,peer,friend:true)};if method=="thread"{profileMediaGrants[viewer,default:[]].formUnion(array(try socialProfile(next,peer,viewer)["photos"]).compactMap{$0["id"] as? String})};return method=="requireFriend" ? ["allowed":true]:try socialSnapshot(next)}
        if method=="beginDraft"{try persist(next);let id=string("draftId");try require(UUID(uuidString:id) != nil,"INVALID_ARGUMENT");try requireSocialPeer(next,viewer,peer,friend:true);if let prior=socialDrafts[id]{try require(prior.owner==viewer&&prior.peer==peer,"DRAFT_EXPIRED")};socialDrafts[id]=(viewer,peer);return ["draftId":id]}
        if method=="discardDraft"{let id=string("draftId");try require(socialDrafts[id]?.owner==viewer,"DRAFT_EXPIRED");removeStaging(flowID:id);socialDrafts.removeValue(forKey:id);return ["discarded":true]}
        var s=object(next["social"]),resultID:String?,copied:[URL]=[];let op=viewer+":"+string("commitId"),idempotent=["request","accept","ignore","send","help","report","replyPost","declineConnection","clearLightEvents","restoreLightEvents"].contains(method),payload=String(data:try JSONSerialization.data(withJSONObject:params,options:[.sortedKeys]),encoding:.utf8)!,now=ISO8601DateFormatter().string(from:Date())
        if idempotent {try require(UUID(uuidString:string("commitId")) != nil,"INVALID_ARGUMENT");if let old=object(s["operations"])[op] as? JSONObject{try require(old["method"] as? String==method&&old["payload"] as? String==payload,"COMMIT_CONFLICT");var out=try socialSnapshot(next);out["resultId"]=old["resultId"];return out}}
        do {
            switch method {
            case "snapshot":break
            case "follow":try requireSocialPeer(next,viewer,peer);try require(params["following"] is Bool,"INVALID_ARGUMENT");var follows=object(s["follows"]);if params["following"] as? Bool==true {follows[viewer+":"+peer]=["senderId":viewer,"recipientId":peer,"createdAt":now]}else{follows.removeValue(forKey:viewer+":"+peer)};s["follows"]=follows
            case "request":
                try requireSocialPeer(next,viewer,peer);let r=socialRelation(next,viewer,peer);try require(r["friends"] as? Bool != true,"ALREADY_FRIENDS");let prior=object(r["request"]);try require(prior.isEmpty,prior["status"] as? String=="ignored" ? "REQUEST_IGNORED":"REQUEST_PENDING");let body=string("body").trimmingCharacters(in:.whitespacesAndNewlines);try require(!body.isEmpty&&body.count<=500,"INVALID_INTRO");let id=UUID().uuidString.lowercased();resultID=id;var requests=object(s["requests"]);requests[id]=["id":id,"pair":socialPair(viewer,peer),"senderId":viewer,"recipientId":peer,"body":body,"status":"pending","createdAt":now];s["requests"]=requests
            case "accept","ignore":
                var requests=object(s["requests"]),r=object(requests[string("requestId")]);try require(r["recipientId"] as? String==viewer,"REQUEST_UNAVAILABLE");let sender=r["senderId"] as? String ?? "";try requireSocialPeer(next,viewer,sender);try require(r["status"] as? String=="pending","REQUEST_RESOLVED");r["status"]=method=="accept" ? "accepted":"ignored";r["resolvedAt"]=now;requests[string("requestId")]=r;s["requests"]=requests;if method=="accept"{let pair=socialPair(viewer,sender);var friends=object(s["friendships"]);friends[pair]=["id":pair,"users":[sender,viewer],"createdAt":now];s["friendships"]=friends;var follows=object(s["follows"]);for (a,b) in [(viewer,sender),(sender,viewer)] where follows[a+":"+b]==nil{follows[a+":"+b]=["senderId":a,"recipientId":b,"createdAt":now]};s["follows"]=follows;_=socialThread(&s,viewer,sender,now)};resultID=string("requestId")
            case "replyPost":
                let postID=string("postId"),c=content(next),post=object(object(c["posts"])[postID]);try require(canReadPost(next,post,viewer),"POST_UNAVAILABLE");let target=post["authorId"] as? String ?? "";try requireSocialPeer(next,viewer,target);try require(object(c["echoes"])[viewer+":"+postID] != nil,"ECHO_REQUIRED");let relation=socialRelation(next,viewer,target),prior=object(relation["connection"]);try require(relation["canMessage"] as? Bool != true,"CONNECTION_ESTABLISHED");try require(prior.isEmpty,prior["status"] as? String=="declined" ? "CONNECTION_DECLINED":"CONNECTION_PENDING");let body=string("body").trimmingCharacters(in:.whitespacesAndNewlines);try require(!body.isEmpty&&body.count<=500,"INVALID_INTRO");let thread=socialThread(&s,viewer,target,now),id=UUID().uuidString.lowercased(),pair=socialPair(viewer,target);resultID=id;var messages=object(s["messages"]);messages[id]=["id":id,"threadId":thread["id"]!,"senderId":viewer,"recipientId":target,"kind":"text","body":body,"postId":postID,"connectionIntro":true,"createdAt":socialMessageCreatedAt(),"readAt":NSNull()];s["messages"]=messages;var connections=object(s["connections"]);connections[pair]=["id":pair,"pair":pair,"senderId":viewer,"recipientId":target,"postId":postID,"introMessageId":id,"status":"pending","createdAt":now];s["connections"]=connections
            case "declineConnection":
                try requireSocialPeer(next,viewer,peer);let pair=socialPair(viewer,peer);var connections=object(s["connections"]),connection=object(connections[pair]);try require(connection["recipientId"] as? String==viewer,"CONNECTION_UNAVAILABLE");try require(connection["status"] as? String=="pending","CONNECTION_RESOLVED");try require(socialRelation(next,viewer,peer)["canMessage"] as? Bool != true,"CONNECTION_ESTABLISHED");connection["status"]="declined";connection["resolvedAt"]=now;connections[pair]=connection;s["connections"]=connections;resultID=pair
            case "send":
                try requireSocialPeer(next,viewer,peer);let relation=socialRelation(next,viewer,peer),connection=object(relation["connection"]),responding=connection["status"] as? String=="pending" && connection["recipientId"] as? String==viewer;try require(relation["canMessage"] as? Bool==true || responding,"FRIENDSHIP_REQUIRED");if responding && relation["canMessage"] as? Bool != true{try require(string("kind")=="text","CONNECTION_REPLY_REQUIRED")};let kind=string("kind"),body=string("body").trimmingCharacters(in:.whitespacesAndNewlines);try require(["text","image","sticker","voice"].contains(kind),"INVALID_MESSAGE");try require(body.count<=2000,"INVALID_MESSAGE")
                var parts: [JSONObject]?
                if let raw = params["parts"] {
                    guard kind == "text", let rawBody = params["body"] as? String else { throw EluvaError("INVALID_MESSAGE") }
                    parts = try normalizedSocialTextParts(raw, body: rawBody)
                    if responding && relation["canMessage"] as? Bool != true { try require(parts!.allSatisfy { $0["type"] as? String == "text" }, "CONNECTION_REPLY_REQUIRED") }
                }
                if kind=="text" && parts==nil{try require(!body.isEmpty,"INVALID_MESSAGE")};if kind=="sticker"{try require((1...28).map{String(format:"sticker-%02d",$0)}.contains(string("stickerId")),"INVALID_MESSAGE")}
                var voiceLength:Double?;if ["image","voice"].contains(kind){let draft=string("draftId"),id=string("mediaId");try require(socialDrafts[draft]?.owner==viewer&&socialDrafts[draft]?.peer==peer,"DRAFT_EXPIRED");guard let staged=staging[id],staged.flow==draft,stagedKinds[id]==kind else{throw EluvaError("MEDIA_MISSING")};try require(object(content(next)["files"])[id]==nil,"MEDIA_MISSING");let source=try checkedMediaFile(staged.url,folder:"Staging");if kind=="voice"{voiceLength=try voiceDuration(source)};let ext=kind=="voice" ? source.pathExtension:"jpg",destination=root.appendingPathComponent("Media").appendingPathComponent(id+"."+ext);try FileManager.default.copyItem(at:source,to:destination);copied.append(destination);var c=content(next),files=object(c["files"]);files[id]=["ownerId":viewer,"kind":kind,"extension":ext,"socialPeerId":peer];c["files"]=files;next["content"]=c}
                let thread=socialThread(&s,viewer,peer,now),id=UUID().uuidString.lowercased();resultID=id;var message:JSONObject=["id":id,"threadId":thread["id"]!,"senderId":viewer,"recipientId":peer,"kind":kind,"body":body,"createdAt":socialMessageCreatedAt(),"readAt":NSNull()];if kind=="text"{message["body"]=body;if let parts { message["parts"]=parts }}else if ["image","voice"].contains(kind){message["mediaId"]=string("mediaId");if let voiceLength{message["duration"]=voiceLength}}else{message["stickerId"]=string("stickerId")};var messages=object(s["messages"]);messages[id]=message;s["messages"]=messages;if responding{var connections=object(s["connections"]),x=object(connections[socialPair(viewer,peer)]);x["status"]="connected";x["resolvedAt"]=now;x["replyMessageId"]=id;connections[socialPair(viewer,peer)]=x;s["connections"]=connections}
            case "read":
                try requireSocialThread(next,viewer,peer);let thread=object(s["threads"]).values.map(object).first{$0["pair"] as? String==socialPair(viewer,peer)};var messages=object(s["messages"]);if let id=thread?["id"] as? String {for (key,var m) in messages.mapValues(object) where m["threadId"] as? String==id && m["recipientId"] as? String==viewer && !(m["readAt"] is String){m["readAt"]=now;messages[key]=m}};s["messages"]=messages
            case "readEvents":let ids=params["eventIds"] as? [String];try require(ids != nil,"INVALID_ARGUMENT");let allowed=Set(socialActivities(next,viewer).compactMap{$0["id"] as? String});try require(ids!.allSatisfy{allowed.contains($0)},"INVALID_ARGUMENT");var reads=object(s["eventReads"]);for id in ids!{reads[viewer+":"+id]=now};s["eventReads"]=reads
            case "clearLightEvents","restoreLightEvents":
                guard let ids=params["eventIds"] as? [String] else{throw EluvaError("INVALID_ARGUMENT")};let allowed=Set(socialActivities(next,viewer).filter{$0["lightOnly"] as? Bool==true}.compactMap{$0["id"] as? String});var hidden=object(s["dismissedEvents"]);try require(ids.allSatisfy{allowed.contains($0)||hidden[viewer+":"+$0] != nil},"INVALID_ARGUMENT");for id in ids{if method=="clearLightEvents"{hidden[viewer+":"+id]=now}else{hidden.removeValue(forKey:viewer+":"+id)}};s["dismissedEvents"]=hidden
            case "lightHelpSeen":try require(params["seen"] as? Bool==true,"INVALID_ARGUMENT");var prefs=object(s["preferences"]),mine=object(prefs[viewer]);if mine.isEmpty{mine=["filter":"all","unreadOnly":false]};mine["lightHelpSeen"]=true;prefs[viewer]=mine;s["preferences"]=prefs
            case "preferences":try require(["all","following","lights"].contains(string("filter"))&&params["unreadOnly"] is Bool,"INVALID_ARGUMENT");var prefs=object(s["preferences"]);var mine=object(prefs[viewer]);mine["filter"]=string("filter");mine["unreadOnly"]=params["unreadOnly"]!;prefs[viewer]=mine;s["preferences"]=prefs
            case "block":_=try socialProfile(next,peer,viewer);try require(peer != viewer&&params["blocked"] is Bool,"INVALID_ARGUMENT");var c=content(next);setContentAuthorBlock(&next,content:&c,viewer:viewer,author:peer,blocked:params["blocked"] as? Bool==true);next["content"]=c
            case "report":try requireSocialPeer(next,viewer,peer);try require(["harassment","hate","sexual","violence","spam","impersonation","misinformation"].contains(string("reason"))&&string("details").count<=500,"INVALID_REPORT");let id=UUID().uuidString.lowercased();resultID=id;var reports=object(s["reports"]);reports[id]=["id":id,"ownerId":viewer,"targetType":"user","targetId":peer,"reason":string("reason"),"details":string("details"),"simulation":true,"createdAt":now];s["reports"]=reports
            case "help":let body=string("body").trimmingCharacters(in:.whitespacesAndNewlines);try require(!body.isEmpty&&body.count<=2000,"INVALID_MESSAGE");try require(["how","posting","privacy","feedback"].contains(string("topic")),"INVALID_ARGUMENT");let id=UUID().uuidString.lowercased();resultID=id;var feedback=object(s["feedback"]);feedback[id]=["id":id,"ownerId":viewer,"body":body,"topic":string("topic"),"createdAt":now,"simulation":true];s["feedback"]=feedback
            default:throw EluvaError("METHOD_NOT_FOUND")
            }
            if socialFailure==method{socialFailure=nil;throw EluvaError("STORAGE_FAILED")};if idempotent{var ops=object(s["operations"]);ops[op]=["method":method,"payload":payload,"resultId":resultID ?? ""];s["operations"]=ops};next["social"]=s;try persist(next)
        }catch{copied.forEach{try? FileManager.default.removeItem(at:$0)};throw (error as? EluvaError) ?? EluvaError("STORAGE_FAILED")}
        if method=="send"&&["image","voice"].contains(string("kind")){let id=string("mediaId");if let staged=staging[id]{try? FileManager.default.removeItem(at:staged.url)};staging.removeValue(forKey:id);stagedKinds.removeValue(forKey:id)}
        var out=try socialSnapshot(next);if let resultID{out["resultId"]=resultID};return out
    }
    func socialMediaReadable(_ state:JSONObject,_ id:String,_ viewer:String)->Bool {
        object(object(state["social"])["messages"]).values.map(object).contains{m in m["mediaId"] as? String==id && [m["senderId"] as? String,m["recipientId"] as? String].contains(viewer) && !socialBlocked(state,m["senderId"] as? String ?? "",m["recipientId"] as? String ?? "")}
    }
    func socialProfilePhotoURL(_ id:String)throws->URL? {
        guard let state=snapshot,let viewer=currentUser(state)?["id"] as? String,profileMediaGrants[viewer]?.contains(id)==true else{return nil}
        for (owner,raw) in object(state["accounts"]) where owner != viewer && !socialBlocked(state,viewer,owner) {if array(object(object(raw)["profile"])["photos"]).contains(where:{$0["id"] as? String==id}) {return try checkedMediaFile(root.appendingPathComponent("Media").appendingPathComponent(id+".jpg"),folder:"Media")}}
        return nil
    }
}

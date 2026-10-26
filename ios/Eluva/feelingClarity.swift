import Foundation

extension EmpathyOrientation {
    var avatarFrameIDs:Set<String>{Set((1...6).map{"frame-\($0)"})}
    // Public appearance exposes only the badge and currently usable frame.
    func proAppearance(_ state:JSONObject,_ id:String,now:Date=Date())->JSONObject {
        let active=hasProAccess(state,owner:id,now:now),saved=object(object(object(state["accounts"])[id])["profile"])["avatarFrameId"] as? String ?? ""
        return ["proActive":active,"avatarFrameId":active && avatarFrameIDs.contains(saved) ? saved:""]
    }
    func savedAvatarFrame(_ state:JSONObject,owner:String,raw:JSONObject,previous:JSONObject)throws->String {
        guard let value=raw["avatarFrameId"] else{return previous["avatarFrameId"] as? String ?? ""}
        guard let frame=value as? String,frame.isEmpty || avatarFrameIDs.contains(frame) else{throw EluvaError("INVALID_AVATAR_FRAME")}
        try require(frame.isEmpty || frame==previous["avatarFrameId"] as? String || hasProAccess(state,owner:owner),"PRO_LOCKED")
        return frame
    }
    func ensurePersonal(_ state:inout JSONObject)throws {
        if state["personal"]==nil {state["personal"]=["version":1,"preferences":JSONObject(),"feedback":JSONObject(),"operations":JSONObject(),"deletedReceipts":JSONObject()]}
        guard let p=state["personal"] as? JSONObject,p["version"] as? Int==1,["preferences","feedback","operations","deletedReceipts"].allSatisfy({p[$0] is JSONObject})else{throw EluvaError("STORAGE_CORRUPT")}
    }
    var personalPolicy:JSONObject {
        guard let url=CognitiveFlexibility.shared.url(forResource:"personal-policy",withExtension:"json",subdirectory:"config"),let data=try? Data(contentsOf:url),let p=try? JSONSerialization.jsonObject(with:data) as? JSONObject else{return ["feedbackLimit":2000,"feedbackImages":3]};return p
    }
    func personalSnapshot(_ source:JSONObject)throws->JSONObject {
        var state=source;try ensurePersonal(&state);try ensureSocial(&state);let id=try contentOwner(state),a=object(object(state["accounts"])[id]),p=object(state["personal"])
        return ["ownerId":id,"user":["id":id,"email":a["email"]!,"isTest":a["isTest"] ?? false,"profile":a["profile"] ?? JSONObject(),"registrationVersion":object(a["onboarding"])["version"] ?? NSNull()],"fixtures":object(state["fixtures"])[id] ?? ["friends":[],"requests":[],"threads":[]],"preferences":object(p["preferences"])[id] ?? ["theme":"purple"],"connections":["following":object(object(state["social"])["follows"]).values.map(object).filter{$0["senderId"] as? String==id}.compactMap{$0["recipientId"] as? String},"followers":object(object(state["social"])["follows"]).values.map(object).filter{$0["recipientId"] as? String==id}.compactMap{$0["senderId"] as? String}],"feedback":object(p["feedback"]).values.map(object).filter{$0["ownerId"] as? String==id},"content":try contentSnapshot(state),"social":try socialSnapshot(state)]
    }
    func visiblePersonalCollection(_ state:JSONObject,_ id:String,_ viewer:String)throws->JSONObject {
        let c=content(state);var x=object(object(c["collections"])[id]);try require(!x.isEmpty,"COLLECTION_UNAVAILABLE");let owner=x["ownerId"] as? String ?? "",own=owner==viewer
        try require(own || !socialBlocked(state,viewer,owner),"COLLECTION_UNAVAILABLE")
        let refs=(x["postIds"] as? [String] ?? []).filter{id in let p=object(object(c["posts"])[id]);return canReadPost(state,p,viewer)&&(own || object(p["visibility"])["profile"] as? Bool==true)}
        try require(own || !refs.isEmpty,"COLLECTION_UNAVAILABLE");x["postIds"]=refs;x["editable"]=own;if !own{x["coverId"]=NSNull()};return x
    }
    func removePersonalAccount(_ state:inout JSONObject,_ owner:String) {
        func filtered(_ raw:Any?,_ drop:(JSONObject,String)->Bool)->JSONObject {object(raw).filter{!drop(object($0.value),$0.key)}}
        var c=content(state);let removedPosts=Set(object(c["posts"]).values.map(object).filter{$0["authorId"] as? String==owner}.compactMap{$0["id"] as? String}),removedComments=Set(object(c["comments"]).values.map(object).filter{$0["authorId"] as? String==owner || removedPosts.contains($0["postId"] as? String ?? "")}.compactMap{$0["id"] as? String})
        c["posts"]=filtered(c["posts"]){x,_ in removedPosts.contains(x["id"] as? String ?? "")};c["comments"]=filtered(c["comments"]){x,_ in removedComments.contains(x["id"] as? String ?? "")}
        for key in ["echoes","events"]{c[key]=filtered(c[key]){x,_ in [x["userId"] as? String,x["senderId"] as? String,x["recipientId"] as? String].contains(owner)||removedPosts.contains(x["postId"] as? String ?? "")}}
        c["collections"]=filtered(c["collections"]){x,_ in x["ownerId"] as? String==owner}.mapValues{raw in var x=object(raw);x["postIds"]=(x["postIds"] as? [String] ?? []).filter{!removedPosts.contains($0)};return x}
        for key in ["preferences","quota","operations","hidden","blocks"]{c[key]=filtered(c[key]){_,k in k==owner||k.hasPrefix(owner+":")||(key=="blocks"&&k.hasSuffix(":"+owner))}}
        c["operations"]=filtered(c["operations"]){x,_ in removedPosts.contains(x["target"] as? String ?? "")||removedPosts.contains(x["resultId"] as? String ?? "")||removedComments.contains(x["resultId"] as? String ?? "")}
        c["reports"]=filtered(c["reports"]){x,_ in x["ownerId"] as? String==owner};c["files"]=filtered(c["files"]){x,_ in x["ownerId"] as? String==owner};state["content"]=c
        var s=object(state["social"]);let removedMessages=Set(object(s["messages"]).values.map(object).filter{$0["senderId"] as? String==owner}.compactMap{$0["id"] as? String})
        if !s.isEmpty {
            s["messages"]=filtered(s["messages"]){x,_ in x["senderId"] as? String==owner}
            for key in ["follows","requests","connections"]{s[key]=filtered(s[key]){x,_ in [x["senderId"] as? String,x["recipientId"] as? String].contains(owner)}}
            s["friendships"]=filtered(s["friendships"]){x,_ in (x["users"] as? [String] ?? []).contains(owner)}
            for key in ["feedback","reports"]{s[key]=filtered(s[key]){x,_ in x["ownerId"] as? String==owner}}
            for key in ["preferences","operations","eventReads","dismissedEvents"]{s[key]=filtered(s[key]){_,k in k==owner||k.hasPrefix(owner+":")}}
            var profiles=object(s["profiles"]);profiles.removeValue(forKey:owner);s["profiles"]=profiles;state["social"]=s
        }
        var rt=object(state["realtime"])
        if !rt.isEmpty {
            rt["calls"]=filtered(rt["calls"]){x,_ in x["ownerId"] as? String==owner}.mapValues{raw in var x=object(raw);if x["peerId"] as? String==owner&&x["state"] as? String != "ended"{x["state"]="ended";x["reason"]="blocked";x["endedAt"]=ISO8601DateFormatter().string(from:Date())};return x}
            rt["language"]=filtered(rt["language"]){x,_ in let id=x["entityId"] as? String ?? "";return x["ownerId"] as? String==owner||removedMessages.contains(id)||removedPosts.contains(id)||removedComments.contains(id)};state["realtime"]=rt
        }
        var p=object(state["personal"]),prefs=object(p["preferences"]);prefs.removeValue(forKey:owner);p["preferences"]=prefs;p["feedback"]=filtered(p["feedback"]){x,_ in x["ownerId"] as? String==owner};p["operations"]=filtered(p["operations"]){_,k in k.hasPrefix(owner+":")};state["personal"]=p
        state["commits"]=filtered(state["commits"]){x,_ in x["userId"] as? String==owner};var accounts=object(state["accounts"]),fixtures=object(state["fixtures"]);accounts.removeValue(forKey:owner);fixtures.removeValue(forKey:owner);state["accounts"]=accounts;state["fixtures"]=fixtures;state["session"]=NSNull()
    }
    func personalReferencedMedia(_ state:JSONObject)->Set<String>{
        var ids=Set<String>();let c=content(state)
        for a in object(state["accounts"]).values.map(object){for p in array(object(a["profile"])["photos"]){if let id=p["id"] as? String{ids.insert(id)}}}
        for p in object(c["posts"]).values.map(object){for m in array(p["media"]){if let id=m["id"] as? String{ids.insert(id)}}}
        for x in object(c["collections"]).values.map(object){if let id=x["coverId"] as? String{ids.insert(id)}}
        for x in object(object(state["personal"])["feedback"]).values.map(object){ids.formUnion(x["mediaIds"] as? [String] ?? [])}
        for x in object(object(state["social"])["messages"]).values.map(object){if let id=x["mediaId"] as? String{ids.insert(id)}}
        return ids
    }
    func executePersonal(_ method:String,params:JSONObject)throws->JSONObject {
        var next=snapshot!;try ensurePersonal(&next);try ensureSocial(&next);let string={(key:String) in params[key] as? String ?? ""}
        if method=="deleteAccount",object(object(next["personal"])["deletedReceipts"])[string("commitId")] != nil,currentUser(next)==nil{return ["deleted":true]}
        let viewer=try contentOwner(next)
        if method=="snapshot"{return try personalSnapshot(next)}
        if method=="collection"{var out=try personalSnapshot(next);out["collection"]=try visiblePersonalCollection(next,string("id"),viewer);return out}
        try require(UUID(uuidString:string("commitId")) != nil,"INVALID_ARGUMENT");var personal=object(next["personal"]),ops=object(personal["operations"]),c=content(next);let op=viewer+":"+string("commitId"),payload=String(data:try JSONSerialization.data(withJSONObject:params,options:[.sortedKeys]),encoding:.utf8)!
        if let old=ops[op] as? JSONObject{try require(old["method"] as? String==method&&old["payload"] as? String==payload,"COMMIT_CONFLICT");var out=try personalSnapshot(next);out["resultId"]=old["resultId"] ?? NSNull();return out}
        var garbage=[String](),copied:[URL]=[],deleteURLs:[URL]=[],resultID:String?,deleteAccount=false
        func promote(_ id:String)throws {try require(contentDrafts[string("draftId")]==viewer&&staging[id]?.flow==string("draftId")&&stagedKinds[id]=="image"&&object(c["files"])[id]==nil,"MEDIA_MISSING");try promoteContentMedia(id,viewer:viewer,content:&c,copied:&copied)}
        do {
            switch method {
            case "saveProfile":
                var accounts=object(next["accounts"]),a=object(accounts[viewer]);let old=object(a["profile"]),previous=Set(array(old["photos"]).compactMap{$0["id"] as? String});var profile=try validateProfile(object(params["profile"]),existing:old,sparse:object(a["onboarding"])["version"] as? String=="lanhu-conversation-v1");profile["communityVersion"]=old["communityVersion"]
                profile["avatarFrameId"]=try savedAvatarFrame(next,owner:viewer,raw:object(params["profile"]),previous:old)
                for photo in array(profile["photos"]){let id=photo["id"] as! String;if !previous.contains(id){try promote(id)}}
                let current=Set(array(profile["photos"]).compactMap{$0["id"] as? String});garbage.append(contentsOf:previous.subtracting(current));a["profile"]=profile;accounts[viewer]=a;next["accounts"]=accounts
            case "savePreferences":try require(["purple","pink","orange","cyan"].contains(string("theme")),"INVALID_ARGUMENT");var prefs=object(personal["preferences"]),mine=object(prefs[viewer]);mine["theme"]=string("theme");prefs[viewer]=mine;personal["preferences"]=prefs
            case "saveCollection":
                var all=object(c["collections"]),x=object(all[string("id")]);try require(x["ownerId"] as? String==viewer,"COLLECTION_UNAVAILABLE");let name=string("name").trimmingCharacters(in:.whitespacesAndNewlines),description=string("description").trimmingCharacters(in:.whitespacesAndNewlines);try require(!name.isEmpty&&name.count<=60&&description.count<=300,"INVALID_COLLECTION")
                let cover=string("coverId");if let old=x["coverId"] as? String,old != cover{garbage.append(old)};if !cover.isEmpty&&cover != x["coverId"] as? String{try promote(cover)};x["name"]=name;x["description"]=description;x["coverId"]=cover.isEmpty ? NSNull():cover as Any;x["updatedAt"]=ISO8601DateFormatter().string(from:Date());all[string("id")]=x;c["collections"]=all;resultID=string("id")
            case "collectionPosts":
                var all=object(c["collections"]),x=object(all[string("id")]);try require(x["ownerId"] as? String==viewer,"COLLECTION_UNAVAILABLE");guard let ids=params["postIds"] as? [String],Set(ids).count==ids.count else{throw EluvaError("INVALID_COLLECTION")};try require(ids.allSatisfy{id in let p=object(object(c["posts"])[id]);return p["authorId"] as? String==viewer&&canReadPost(next,p,viewer)},"POST_UNAVAILABLE");x["postIds"]=ids;all[string("id")]=x;c["collections"]=all;resultID=string("id")
            case "deleteCollection":var all=object(c["collections"]);try require(object(all[string("id")])["ownerId"] as? String==viewer,"COLLECTION_UNAVAILABLE");if let cover=object(all[string("id")])["coverId"] as? String{garbage.append(cover)};all.removeValue(forKey:string("id"));c["collections"]=all
            case "deletePost":
                var posts=object(c["posts"]);try require(object(posts[string("id")])["authorId"] as? String==viewer,"POST_UNAVAILABLE");garbage.append(contentsOf:array(object(posts[string("id")])["media"]).compactMap{$0["id"] as? String});posts.removeValue(forKey:string("id"));c["posts"]=posts;c["operations"]=object(c["operations"]).filter{let x=object($0.value);return x["resultId"] as? String != string("id") && x["target"] as? String != string("id")}
                let comments=object(c["comments"]),removed=Set(comments.values.map(object).filter{$0["postId"] as? String==string("id")}.compactMap{$0["id"] as? String});c["comments"]=comments.filter{!removed.contains($0.key)}
                for k in ["echoes","events"]{c[k]=object(c[k]).filter{object($0.value)["postId"] as? String != string("id")}}
                c["collections"]=object(c["collections"]).mapValues{raw in var x=object(raw);x["postIds"]=(x["postIds"] as? [String] ?? []).filter{$0 != string("id")};return x}
                if next["realtime"] != nil {var rt=object(next["realtime"]);rt["language"]=object(rt["language"]).filter{let id=object($0.value)["entityId"] as? String ?? "";return id != string("id") && !removed.contains(id)};next["realtime"]=rt}
            case "submitFeedback":
                let body=string("body").trimmingCharacters(in:.whitespacesAndNewlines);try require(!body.isEmpty&&body.count<=(personalPolicy["feedbackLimit"] as? Int ?? 2000)&&["lag","crash","payment","other"].contains(string("topic")),"INVALID_FEEDBACK");guard let ids=params["mediaIds"] as? [String],ids.count<=(personalPolicy["feedbackImages"] as? Int ?? 3),Set(ids).count==ids.count else{throw EluvaError("INVALID_MEDIA")};for id in ids{try promote(id)};let id=UUID().uuidString.lowercased();var all=object(personal["feedback"]);all[id]=["id":id,"ownerId":viewer,"body":body,"topic":string("topic"),"mediaIds":ids,"localOnly":true,"createdAt":ISO8601DateFormatter().string(from:Date())];personal["feedback"]=all;resultID=id
            case "deleteAccount":
                let a=currentUser(next)!;try require(a["isTest"] as? Bool != true,"TEST_ACCOUNT_READ_ONLY");try require(params["confirmed"] as? Bool==true&&string("confirmEmail").trimmingCharacters(in:.whitespacesAndNewlines).lowercased()==a["email"] as? String,"DELETE_CONFIRMATION_REQUIRED")
                let files=object(c["files"]);for (id,raw) in files where object(raw)["ownerId"] as? String==viewer{let ext=object(raw)["extension"] as? String ?? "";if let url=try? checkedMediaFile(root.appendingPathComponent("Media").appendingPathComponent(id+"."+ext),folder:"Media"){deleteURLs.append(url)}}
                for p in array(object(a["profile"])["photos"]){if let id=p["id"] as? String,let url=try? checkedMediaFile(root.appendingPathComponent("Media").appendingPathComponent(id+".jpg"),folder:"Media"){deleteURLs.append(url)}}
                try removeCommerceAccount(&next,viewer);removePersonalAccount(&next,viewer);personal=object(next["personal"]);var receipts=object(personal["deletedReceipts"]);receipts[string("commitId")]=["userId":viewer];personal["deletedReceipts"]=receipts;deleteAccount=true
            default:throw EluvaError("METHOD_NOT_FOUND")
            }
            if !deleteAccount{next["content"]=c;next["personal"]=personal;let used=personalReferencedMedia(next);var files=object(c["files"]);for id in garbage where !used.contains(id){let f=object(files[id]);if f.isEmpty || f["ownerId"] as? String==viewer{let ext=f["extension"] as? String ?? "jpg";if let url=try? checkedMediaFile(root.appendingPathComponent("Media").appendingPathComponent(id+"."+ext),folder:"Media"){deleteURLs.append(url)};files.removeValue(forKey:id)}};c["files"]=files}
            if !deleteAccount{ops[op]=["method":method,"payload":payload,"resultId":resultID as Any? ?? NSNull()];personal["operations"]=ops;next["content"]=c};next["personal"]=personal;try persist(next)
        }catch{copied.forEach{try? FileManager.default.removeItem(at:$0)};throw (error as? EluvaError) ?? EluvaError("STORAGE_FAILED")}
        if deleteAccount{clearPersonalRuntime();var pending=false;for url in Set(deleteURLs){do{if FileManager.default.fileExists(atPath:url.path){try FileManager.default.removeItem(at:url)}}catch{pending=true}};return ["deleted":true,"cleanupPending":pending]}
        for url in Set(deleteURLs){try? FileManager.default.removeItem(at:url)}
        var out=try personalSnapshot(next);if let resultID{out["resultId"]=resultID};return out
    }
}

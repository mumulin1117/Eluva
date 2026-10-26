import Foundation

extension LocalRepository {
    func upgradePresentation(_ state:inout JSONObject)throws {
        let copy=object(try suppliedDemoConfiguration()["presentation"]),version=copy["version"] as? Int ?? 1
        if (state["presentationVersion"] as? Int ?? 0)>=version{return}
        let migrateCopy=(state["presentationVersion"] as? Int ?? 0)<1
        var accounts=object(state["accounts"]),account=object(accounts[Self.testID]),profile=object(account["profile"])
        if migrateCopy && account["isTest"] as? Bool==true && profile["displayName"] as? String=="Eluva Demo"{profile["displayName"]=copy["accountName"];account["profile"]=profile;accounts[Self.testID]=account;state["accounts"]=accounts}
        let old="A small hello from the local demo.",greeting=object(copy["greeting"])
        var social=object(state["social"]),messages=object(social["messages"])
        // Only the two exact bundled placeholders are retired; recordings keep their IDs and files.
        for name in ["echo","notes"] {
            let id=Self.testID+":"+name+"-voice",voice=object(messages[id])
            if voice["demo"] as? Bool==true && voice["kind"] as? String=="voice" && voice["mediaId"]==nil && voice["asset"] as? String=="demo/local-voice.wav" && voice["threadId"] as? String=="demo-thread-"+name && voice["senderId"] as? String==Self.testID && voice["recipientId"] as? String=="demo-friend-"+name{messages.removeValue(forKey:id)}
        }
        for name in ["echo","notes"]{let id=Self.testID+":"+name+"-text";var message=object(messages[id]);if migrateCopy && message["demo"] as? Bool==true && message["body"] as? String==old{message["body"]=greeting["en"];message["translations"]=greeting;messages[id]=message}}
        if state["social"] != nil{var requests=object(social["requests"]),request=object(requests["demo-request-in"]);if migrateCopy && request["demo"] as? Bool==true && request["body"] as? String=="Your quiet-day post resonated with me. Would you like to say hello?"{request["body"]=object(try suppliedDemoConfiguration()["requestText"])["demo-request-in"];requests["demo-request-in"]=request};social["requests"]=requests;social["messages"]=messages;state["social"]=social}
        var fixtures=object(state["fixtures"]),fixture=object(fixtures[Self.testID]),threads=array(fixture["threads"])
        let people=try suppliedDemoList("social-demo")
        for i in threads.indices{
            if migrateCopy && (object(threads[i]["title"])["en"] as? String)?.hasPrefix("Local demo ")==true,let person=people.first(where:{$0["id"] as? String==threads[i]["participantId"] as? String}),let name=person["displayName"]{threads[i]["title"]=["en":name,"fr":name]}
            var rows=array(threads[i]["messages"])
            let threadID=threads[i]["id"] as? String,peerID=threads[i]["participantId"] as? String
            for name in ["echo","notes"] {
                guard threadID=="demo-thread-"+name,peerID=="demo-friend-"+name else{continue}
                let retiredID=name+"-voice"
                rows.removeAll { row -> Bool in
                    guard row["id"] as? String==retiredID else{return false}
                    guard row["kind"] as? String=="voice",row["mediaId"]==nil else{return false}
                    guard row["asset"] as? String=="demo/local-voice.wav" else{return false}
                    return row["sentByMe"] as? Bool==true
                }
            }
            for j in rows.indices{if migrateCopy && rows[j]["kind"] as? String=="text" && object(rows[j]["body"])["en"] as? String==old{rows[j]["body"]=greeting}}
            threads[i]["messages"]=rows
        }
        if fixtures[Self.testID] != nil{fixture["threads"]=threads;fixtures[Self.testID]=fixture;state["fixtures"]=fixtures}
        try upgradeDemoChatPeers(&state)
        state["presentationVersion"]=version
    }
    // Move only shipped chat fixtures. Real conversations retain their participants.
    private func upgradeDemoChatPeers(_ state:inout JSONObject)throws {
        guard object(object(state["accounts"])[Self.testID])["isTest"] as? Bool==true else{return}
        let config=try suppliedDemoConfiguration(),people=try suppliedDemoList("social-demo"),stamp="2026-10-17T08:00:00.000Z"
        var fixtures=object(state["fixtures"]),fixture=object(fixtures[Self.testID]),social=object(state["social"])
        var threads=object(social["threads"]),messages=object(social["messages"]),friendships=object(social["friendships"]),follows=object(social["follows"])
        let connections=object(social["connections"]),requests=object(social["requests"]).values.map(object),calls=object(object(state["realtime"])["calls"]).values.map(object)
        for item in array(config["conversations"]) {
            guard let peer=item["peerId"] as? String,let oldPeer=item["legacyPeerId"] as? String,
                  let threadID=item["threadId"] as? String,let oldThreadID=item["legacyThreadId"] as? String,
                  let greetingID=item["greetingId"] as? String,let contextID=item["messageId"] as? String else{continue}
            let oldPair=socialPair(Self.testID,oldPeer),newPair=socialPair(Self.testID,peer)
            if fixtures[Self.testID] != nil {
                var seen=Set<String>()
                fixture["friends"]=(fixture["friends"] as? [String] ?? []).map{$0==oldPeer ? peer:$0}.filter{seen.insert($0).inserted}
                var rows=array(fixture["threads"])
                for i in rows.indices where rows[i]["id"] as? String==oldThreadID && rows[i]["participantId"] as? String==oldPeer {
                    rows[i]["id"]=threadID;rows[i]["participantId"]=peer
                    if let name=people.first(where:{$0["id"] as? String==peer})?["displayName"]{rows[i]["title"]=["en":name,"fr":name]}
                }
                fixture["threads"]=rows
            }
            let oldThread=object(threads[oldThreadID]),users=oldThread["users"] as? [String] ?? []
            guard oldThread["createdAt"] as? String==stamp,users.count==2,users.contains(Self.testID),users.contains(oldPeer) else{continue}
            let rows=messages.values.map(object).filter{$0["threadId"] as? String==oldThreadID}
            let shipped=rows.filter { row in
                guard row["demo"] as? Bool==true,row["kind"] as? String=="text",row["mediaId"]==nil,
                      row["senderId"] as? String==oldPeer,row["recipientId"] as? String==Self.testID else{return false}
                let greeting=object(object(config["presentation"])["greeting"])
                let isGreeting=row["id"] as? String==Self.testID+":"+greetingID && row["createdAt"] as? String==stamp && row["body"] as? String==greeting["en"] as? String
                let isContext=row["id"] as? String==Self.testID+":"+contextID && row["createdAt"] as? String==item["createdAt"] as? String && row["body"] as? String==item["legacyBody"] as? String
                return isGreeting || isContext
            }
            let hasUserHistory=rows.count != shipped.count || connections[oldPair] != nil || requests.contains{$0["pair"] as? String==oldPair} || calls.contains{call in
                let users=[call["ownerId"] as? String,call["peerId"] as? String]
                return users.contains(Self.testID) && users.contains(oldPeer)
            }
            let existing=threads.values.map(object).first{$0["pair"] as? String==newPair}
            let targetHasRelationship=existing != nil || friendships[newPair] != nil || follows[Self.testID+":"+peer] != nil || follows[peer+":"+Self.testID] != nil || connections[newPair] != nil || requests.contains{$0["pair"] as? String==newPair}
            var target=existing ?? oldThread
            if existing==nil{target["id"]=threadID;target["pair"]=newPair;target["users"]=[Self.testID,peer]}
            guard let targetID=target["id"] as? String else{continue}
            threads[targetID]=target
            for var message in shipped {
                guard let id=message["id"] as? String else{continue}
                message["threadId"]=targetID;message["senderId"]=peer
                if id==Self.testID+":"+contextID{let text=object(item["text"]);message["body"]=text["en"];message["translations"]=text}
                messages[id]=message
            }
            if !hasUserHistory {
                threads.removeValue(forKey:oldThreadID)
                var friendship=object(friendships[oldPair])
                if friendship["createdAt"] as? String==stamp {
                    if !targetHasRelationship{friendship["id"]=newPair;friendship["users"]=[Self.testID,peer];friendships[newPair]=friendship}
                    friendships.removeValue(forKey:oldPair)
                }
                for (a,b) in [(Self.testID,oldPeer),(oldPeer,Self.testID)] {
                    let key=a+":"+b,sender=a==oldPeer ? peer:a,recipient=b==oldPeer ? peer:b
                    var follow=object(follows[key])
                    if follow["createdAt"] as? String==stamp {
                        if !targetHasRelationship{follow["senderId"]=sender;follow["recipientId"]=recipient;follows[sender+":"+recipient]=follow}
                        follows.removeValue(forKey:key)
                    }
                }
            } else if !targetHasRelationship {
                friendships[newPair]=["id":newPair,"users":[Self.testID,peer],"createdAt":stamp]
                for (a,b) in [(Self.testID,peer),(peer,Self.testID)]{follows[a+":"+b]=["senderId":a,"recipientId":b,"createdAt":stamp]}
            }
        }
        if fixtures[Self.testID] != nil{fixtures[Self.testID]=fixture;state["fixtures"]=fixtures}
        if state["social"] != nil{social["threads"]=threads;social["messages"]=messages;social["friendships"]=friendships;social["follows"]=follows;state["social"]=social}
    }
    func suppliedDemoList(_ name:String)throws->[JSONObject] {
        guard let url=EncryptedWebResources.shared.url(forResource:name,withExtension:"json",subdirectory:"config"),
              let data=try? Data(contentsOf:url),let rows=try? JSONSerialization.jsonObject(with:data) as? [JSONObject]
        else{throw EluvaError("RESOURCE_MISSING")}
        return rows
    }
    func suppliedDemoConfiguration()throws->JSONObject {
        guard let url=EncryptedWebResources.shared.url(forResource:"demo-fixtures",withExtension:"json",subdirectory:"config"),
              let data=try? Data(contentsOf:url),let value=try? JSONSerialization.jsonObject(with:data) as? JSONObject,
              (value["version"] as? Int ?? 0)>0 else{throw EluvaError("RESOURCE_MISSING")}
        return value
    }
    func upgradeSuppliedDemoContent(_ state:inout JSONObject)throws {
        guard var c=state["content"] as? JSONObject else{return}
        let version=try suppliedDemoConfiguration()["version"] as! Int
        if (c["fixtureVersion"] as? Int ?? 0)>=version{return}
        var posts=object(c["posts"])
        for var post in try suppliedDemoList("content-demo") {
            guard let id=post["id"] as? String else{continue}
            let old=object(posts[id]);if !old.isEmpty && old["demoScope"] as? String != Self.testID{continue}
            if let deleted=old["deletedAt"]{post["deletedAt"]=deleted}
            posts[id]=post
        }
        c["posts"]=posts;c["fixtureVersion"]=version;state["content"]=c
    }
    func upgradeSuppliedDemoSocial(_ state:inout JSONObject)throws {
        var s=object(state["social"]);let config=try suppliedDemoConfiguration(),version=config["version"] as! Int
        if (s["fixtureVersion"] as? Int ?? 0)>=version{return}
        var profiles=object(s["profiles"]),messages=object(s["messages"]),requests=object(s["requests"])
        for var p in try suppliedDemoList("social-demo") {
            guard let id=p["id"] as? String else{continue};let old=object(profiles[id])
            if old.isEmpty || old["demo"] as? Bool==true{p["demo"]=true;profiles[id]=p}
        }
        let blocks=object(object(state["content"])["blocks"]),threads=object(s["threads"])
        for row in array(config["conversations"]) {
            guard let peer=row["peerId"] as? String,let threadID=row["threadId"] as? String,let mid=row["messageId"] as? String else{continue}
            let id=Self.testID+":"+mid,thread=object(threads[threadID]),users=thread["users"] as? [String] ?? []
            if !users.contains(Self.testID) || !users.contains(peer) || messages[id] != nil || blocks[Self.testID+":"+peer] as? Bool==true || blocks[peer+":"+Self.testID] as? Bool==true{continue}
            let text=object(row["text"])
            messages[id]=["id":id,"threadId":threadID,"senderId":peer,"recipientId":Self.testID,"kind":"text","body":text["en"] ?? "","translations":text,"createdAt":row["createdAt"] ?? "2026-10-18T12:00:00.000Z","readAt":NSNull(),"demo":true]
        }
        let oldText=["demo-request-in":"A hello from the local request demo.","demo-request-out":"A local introduction waiting for a decision."]
        for (id,body) in object(config["requestText"]) {var request=object(requests[id]);if request["demo"] as? Bool==true && request["body"] as? String==oldText[id]{request["body"]=body;requests[id]=request}}
        s["profiles"]=profiles;s["messages"]=messages;s["requests"]=requests;s["fixtureVersion"]=version;state["social"]=s
    }
    // Only a canonical bundled fixture can provide a static asset reference.
    func suppliedDemoPhotoAsset(_ peer:String,_ photo:String)->String? {
        guard let profile=(try? suppliedDemoList("social-demo"))?.first(where:{$0["id"] as? String==peer}) else{return nil}
        return array(profile["photos"]).first{$0["id"] as? String==photo}?["asset"] as? String
    }
}

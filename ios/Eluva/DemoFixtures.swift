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
        state["presentationVersion"]=version
    }
    func suppliedDemoList(_ name:String)throws->[JSONObject] {
        guard let url=Bundle.main.url(forResource:name,withExtension:"json",subdirectory:"Web/config"),
              let data=try? Data(contentsOf:url),let rows=try? JSONSerialization.jsonObject(with:data) as? [JSONObject]
        else{throw EluvaError("RESOURCE_MISSING")}
        return rows
    }
    func suppliedDemoConfiguration()throws->JSONObject {
        guard let url=Bundle.main.url(forResource:"demo-fixtures",withExtension:"json",subdirectory:"Web/config"),
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

import Foundation
import AVFoundation

struct SympathyAlignment {
    let owner: String, type: String, id: String, original: String, fingerprint: String
    let audioURL: URL?
}

extension EmpathyOrientation {
    func ensureRealtime(_ state: inout JSONObject) throws {
        if state["realtime"] == nil { state["realtime"] = ["version":1,"calls":JSONObject(),"language":JSONObject()] }
        guard let r=state["realtime"] as? JSONObject,r["version"] as? Int==1,r["calls"] is JSONObject,r["language"] is JSONObject else { throw EluvaError("STORAGE_CORRUPT") }
    }
    var realtimePolicy: JSONObject {
        guard let url=CognitiveFlexibility.shared.url(forResource:"realtime-policy",withExtension:"json",subdirectory:"config"),let data=try? Data(contentsOf:url),let value=try? JSONSerialization.jsonObject(with:data) as? JSONObject else { return [:] }
        return value
    }
    func voiceDuration(_ url:URL) throws -> Double {
        let policy=realtimePolicy
        guard let min=policy["voiceMinSeconds"] as? Double,let max=policy["voiceMaxSeconds"] as? Double,let bytes=policy["voiceMaxBytes"] as? Int else {throw EluvaError("RESOURCE_MISSING")}
        try require((try? url.resourceValues(forKeys:[.fileSizeKey]).fileSize) ?? Int.max <= bytes,"MEDIA_TOO_LARGE")
        guard let audio=try? AVAudioFile(forReading:url),audio.processingFormat.sampleRate>0,audio.length>0,audio.processingFormat.channelCount<=2 else {throw EluvaError("MEDIA_UNSUPPORTED")}
        let duration=Double(audio.length)/audio.processingFormat.sampleRate
        try require(duration>=min,"RECORDING_TOO_SHORT");try require(duration<=max+(url.pathExtension.lowercased()=="m4a" ? 0.1:0),"RECORDING_TOO_LONG");return Swift.min(duration,max)
    }
    // Called with a recorder-owned temporary file, on repository.queue.
    func stageVoice(_ url:URL,draftID:String) throws -> JSONObject {
        try validateMediaFlow(draftID);guard let draft=socialDrafts[draftID] else {throw EluvaError("DRAFT_EXPIRED")}
        try requireSocialPeer(snapshot!,draft.owner,draft.peer,friend:true)
        let duration=try voiceDuration(url),ext=url.pathExtension.lowercased();try require(["m4a","wav"].contains(ext),"MEDIA_UNSUPPORTED")
        let id=UUID().uuidString.lowercased(),target=root.appendingPathComponent("Staging").appendingPathComponent(id+"."+ext)
        do {try FileManager.default.copyItem(at:url,to:target);try FileManager.default.setAttributes([.protectionKey:FileProtectionType.complete],ofItemAtPath:target.path)}catch{try? FileManager.default.removeItem(at:target);throw EluvaError("STORAGE_FAILED")}
        staging[id]=(draftID,target);stagedKinds[id]="voice"
        return ["id":id,"url":"eluva://media/"+id,"kind":"voice","duration":duration]
    }
    func readableMessage(_ state:JSONObject,_ id:String,_ viewer:String) throws -> JSONObject {
        let m=object(object(object(state["social"])["messages"])[id])
        try require([m["senderId"] as? String,m["recipientId"] as? String].contains(viewer),"MESSAGE_UNAVAILABLE")
        let peer=m["senderId"] as? String==viewer ? m["recipientId"] as? String ?? "":m["senderId"] as? String ?? ""
        try requireSocialPeer(state,viewer,peer,friend:true);return m
    }
    func voiceURL(_ state:JSONObject,_ id:String,_ viewer:String) throws -> URL {
        let m=try readableMessage(state,id,viewer);try require(m["kind"] as? String=="voice","INVALID_ARGUMENT")
        if let media=m["mediaId"] as? String{return try mediaURL(media)}
        try require(m["demo"] as? Bool==true && m["asset"] as? String=="demo/local-voice.wav","MEDIA_MISSING")
        guard let url=CognitiveFlexibility.shared.url(forResource:"local-voice",withExtension:"wav",subdirectory:"demo")else{throw EluvaError("MEDIA_MISSING")};return url
    }
    func languageKey(_ owner:String,_ type:String,_ id:String,_ kind:String,_ lang:String)->String {[owner,type,id,kind,lang].joined(separator:":")}
    func languageSubject(_ params:JSONObject,transcript:Bool=false) throws -> SympathyAlignment {
        try prepare();var state=snapshot!;let viewer=try contentOwner(state);try ensureSocial(&state);try ensureRealtime(&state)
        let type=params["type"] as? String ?? "",id=params["id"] as? String ?? "",source=params["source"] as? String ?? "en"
        if type=="message" {
            let m=try readableMessage(state,id,viewer)
            if transcript {return SympathyAlignment(owner:viewer,type:type,id:id,original:"",fingerprint:m["mediaId"] as? String ?? m["asset"] as? String ?? "",audioURL:try voiceURL(state,id,viewer))}
            var text=m["body"] as? String ?? ""
            if m["kind"] as? String=="voice" {
                let row=object(object(object(state["realtime"])["language"])[languageKey(viewer,type,id,"transcript",source)])
                try require(row["fingerprint"] as? String==(m["mediaId"] as? String ?? m["asset"] as? String),"TRANSCRIPT_REQUIRED");text=row["text"] as? String ?? ""
            }
            try require(!text.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty,"NO_TEXT")
            return SympathyAlignment(owner:viewer,type:type,id:id,original:text,fingerprint:text,audioURL:nil)
        }
        try require(["post","comment"].contains(type),"INVALID_ARGUMENT")
        let c=content(state),item=object(object(c[type=="post" ? "posts":"comments"])[id]),post=type=="post" ? item:object(object(c["posts"])[item["postId"] as? String ?? ""])
        try require(!item.isEmpty&&canReadPost(state,post,viewer) && !socialBlocked(state,viewer,item["authorId"] as? String ?? ""),"POST_UNAVAILABLE")
        let text=item["body"] as? String ?? "";try require(!text.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty,"NO_TEXT")
        return SympathyAlignment(owner:viewer,type:type,id:id,original:text,fingerprint:text,audioURL:nil)
    }
    func saveLanguage(_ subject:SympathyAlignment,text:String,kind:String,source:String,target:String) throws -> JSONObject {
        try require(source.range(of:#"^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$"#,options:.regularExpression) != nil && source.count<=35 && ["en","fr"].contains(target)&&["transcript","translation"].contains(kind),"INVALID_ARGUMENT")
        try require(!text.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty&&text.count<=20000,"LANGUAGE_FAILED")
        let fresh=try languageSubject(["type":subject.type,"id":subject.id,"source":source],transcript:kind=="transcript")
        try require(fresh.owner==subject.owner&&fresh.fingerprint==subject.fingerprint,"CONTENT_CHANGED")
        var state=snapshot!;try ensureRealtime(&state);var r=object(state["realtime"]),rows=object(r["language"])
        let row:JSONObject=["ownerId":subject.owner,"type":subject.type,"entityId":subject.id,"kind":kind,"source":source,"target":target,"original":subject.original,"fingerprint":subject.fingerprint,"text":text,"provider":kind=="transcript" ? "apple-on-device-speech":source==target ? "same-language":"apple-translation","createdAt":ISO8601DateFormatter().string(from:Date())]
        rows[languageKey(subject.owner,subject.type,subject.id,kind,kind=="transcript" ? source:target)]=row;r["language"]=rows;state["realtime"]=r;try persist(state);return ["row":row]
    }
    func ownedCall(_ id:String) throws -> JSONObject {
        try prepare();let viewer=try contentOwner(snapshot!),c=object(object(object(snapshot!["realtime"])["calls"])[id]);try require(c["ownerId"] as? String==viewer,"CALL_UNAVAILABLE");return c
    }
    func validateCall(_ id:String) throws -> JSONObject {let c=try ownedCall(id);try requireSocialPeer(snapshot!,c["ownerId"] as! String,c["peerId"] as! String,friend:true);try require(c["state"] as? String != "ended" && callLeases.contains(id),"CALL_ENDED");return c}
    func activateCameraCall(_ id:String) throws -> JSONObject {return try updateCall(id,mode:"camera")}
    func updateCall(_ id:String,mode:String) throws -> JSONObject {
        var c=try validateCall(id);c["state"]="active";c["mode"]=mode;if c["startedAt"]==nil{c["startedAt"]=ISO8601DateFormatter().string(from:Date())}
        var state=snapshot!,r=object(state["realtime"]),all=object(r["calls"]);all[id]=c;r["calls"]=all;state["realtime"]=r;try persist(state);return ["call":c]
    }
    func finishCall(_ id:String,owner:String?=nil,reason:String) throws -> JSONObject {
        try prepare();var state=snapshot!;let viewer=try owner ?? contentOwner(state),c0=object(object(object(state["realtime"])["calls"])[id]);try require(c0["ownerId"] as? String==viewer,"CALL_UNAVAILABLE")
        try require(["hangup","declined","cancelled","background","blocked","interrupted","failed","left","logout","timeout"].contains(reason),"INVALID_ARGUMENT")
        var c=c0;if c["state"] as? String != "ended" {c["state"]="ended";c["reason"]=reason;c["endedAt"]=ISO8601DateFormatter().string(from:Date());var r=object(state["realtime"]),all=object(r["calls"]);all[id]=c;r["calls"]=all;state["realtime"]=r;try persist(state)}
        callLeases.remove(id);return ["call":c]
    }
    func executeRealtime(_ method:String,params:JSONObject) throws -> JSONObject {
        var state=snapshot!;let viewer=try contentOwner(state);try ensureSocial(&state);try ensureRealtime(&state)
        let value={(key:String) in params[key] as? String ?? ""}
        if method=="languageSnapshot" {
            let subject=try languageSubject(params,transcript:params["voice"] as? Bool==true)
            let all=object(object(state["realtime"])["language"]).values.map(object).filter{$0["ownerId"] as? String==viewer && $0["type"] as? String==subject.type && $0["entityId"] as? String==subject.id},source=value("source").isEmpty ? "en":value("source"),voice=params["voice"] as? Bool==true
            let transcript=all.first{$0["kind"] as? String=="transcript" && $0["source"] as? String==source && $0["fingerprint"] as? String==subject.fingerprint}
            let rows=all.filter{row in row["kind"] as? String=="transcript" ? row["source"] as? String==source && row["fingerprint"] as? String==subject.fingerprint:row["fingerprint"] as? String==(voice ? transcript?["text"] as? String:subject.fingerprint)}
            return ["rows":rows]
        }
        if method=="call" {let c=try ownedCall(value("callId"));try require(value("peerId").isEmpty||c["peerId"] as? String==value("peerId"),"CALL_UNAVAILABLE");if c["state"] as? String != "ended" && !callLeases.contains(value("callId")){return try finishCall(value("callId"),reason:"interrupted")};return ["call":c]}
        if method=="endCall" {return try finishCall(value("callId"),reason:value("reason"))}
        guard method=="createCall" else {throw EluvaError("METHOD_NOT_FOUND")}
        let id=value("callId"),peer=value("peerId"),direction=value("direction");try require(UUID(uuidString:id) != nil && direction=="outgoing","INVALID_ARGUMENT");try requireSocialPeer(state,viewer,peer,friend:true)
        var r=object(state["realtime"]),all=object(r["calls"])
        if let c=all[id] as? JSONObject{try require(c["ownerId"] as? String==viewer&&c["peerId"] as? String==peer&&c["direction"] as? String==direction,"COMMIT_CONFLICT");return ["call":c]}
        let now=ISO8601DateFormatter().string(from:Date())
        for (key,var old) in all.mapValues(object) where old["ownerId"] as? String==viewer && old["state"] as? String != "ended" {try require(!callLeases.contains(key),"CALL_BUSY");old["state"]="ended";old["reason"]="interrupted";old["endedAt"]=now;all[key]=old}
        let c:JSONObject=["id":id,"ownerId":viewer,"peerId":peer,"direction":direction,"state":"ready","localOnly":true,"createdAt":now];all[id]=c;r["calls"]=all;state["realtime"]=r;try persist(state);callLeases.insert(id);return ["call":c]
    }
}

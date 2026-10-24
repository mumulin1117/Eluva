import UIKit
import AVFoundation

final class MediaCancellation: @unchecked Sendable {
    private let lock=NSLock(); private var value=false
    var cancelled:Bool {lock.lock();defer{lock.unlock()};return value}
    func cancel(){lock.lock();value=true;lock.unlock()}
}
final class VoicePermissionLease {
    let request: String?, owner: String?, peer: String?, draft: String?
    let cancellation = MediaCancellation()
    var completion: ((Result<JSONObject, Error>) -> Void)?
    init(request: String?, owner: String?, peer: String?, draft: String?, completion: @escaping (Result<JSONObject, Error>) -> Void) {
        self.request = request; self.owner = owner; self.peer = peer; self.draft = draft; self.completion = completion
    }
}
final class RealtimeMediaCoordinator:NSObject,AVAudioPlayerDelegate,AVAudioRecorderDelegate {
    weak var host:WebViewController?
    let repository:LocalRepository
    var recorder:AVAudioRecorder?, recordingID:String?, recordingRequest:String?,recordingOwner:String?,recordingDraft:String?,recordingPeer:String?,recordingURL:URL?,recordingBegan:TimeInterval=0
    var recordingCancellation:MediaCancellation?
    var player:AVAudioPlayer?,playbackID:String?,playbackMessage:String?,playbackOwner:String?,playbackRequest:String?
    var video:VideoCaptureLease?
    var videoPermission:VideoPermissionLease?
    var voicePermission: VoicePermissionLease?
  
    let videoQueue=DispatchQueue(label:"com.eluva.video",qos:.userInitiated)
    var audioEngine:AVAudioEngine?
    var lastReason="cancelled",recordingMax:Double=60
    var recordStopPending=false
    var interruptedObserver:NSObjectProtocol?
    init(host:WebViewController,repository:LocalRepository){self.host=host;self.repository=repository;super.init();interruptedObserver=NotificationCenter.default.addObserver(forName:AVAudioSession.interruptionNotification,object:nil,queue:.main){[weak self] note in if let n=note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,n==AVAudioSession.InterruptionType.began.rawValue{self?.cancelAll(reason:"interrupted")}}}
    func microphoneStatus()->String {
      
        switch AVAudioApplication.shared.recordPermission{case .granted:return "authorized";case .denied:return "denied";case .undetermined:return "notDetermined";@unknown default:return "unsupported"}
    }
    func permissions()->JSONObject {let camera:String;switch AVCaptureDevice.authorizationStatus(for:.video){case .authorized:camera="authorized";case .notDetermined:camera="notDetermined";case .denied:camera="denied";case .restricted:camera="restricted";@unknown default:camera="unsupported"};return ["microphone":microphoneStatus(),"camera":camera,"environment":"ios"]}
    func requestPermission(_ kind:String,owner:String? = nil,peer:String? = nil,draft:String? = nil,request:String? = nil,valid:@escaping @Sendable ()->Bool,completion:@escaping(Result<JSONObject,Error>)->Void){
        guard kind=="microphone" else{completion(.failure(EluvaError("INVALID_ARGUMENT")));return}
        guard valid(),UIApplication.shared.applicationState != .background else{completion(.failure(EluvaError("CANCELLED")));return}
        guard voicePermission==nil,recorder==nil,recordingCancellation==nil,video==nil,videoPermission==nil else{completion(.failure(EluvaError("MEDIA_BUSY")));return}
        switch microphoneStatus() {
        case "authorized": completion(.success(["status":"authorized","requiresNewGesture":true])); return
        case "denied": completion(.failure(EluvaError("PERMISSION_DENIED"))); return
        case "restricted": completion(.failure(EluvaError("PERMISSION_RESTRICTED"))); return
        case "notDetermined": break
        default: completion(.failure(EluvaError("DEVICE_UNSUPPORTED"))); return
        }
        let lease = VoicePermissionLease(request: request, owner: owner, peer: peer, draft: draft, completion: completion)
        voicePermission = lease
        let received: (Bool) -> Void = { [weak self] granted in DispatchQueue.main.async {
            guard let self else { return }
            guard self.voicePermission===lease,!lease.cancellation.cancelled,valid(),UIApplication.shared.applicationState != .background else {
                self.finishVoicePermission(lease, result: .failure(EluvaError("CANCELLED"))); return
            }
            guard granted else { self.finishVoicePermission(lease, result: .failure(EluvaError("PERMISSION_DENIED"))); return }
            // Permission is not a capture gesture. Recheck the draft after the system alert,
            // then let H5 ask for a fresh hold before starting the recorder.
            guard let draft = lease.draft else {
                self.finishVoicePermission(lease, result: .success(["status":"authorized","requiresNewGesture":true])); return
            }
            self.repository.queue.async {
                do {
                    try self.repository.validateMediaFlow(draft)
                    let context = self.repository.socialDrafts[draft]
                    try require(context?.owner==lease.owner && context?.peer==lease.peer,"DRAFT_EXPIRED")
                    DispatchQueue.main.async {
                        guard self.voicePermission===lease,!lease.cancellation.cancelled,valid(),UIApplication.shared.applicationState != .background else {
                            self.finishVoicePermission(lease, result: .failure(EluvaError("CANCELLED"))); return
                        }
                        self.finishVoicePermission(lease, result: .success(["status":"authorized","requiresNewGesture":true]))
                    }
                } catch { DispatchQueue.main.async { self.finishVoicePermission(lease, result: .failure(error)) } }
            }
        } }
      
        AVAudioApplication.requestRecordPermission(completionHandler: received)
    }
    private func finishVoicePermission(_ lease: VoicePermissionLease, result: Result<JSONObject, Error>) {
        if voicePermission===lease { voicePermission=nil }
        let completion=lease.completion;lease.completion=nil;completion?(result)
    }
    func cancelVoicePermission() {
        guard let lease=voicePermission else{return}
        lease.cancellation.cancel();finishVoicePermission(lease,result:.failure(EluvaError("CANCELLED")))
    }
    func recordStart(_ p:JSONObject,owner:String,request:String,valid:@escaping @Sendable ()->Bool,completion:@escaping(Result<JSONObject,Error>)->Void){
        guard valid(),UIApplication.shared.applicationState != .background else{completion(.failure(EluvaError("CANCELLED")));return}
        guard recorder==nil&&recordingCancellation==nil&&video==nil&&videoPermission==nil&&voicePermission==nil else{completion(.failure(EluvaError("MEDIA_BUSY")));return}
        let microphone = microphoneStatus()
        guard microphone=="authorized" else{completion(.failure(EluvaError(["denied":"PERMISSION_DENIED","restricted":"PERMISSION_RESTRICTED","notDetermined":"PERMISSION_REQUIRED"][microphone] ?? "DEVICE_UNSUPPORTED")));return}
        guard let id=p["recordingId"] as? String,UUID(uuidString:id) != nil,let draft=p["draftId"] as? String,let peer=p["peerId"] as? String else{completion(.failure(EluvaError("INVALID_ARGUMENT")));return}
        let token=MediaCancellation();recordingCancellation=token;recordingID=id;recordingRequest=request;recordingOwner=owner;recordingDraft=draft;recordingPeer=peer
        repository.queue.async{[weak self] in guard let self else{return};do{try self.repository.validateMediaFlow(draft);guard let context=self.repository.socialDrafts[draft],context.peer==peer&&context.owner==owner else{throw EluvaError("DRAFT_EXPIRED")};guard let max=self.repository.realtimePolicy["voiceMaxSeconds"] as? Double else{throw EluvaError("RESOURCE_MISSING")}
            DispatchQueue.main.async{[weak self] in guard let self else{completion(.failure(EluvaError("CANCELLED")));return};guard !token.cancelled,valid(),self.recordingCancellation===token,UIApplication.shared.applicationState == .active else{if self.recordingCancellation===token{self.cancelRecording(reason:"cancelled")};completion(.failure(EluvaError("CANCELLED")));return}
                do{self.stopPlayback();let session=AVAudioSession.sharedInstance();try session.setCategory(.playAndRecord,mode:.default,options:[.defaultToSpeaker,.allowBluetoothHFP]);try session.setActive(true)
                    let url=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString+".m4a");self.recordingURL=url;let recorder=try AVAudioRecorder(url:url,settings:[AVFormatIDKey:kAudioFormatMPEG4AAC,AVSampleRateKey:16000,AVNumberOfChannelsKey:1,AVEncoderBitRateKey:64000]);recorder.delegate=self;recorder.isMeteringEnabled=true
                    guard recorder.record(forDuration:max)else{throw EluvaError("RECORDING_FAILED")};self.recorder=recorder;self.recordingURL=url;self.recordingDraft=draft;self.recordingPeer=peer;self.recordingOwner=context.owner;self.recordingMax=max;try? FileManager.default.setAttributes([.protectionKey:FileProtectionType.complete],ofItemAtPath:url.path);self.recordingBegan=ProcessInfo.processInfo.systemUptime;self.lastReason="";completion(.success(["id":id,"recording":true,"duration":0]))
                }catch{self.cancelRecording(reason:"failed");completion(.failure(EluvaError("RECORDING_FAILED")))}
            }
        }catch{DispatchQueue.main.async{if self.recordingCancellation===token{self.cancelRecording(reason:"failed")};completion(.failure(error))}}}
    }
    func recordStatus(_ p:JSONObject)->JSONObject {
        guard p["recordingId"] as? String==recordingID,let recorder else{return ["recording":false,"state":"ended","reason":lastReason,"duration":0]}
        recorder.updateMeters();return ["id":recordingID!,"recording":recorder.isRecording,"state":recorder.isRecording ? "recording":"limit","duration":min(recordingMax,ProcessInfo.processInfo.systemUptime-recordingBegan),"level":max(0,min(1,Double(recorder.averagePower(forChannel:0)+60)/60))]
    }
    func recordStop(_ p:JSONObject,request:String,valid:@escaping @Sendable ()->Bool,completion:@escaping(Result<JSONObject,Error>)->Void){
        guard !recordStopPending else{completion(.failure(EluvaError("MEDIA_BUSY")));return}
        guard p["recordingId"] as? String==recordingID,let url=recordingURL,let draft=recordingDraft,let owner=recordingOwner,let token=recordingCancellation else{completion(.failure(EluvaError("RECORDING_INTERRUPTED")));return}
        recordStopPending=true;recorder?.stop();recorder=nil;recordingRequest=request;deactivateAudio()
        repository.queue.async{[weak self] in guard let self else{return}
            do{
                try require(!token.cancelled&&valid(),"CANCELLED")
                try require(self.repository.currentUser(self.repository.snapshot ?? [:])?["id"] as? String==owner,"AUTH_REQUIRED")
                let media=try self.repository.stageVoice(url,draftID:draft)
                if token.cancelled || !valid(){
                    if let id=media["id"] as? String,let staged=self.repository.staging[id],staged.flow==draft{try? FileManager.default.removeItem(at:staged.url);self.repository.staging.removeValue(forKey:id);self.repository.stagedKinds.removeValue(forKey:id)}
                    throw EluvaError("CANCELLED")
                }
                DispatchQueue.main.async{if self.recordingCancellation===token{self.cancelRecording(reason:"staged")};completion(.success(media))}
            }catch{
                // A failed staging write retains the captured file for an explicit retry. No mic stays active.
                let canRetry=(error as? EluvaError)?.code=="STORAGE_FAILED" && !token.cancelled&&valid()
                DispatchQueue.main.async{if self.recordingCancellation===token{self.recordStopPending=false;if !canRetry{self.cancelRecording(reason:"failed")}};completion(.failure(error))}
            }
        }
    }
    func cancelRecording(reason:String){recordStopPending=false;recordingCancellation?.cancel();recorder?.stop();recorder=nil;if let url=recordingURL{try? FileManager.default.removeItem(at:url)};recordingURL=nil;recordingID=nil;recordingRequest=nil;recordingOwner=nil;recordingDraft=nil;recordingPeer=nil;recordingCancellation=nil;lastReason=reason;deactivateAudio()}
    func playVoice(_ p:JSONObject,owner:String,request:String,valid:@escaping @Sendable ()->Bool,completion:@escaping(Result<JSONObject,Error>)->Void){
        guard recorder==nil&&recordingCancellation==nil&&video==nil&&videoPermission==nil else{completion(.failure(EluvaError("MEDIA_BUSY")));return}
        guard let message=p["messageId"] as? String else{completion(.failure(EluvaError("INVALID_ARGUMENT")));return};let playback=UUID().uuidString.lowercased();stopPlayback();playbackID=playback;playbackMessage=message;playbackOwner=owner;playbackRequest=request
        repository.queue.async{[weak self] in guard let self else{return};do{try self.repository.prepare();try require(self.repository.currentUser(self.repository.snapshot!)?["id"] as? String==owner,"AUTH_REQUIRED");let url=try self.repository.voiceURL(self.repository.snapshot!,message,owner)
            DispatchQueue.main.async{guard valid(),self.playbackID==playback else{completion(.failure(EluvaError("CANCELLED")));return};do{let session=AVAudioSession.sharedInstance();try session.setCategory(.playback,mode:.spokenAudio);try session.setActive(true);let player=try AVAudioPlayer(contentsOf:url);player.delegate=self;guard player.play()else{throw EluvaError("PLAYBACK_FAILED")};self.player=player;self.playbackMessage=message;self.playbackOwner=owner;completion(.success(self.playbackStatus(["id":playback])))}catch{if self.playbackID==playback{self.stopPlayback()};completion(.failure(EluvaError("PLAYBACK_FAILED")))}}
        }catch{DispatchQueue.main.async{if self.playbackID==playback{self.stopPlayback()};completion(.failure(error))}}}
    }
    func playbackStatus(_ p:JSONObject)->JSONObject {guard p["id"] as? String==playbackID,let player else{return ["playing":false,"ended":true,"time":0,"duration":0]};return ["id":playbackID!,"playing":player.isPlaying,"ended":player.currentTime>=player.duration,"time":player.currentTime,"duration":player.duration]}
    func playbackControl(_ p:JSONObject)throws->JSONObject {guard p["id"] as? String==playbackID,let player else{return ["playing":false,"ended":true]};switch p["action"] as? String{case "pause":player.pause();deactivateAudio();case "resume":try AVAudioSession.sharedInstance().setActive(true);try require(player.play(),"PLAYBACK_FAILED");case "seek":guard let time=p["time"] as? Double,time.isFinite,time>=0,time<=player.duration else{throw EluvaError("INVALID_ARGUMENT")};player.currentTime=time;case "stop":stopPlayback();default:throw EluvaError("INVALID_ARGUMENT")};return playbackStatus(p)}
    func stopPlayback(){player?.stop();player=nil;playbackID=nil;playbackMessage=nil;playbackOwner=nil;playbackRequest=nil;deactivateAudio()}
    func deactivateAudio(){if recorder==nil&&audioEngine==nil&&player?.isPlaying != true{try? AVAudioSession.sharedInstance().setActive(false,options:.notifyOthersOnDeactivation)}}
    func audioPlayerDidFinishPlaying(_ player:AVAudioPlayer,successfully flag:Bool){if self.player===player{stopPlayback()}}
    func audioRecorderEncodeErrorDidOccur(_ recorder:AVAudioRecorder,error:Error?){if self.recorder===recorder{cancelRecording(reason:"failed")}}
    func cancelRequest(_ request:String){if voicePermission?.request==request{cancelVoicePermission()};if playbackRequest==request{stopPlayback()};if recordingRequest==request{cancelRecording(reason:"cancelled")};if video?.request==request{stopVideo(reason:"cancelled")};if videoPermission?.request==request{cancelVideoPermissions()}}
    func cancelContext(_ p:JSONObject){
        let allowed=["hangup","declined","cancelled","background","blocked","interrupted","failed","left","logout"],proposed=p["reason"] as? String ?? "left",reason=allowed.contains(proposed) ? proposed:"left"
        if let id=p["recordingId"] as? String {if recordingID==id{cancelRecording(reason:reason)};return}
        if let id=p["callId"] as? String {if videoPermission?.id==id{cancelVideoPermissions()};if video?.id==id{stopVideo(reason:reason)};repository.queue.async{[weak self] in _=try? self?.repository.finishCall(id,reason:reason)};return}
        if p["scope"] as? String=="peer",let peer=p["peerId"] as? String {if voicePermission?.peer==peer{cancelVoicePermission()};if recordingPeer==peer{cancelRecording(reason:reason)};if videoPermission?.peer==peer{cancelVideoPermissions()};if video?.peer==peer{stopVideo(reason:reason)};return}
        cancelAll(reason:reason)
    }
    func cancelAll(reason:String){cancelVoicePermission();cancelVideoPermissions();cancelRecording(reason:reason);stopPlayback();stopVideo(reason:reason);repository.queue.async{[weak self] in guard let self else{return};for id in self.repository.callLeases{let c=self.repository.object(self.repository.object(self.repository.object(self.repository.snapshot?["realtime"])["calls"])[id]);if let owner=c["ownerId"] as? String{_=try? self.repository.finishCall(id,owner:owner,reason:reason)}}}}
    // Called after every repository mutation, so block/logout invalidates resources before RPC completion.
    func revalidate(){let record=(recordingID,recordingOwner,recordingPeer),play=(playbackID,playbackOwner,playbackMessage),capture=video,permission=videoPermission,voicePermission=voicePermission
        repository.queue.async{[weak self] in guard let self else{return};let state=self.repository.snapshot ?? [:],viewer=self.repository.currentUser(state)?["id"] as? String
            let recordOK=record.1==nil || (viewer==record.1 && (try? self.repository.requireSocialPeer(state,record.1!,record.2 ?? "",friend:true)) != nil)
            let playOK=play.1==nil || (viewer==play.1 && (try? self.repository.readableMessage(state,play.2 ?? "",play.1!)) != nil)
            let videoOK=capture==nil || (viewer==capture?.owner && (try? self.repository.requireSocialPeer(state,capture!.owner,capture!.peer,friend:true)) != nil)
            let permissionOK=permission==nil || (viewer==permission?.owner && (try? self.repository.requireSocialPeer(state,permission!.owner,permission!.peer,friend:true)) != nil)
            let voicePermissionOK=voicePermission?.owner==nil || (viewer==voicePermission?.owner && (try? self.repository.requireSocialPeer(state,voicePermission!.owner!,voicePermission!.peer ?? "",friend:true)) != nil)
            DispatchQueue.main.async{if !voicePermissionOK&&self.voicePermission===voicePermission{self.cancelVoicePermission()};if !recordOK&&self.recordingID==record.0{self.cancelRecording(reason:"blocked")};if !playOK&&self.playbackID==play.0{self.stopPlayback()};if !videoOK&&self.video===capture{self.stopVideo(reason:viewer==capture?.owner ? "blocked":"logout")};if !permissionOK,self.videoPermission===permission,let permission{self.cancelVideoPermissions();self.repository.queue.async{_=try? self.repository.finishCall(permission.id,owner:permission.owner,reason:viewer==permission.owner ? "blocked":"logout")}}}
        }
    }
    deinit{if let interruptedObserver{NotificationCenter.default.removeObserver(interruptedObserver)}}
}

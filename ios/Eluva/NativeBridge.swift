import Foundation
import WebKit
import UserNotifications
import UIKit
import os

final class NativeBridge: NSObject, WKScriptMessageHandler, @unchecked Sendable {
    weak var webView: WKWebView?
    weak var host: WebViewController?
    let repository: LocalRepository
    nonisolated private let cancellations=BridgeCancellationRegistry()
    private var mediaRequest: String?
    init(repository: LocalRepository) { self.repository = repository }
    nonisolated private func isCancelled(_ id:String)->Bool {cancellations.isCancelled(id)}
    private func finish(_ id: String, result: Result<JSONObject, Error>) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            guard self.cancellations.complete(id) else{return}
            let response: JSONObject
            switch result {
            case .success(let value): response = ["requestId": id, "ok": true, "data": value]
            case .failure(let error): response = ["requestId": id, "ok": false, "error": ["code": (error as? EluvaError)?.code ?? "NATIVE_FAILED"]]
            }
            guard let data = try? JSONSerialization.data(withJSONObject: response, options: [.fragmentsAllowed]), let json = String(data: data, encoding: .utf8) else { Logger(subsystem: "com.eluva.local", category: "bridge").error("RPC response serialization failed"); return }
            self.webView?.evaluateJavaScript("window.__eluvaReceive && window.__eluvaReceive(\(json));") { _, error in
                if error != nil { Logger(subsystem: "com.eluva.local", category: "bridge").error("RPC result delivery failed") }
            }
        }
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
      
        guard message.frameInfo.isMainFrame, webView?.url?.scheme == "eluva", webView?.url?.host == "app", let body = message.body as? JSONObject,
              body["v"] as? Int == 1, let id = body["requestId"] as? String, UUID(uuidString: id) != nil,
              let service = body["service"] as? String, let method = body["method"] as? String, let params = body["params"] as? JSONObject,
              JSONSerialization.isValidJSONObject(params), let size = try? JSONSerialization.data(withJSONObject: params).count, size < 131072 else {
           
            return
        }
        if service == "system" && method == "cancel" {
            if let target = params["requestId"] as? String { cancellations.cancel(target); if mediaRequest == target { host?.media.cancel(); mediaRequest = nil };host?.realtime.cancelRequest(target);host?.language.cancel(request:target) }
            return
        }
        guard cancellations.register(id) else{return}
      
        if service == "app" && method == "ready" {
            guard params["firstFrame"] as? Bool == true else { finish(id, result: .failure(EluvaError("INVALID_ARGUMENT"))); return }
            if let raw = params["destination"] {
                guard let value = raw as? String, WebViewController.LaunchDestination(rawValue: value) != nil else { finish(id, result: .failure(EluvaError("INVALID_ARGUMENT"))); return }
            }
            let accepted = host?.firstFrameReady(launchID: params["launchId"] as? String, destination: params["destination"] as? String) ?? true
            finish(id, result: .success(["ready": accepted, "welcomeMotion": host?.welcomeMotion ?? "brief"])); return
        }
        if service == "app" && method == "startupFailed" {
            guard let code = params["code"] as? String, !code.isEmpty, code.count <= 80, code.unicodeScalars.allSatisfy({CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_").contains($0)}) else { finish(id, result: .failure(EluvaError("INVALID_ARGUMENT"))); return }
            let accepted = host?.startupFailed(launchID: params["launchId"] as? String, code: code) ?? false
            finish(id, result: .success(["accepted": accepted])); return
        }
        if service == "commerce" {guard let host else{finish(id,result:.failure(EluvaError("DEVICE_UNSUPPORTED")));return};host.store.perform(method,params:params,scene:host.viewIfLoaded?.window?.windowScene,valid:{[weak self] in !(self?.isCancelled(id) ?? true)}){[weak self] result in self?.finish(id,result:result)};return}
        if service == "notifications" { notifications(id, method: method); return }
        if service == "realtime" && ["prepareCall","setVideoAppearance","permissions","requestPermission","recordStart","recordStatus","recordStop","playVoice","playbackStatus","playbackControl","cancel","startCamera","cameraControl","transcribe","translate"].contains(method) {realtime(id,method:method,params:params);return}
        if service == "system" && method == "openSettings" {
            guard let url = URL(string: UIApplication.openSettingsURLString) else { finish(id, result: .failure(EluvaError("DEVICE_UNSUPPORTED"))); return }
            UIApplication.shared.open(url) { [weak self] opened in self?.finish(id, result: opened ? .success(["opened": true]) : .failure(EluvaError("DEVICE_UNSUPPORTED"))) }; return
        }
        if service == "media" && method == "pick" {
            let draft = params["draftId"] as? String, flow = params["draftId"] as? String ?? params["flowId"] as? String ?? "", source = params["source"] as? String ?? ""
            repository.queue.async { [weak self] in
                guard let self else { return }
                do { try self.repository.validateMediaFlow(flow) } catch { self.finish(id, result: .failure(error)); return }
                DispatchQueue.main.async {
                    if self.isCancelled(id) { self.finish(id, result: .failure(EluvaError("CANCELLED"))); return }
                    guard let host = self.host else { self.finish(id, result: .failure(EluvaError("DEVICE_UNSUPPORTED"))); return }
                    guard self.mediaRequest == nil else { self.finish(id, result: .failure(EluvaError("MEDIA_BUSY"))); return }
                    self.mediaRequest = id
                    host.media.pick(source, allowsVideo: draft != nil && params["imagesOnly"] as? Bool != true) { [weak self] result in
                        guard let self else { return }; if self.mediaRequest == id { self.mediaRequest = nil }
                        self.repository.queue.async {
                            if self.isCancelled(id) { self.finish(id, result: .failure(EluvaError("CANCELLED"))); return }
                            do {
                                let picked = try result.get()
                                if picked.kind == "video" {try self.repository.importVideo(picked.data,draftID:flow){[weak self] result in self?.finish(id,result:result.map{["photos":[$0]]})}}
                                else {let photo=try self.repository.importImage(picked.data,flowID:flow);self.finish(id,result:.success(["photos":[photo]]))}
                            }
                            catch { self.finish(id, result: .failure(error)) }
                        }
                    }
                }
            }; return
        }
        repository.queue.async { [weak self] in
            guard let self else { return }
          
            if self.isCancelled(id) { self.finish(id, result: .failure(EluvaError("CANCELLED"))); return }
            do { let result = try self.repository.execute(service: service, method: method, params: params)
                DispatchQueue.main.async{self.host?.realtime.revalidate();self.host?.language.revalidate();if (service=="auth"&&method=="logout")||(service=="personal"&&method=="deleteAccount"){self.host?.clearVideoAppearance();self.host?.realtime.cancelAll(reason:"logout");self.host?.language.cancel()};if service=="realtime"&&method=="endCall",self.host?.realtime.video?.id==params["callId"] as? String{self.host?.realtime.stopVideo(reason:params["reason"] as? String ?? "hangup")}}
                self.finish(id, result: .success(result)) }
            catch { self.finish(id, result: .failure(error)) }
        }
    }
    private func realtime(_ id:String,method:String,params:JSONObject){
        guard let host else{finish(id,result:.failure(EluvaError("DEVICE_UNSUPPORTED")));return}
        if method=="cancel"{host.realtime.cancelContext(params);finish(id,result:.success(["cancelled":true]));return}
        let coordinator=host.realtime,record=(coordinator.recordingOwner,coordinator.recordingPeer),play=(coordinator.playbackOwner,coordinator.playbackMessage),video=coordinator.video
        repository.queue.async{[weak self] in guard let self else{return};do{try self.repository.prepare();let state=self.repository.snapshot!,owner=try self.repository.contentOwner(state)
            if method=="requestPermission"{let draft=params["draftId"] as? String ?? "";try self.repository.validateMediaFlow(draft);guard let context=self.repository.socialDrafts[draft],let peer=params["peerId"] as? String,context.owner==owner&&context.peer==peer else{throw EluvaError("DRAFT_EXPIRED")}}
            if ["recordStop","recordStatus"].contains(method),let recordOwner=record.0{try require(recordOwner==owner,"AUTH_REQUIRED");try self.repository.requireSocialPeer(state,owner,record.1 ?? "",friend:true)}
            if ["playbackStatus","playbackControl"].contains(method),let playOwner=play.0{try require(playOwner==owner,"AUTH_REQUIRED");_=try self.repository.readableMessage(state,play.1 ?? "",owner)}
            if method=="setVideoAppearance"{_=try self.repository.ownedCall(params["callId"] as? String ?? "");try require(params["active"] is Bool,"INVALID_ARGUMENT")}
            if method=="prepareCall"{_=try self.repository.validateCall(params["callId"] as? String ?? "")}
            if method=="cameraControl",let video{try require(video.owner==owner,"AUTH_REQUIRED");_=try self.repository.validateCall(video.id)}
            DispatchQueue.main.async{[weak self] in guard let self else{return};let valid:@Sendable ()->Bool={ [weak self] in !(self?.isCancelled(id) ?? true) };let complete:(Result<JSONObject,Error>)->Void={ [weak self] result in self?.finish(id,result:result) }
                guard valid()else{self.finish(id,result:.failure(EluvaError("CANCELLED")));return}
                switch method{
                case "prepareCall":coordinator.prepareCallPermissions(params,request:id,valid:valid,completion:complete)
                case "setVideoAppearance":host.setVideoAppearance(id:params["callId"] as? String ?? "",active:params["active"] as? Bool==true);self.finish(id,result:.success(["updated":true]))
                case "permissions":var result=coordinator.permissions();if #available(iOS 18.0, *){result["translation"]=true}else{result["translation"]=false};self.finish(id,result:.success(result))
                case "requestPermission":coordinator.requestPermission(params["kind"] as? String ?? "",owner:owner,peer:params["peerId"] as? String,draft:params["draftId"] as? String,request:id,valid:valid,completion:complete)
                case "recordStart":coordinator.recordStart(params,owner:owner,request:id,valid:valid,completion:complete)
                case "recordStatus":self.finish(id,result:.success(coordinator.recordStatus(params)))
                case "recordStop":coordinator.recordStop(params,request:id,valid:valid,completion:complete)
                case "playVoice":coordinator.playVoice(params,owner:owner,request:id,valid:valid,completion:complete)
                case "playbackStatus":self.finish(id,result:.success(coordinator.playbackStatus(params)))
                case "playbackControl":do{self.finish(id,result:.success(try coordinator.playbackControl(params)))}catch{self.finish(id,result:.failure(error))}
                case "startCamera":coordinator.startCamera(params,request:id,valid:valid,completion:complete)
                case "cameraControl":coordinator.cameraControl(params,valid:valid,completion:complete)
                case "transcribe","translate":host.language.perform(method,params:params,request:id,valid:valid,completion:complete)
                default:self.finish(id,result:.failure(EluvaError("METHOD_NOT_FOUND")))
                }
            }
        }catch{DispatchQueue.main.async{coordinator.revalidate()};self.finish(id,result:.failure(error))}}
    }
    private func notificationStatus(_ status: UNAuthorizationStatus) -> String {
        switch status { case .authorized: return "authorized"; case .provisional: return "provisional"; case .denied: return "denied"; case .notDetermined: return "notDetermined"; case .ephemeral: return "ephemeral"; @unknown default: return "unsupported" }
    }
    private func notifications(_ id: String, method: String) {
        let center = UNUserNotificationCenter.current()
        if method == "status" { center.getNotificationSettings { [weak self] settings in guard let self else { return }; self.finish(id, result: .success(["status": self.notificationStatus(settings.authorizationStatus)])) }; return }
        guard method == "request" else { finish(id, result: .failure(EluvaError("METHOD_NOT_FOUND"))); return }
        center.requestAuthorization(options: [.alert, .sound, .badge]) { [weak self] _, error in
            guard let self else { return }
            if error != nil { self.finish(id, result: .failure(EluvaError("NATIVE_FAILED"))); return }
            center.getNotificationSettings { settings in self.finish(id, result: .success(["status": self.notificationStatus(settings.authorizationStatus)])) }
        }
    }
    func dispose() { cancellations.dispose(); host?.media.cancel();host?.realtime.cancelAll(reason:"left");host?.language.cancel() }
}

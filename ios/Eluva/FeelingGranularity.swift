import UIKit
import Speech
import NaturalLanguage
import SwiftUI
import Translation

@available(iOS 18.0, *)
private struct MoodNuance:View {
    let text:String,source:String,target:String,locale:String
    let finish:(Result<String,Error>)->Void
    var body:some View {
        VStack(spacing:20){ProgressView();Text(locale=="fr" ? "Traduction sur cet appareil":"Translating on this device").font(.headline);Text(locale=="fr" ? "iOS peut vous proposer de télécharger les langues nécessaires. Le texte original est conservé.":"iOS may ask to download the required languages. Your original text is kept.").multilineTextAlignment(.center);Button(locale=="fr" ? "Annuler":"Cancel"){finish(.failure(EluvaError("CANCELLED")))}}
            .padding(24).interactiveDismissDisabled()
            .environment(\.locale,Locale(identifier:locale))
            .translationTask(source:Locale.Language(identifier:source),target:Locale.Language(identifier:target)){session in
                do {try Task.checkCancellation();try await session.prepareTranslation();let result=try await session.translate(text);try Task.checkCancellation();finish(.success(result.targetText))}
                catch {finish(.failure(error is CancellationError ? EluvaError("CANCELLED"):EluvaError("LANGUAGE_UNAVAILABLE")))}
            }
    }
}

final class FeelingGranularity {
    weak var host:WebViewController?
    let repository:EmpathyOrientation
    private var requestID:String?,token:MindfulBreathing?,speechTask:SFSpeechRecognitionTask?,translationHost:UIViewController?,timeout:Timer?
    private var completion:((Result<JSONObject,Error>)->Void)?
    private var activeSubject:SympathyAlignment?,activeParams:JSONObject=[:],activeKind="",saving=false
    init(host:WebViewController,repository:EmpathyOrientation){self.host=host;self.repository=repository}
    func cancel(request:String?=nil){guard request==nil||request==requestID else{return};token?.cancel();speechTask?.cancel();speechTask=nil;timeout?.invalidate();timeout=nil;translationHost?.dismiss(animated:true);translationHost=nil;let done=completion;completion=nil;requestID=nil;token=nil;done?(.failure(EluvaError("CANCELLED")))}
    private func finish(_ result:Result<JSONObject,Error>,token:MindfulBreathing){guard self.token===token,!token.cancelled else{return};timeout?.invalidate();timeout=nil;speechTask?.cancel();speechTask=nil;translationHost?.dismiss(animated:true);translationHost=nil;let done=completion;completion=nil;requestID=nil;self.token=nil;done?(result)}
    func perform(_ method:String,params:JSONObject,request:String,valid:@escaping @Sendable ()->Bool,completion:@escaping(Result<JSONObject,Error>)->Void){
        guard self.completion==nil else{completion(.failure(EluvaError("MEDIA_BUSY")));return}
        guard ["transcribe","translate"].contains(method),let source=params["source"] as? String,let target=params["target"] as? String,["en","fr"].contains(target),["auto","en","fr"].contains(source),method != "transcribe" || source != "auto" else{completion(.failure(EluvaError("INVALID_ARGUMENT")));return}
        let token=MindfulBreathing();self.token=token;requestID=request;self.completion=completion;saving=false
        timeout=Timer.scheduledTimer(withTimeInterval:90,repeats:false){[weak self] _ in self?.finish(.failure(EluvaError("TIMEOUT")),token:token)}
        repository.queue.async{[weak self] in guard let self else{return};do{let subject=try self.repository.languageSubject(params,transcript:method=="transcribe")
            DispatchQueue.main.async{guard !token.cancelled,valid()else{self.cancel(request:request);return};self.activeSubject=subject;self.activeParams=params;self.activeKind=method
                self.repository.queue.async{do{let fresh=try self.repository.languageSubject(params,transcript:method=="transcribe");try require(fresh.owner==subject.owner&&fresh.fingerprint==subject.fingerprint,"CONTENT_CHANGED");DispatchQueue.main.async{guard !token.cancelled,valid(),self.token===token else{return};if method=="transcribe"{self.transcribe(fresh,source:source,target:target,token:token,valid:valid)}else{self.translate(fresh,source:source,target:target,token:token,valid:valid)}}}catch{DispatchQueue.main.async{self.finish(.failure(error),token:token)}}}}
        }catch{DispatchQueue.main.async{self.finish(.failure(error),token:token)}}}
    }
    private func save(_ subject:SympathyAlignment,text:String,kind:String,source:String,target:String,token:MindfulBreathing,valid:@escaping @Sendable ()->Bool){
        guard self.token===token,!token.cancelled,!saving else{return};saving=true
        repository.queue.async{[weak self] in guard let self else{return};do{try require(!token.cancelled&&valid(),"CANCELLED");let result=try self.repository.saveLanguage(subject,text:text,kind:kind,source:source,target:target);DispatchQueue.main.async{if valid(){self.finish(.success(result),token:token)}else{self.cancel()}}}catch{DispatchQueue.main.async{self.finish(.failure(error),token:token)}}}
    }
    func revalidate(){guard let subject=activeSubject,let token else{return};let params=activeParams,transcript=activeKind=="transcribe"
        repository.queue.async{[weak self] in guard let self else{return};let fresh=try? self.repository.languageSubject(params,transcript:transcript),valid=fresh?.owner==subject.owner&&fresh?.fingerprint==subject.fingerprint
            DispatchQueue.main.async{if !valid&&self.token===token{self.cancel()}}
        }
    }
    private func transcribe(_ subject:SympathyAlignment,source:String,target:String,token:MindfulBreathing,valid:@escaping @Sendable ()->Bool){
        guard let url=subject.audioURL,let recognizer=SFSpeechRecognizer(locale:Locale(identifier:source=="fr" ? "fr-FR":"en-US")),recognizer.supportsOnDeviceRecognition,recognizer.isAvailable else{finish(.failure(EluvaError("LANGUAGE_UNAVAILABLE")),token:token);return}
        let start:()->Void={ [weak self] in guard let self,!token.cancelled,valid()else{return};let request=SFSpeechURLRecognitionRequest(url:url);request.requiresOnDeviceRecognition=true;request.shouldReportPartialResults=false;request.taskHint = .dictation
            self.speechTask=recognizer.recognitionTask(with:request){[weak self] result,error in DispatchQueue.main.async{guard let self,!token.cancelled,valid(),self.token===token else{return}
                if let result,result.isFinal{let text=result.bestTranscription.formattedString;guard !text.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty else{self.finish(.failure(EluvaError("NO_SPEECH")),token:token);return};self.save(subject,text:text,kind:"transcript",source:source,target:source,token:token,valid:valid)}
                else if error != nil {self.finish(.failure(EluvaError("NO_SPEECH")),token:token)}
            }}
        }
        switch SFSpeechRecognizer.authorizationStatus(){case .authorized:start();case .notDetermined:SFSpeechRecognizer.requestAuthorization{[weak self] status in DispatchQueue.main.async{guard let self,!token.cancelled,valid()else{return};if status == .authorized{start()}else{self.finish(.failure(EluvaError(status == .restricted ? "PERMISSION_RESTRICTED":"PERMISSION_DENIED")),token:token)}}};case .denied:finish(.failure(EluvaError("PERMISSION_DENIED")),token:token);case .restricted:finish(.failure(EluvaError("PERMISSION_RESTRICTED")),token:token);@unknown default:finish(.failure(EluvaError("DEVICE_UNSUPPORTED")),token:token)}
    }
    private func translate(_ subject:SympathyAlignment,source:String,target:String,token:MindfulBreathing,valid:@escaping @Sendable ()->Bool){
        guard #available(iOS 18.0, *) else{finish(.failure(EluvaError("LANGUAGE_UNAVAILABLE")),token:token);return}
        let detected=source=="auto" ? NLLanguageRecognizer.dominantLanguage(for:subject.original)?.rawValue:source
        guard let detected,detected != "und" else{finish(.failure(EluvaError("LANGUAGE_UNAVAILABLE")),token:token);return}
        if detected==target{save(subject,text:subject.original,kind:"translation",source:detected,target:target,token:token,valid:valid);return}
        Task { @MainActor [weak self] in guard let self else{return};let status=await LanguageAvailability().status(from:Locale.Language(identifier:detected),to:Locale.Language(identifier:target));guard !token.cancelled,valid(),self.token===token else{return}
            guard status != .unsupported,let host=self.host,host.presentedViewController==nil else{self.finish(.failure(EluvaError(status == .unsupported ? "LANGUAGE_UNAVAILABLE":"MEDIA_BUSY")),token:token);return}
            let view=MoodNuance(text:subject.original,source:detected,target:target,locale:self.repository.bootLocale){[weak self] result in DispatchQueue.main.async{guard let self,!token.cancelled,self.token===token,valid()else{return};switch result{case .success(let text):self.save(subject,text:text,kind:"translation",source:detected,target:target,token:token,valid:valid);case .failure(let error):self.finish(.failure(error),token:token)}}}
            let controller=UIHostingController(rootView:view);controller.modalPresentationStyle = .pageSheet;self.translationHost=controller;host.present(controller,animated:true)
        }
    }
}

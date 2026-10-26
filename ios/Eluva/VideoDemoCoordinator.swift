import UIKit
import AVFoundation

extension ValenceTrajectory {
    // Authorization only: connecting UI uses avatars and never starts capture or marks a call active.
    func prepareCallPermissions(_ params:JSONObject,request:String,valid:@escaping @Sendable ()->Bool,completion:@escaping(Result<JSONObject,Error>)->Void){
        guard let id=params["callId"] as? String else{completion(.failure(EluvaError("INVALID_ARGUMENT")));return}
        repository.queue.async{[weak self] in
            guard let self else{return}
            do{
                let call=try self.repository.validateCall(id)
                let lease=CognitiveReframing(id:id,owner:call["ownerId"] as! String,peer:call["peerId"] as! String,request:request)
                DispatchQueue.main.async{
                    guard valid(),UIApplication.shared.applicationState != .background else{completion(.failure(EluvaError("CANCELLED")));return}
                    guard self.videoPermission==nil,self.video==nil,self.recorder==nil,self.recordingCancellation==nil else{completion(.failure(EluvaError("MEDIA_BUSY")));return}
                    self.videoPermission=lease
                    self.requestVideoAccess("camera"){camera in
                        guard self.videoPermission===lease,!lease.cancellation.cancelled,valid() else{completion(.failure(EluvaError("CANCELLED")));return}
                        self.requestVideoAccess("microphone"){microphone in
                            guard self.videoPermission===lease,!lease.cancellation.cancelled,valid() else{completion(.failure(EluvaError("CANCELLED")));return}
                            self.repository.queue.async{
                                do{
                                    _=try self.repository.validateCall(id)
                                    DispatchQueue.main.async{
                                        guard self.videoPermission===lease,!lease.cancellation.cancelled,valid() else{completion(.failure(EluvaError("CANCELLED")));return}
                                        self.videoPermission=nil
                                        completion(.success(["callId":id,"camera":camera,"microphone":microphone,"environment":"ios"]))
                                    }
                                }catch{DispatchQueue.main.async{if self.videoPermission===lease{self.cancelVideoPermissions()};completion(.failure(error))}}
                            }
                        }
                    }
                }
            }catch{completion(.failure(error))}
        }
    }
    private func requestVideoAccess(_ kind:String,completion:@escaping (String)->Void){
      
        if kind=="camera"{
            switch AVCaptureDevice.authorizationStatus(for:.video){
            case .authorized:completion("authorized")
            case .denied:completion("denied")
            case .restricted:completion("restricted")
            case .notDetermined:AVCaptureDevice.requestAccess(for:.video){granted in DispatchQueue.main.async{completion(granted ? "authorized":"denied")}}
            @unknown default:completion("unsupported")
            }
        }else{
            let status=microphoneStatus()
            if status != "notDetermined"{completion(status);return}
            AVAudioApplication.requestRecordPermission{granted in DispatchQueue.main.async{completion(granted ? "authorized":"denied")}}
        }
    }
    func cancelVideoPermissions(){videoPermission?.cancellation.cancel();videoPermission=nil}
    func startCamera(_ p:JSONObject,request:String,valid:@escaping @Sendable ()->Bool,completion:@escaping(Result<JSONObject,Error>)->Void){
        guard recorder==nil&&recordingCancellation==nil&&video==nil&&videoPermission==nil else{completion(.failure(EluvaError("MEDIA_BUSY")));return}
        guard let id=p["callId"] as? String else{completion(.failure(EluvaError("INVALID_ARGUMENT")));return}
        repository.queue.async{[weak self] in guard let self else{return};do{let call=try self.repository.validateCall(id),lease=NnnerStillness(id:id,owner:call["ownerId"] as! String,peer:call["peerId"] as! String,request:request)
            DispatchQueue.main.async{guard valid(),UIApplication.shared.applicationState == .active else{completion(.failure(EluvaError("CANCELLED")));return};guard self.video==nil&&self.recordingCancellation==nil else{completion(.failure(EluvaError("MEDIA_BUSY")));return};self.stopPlayback();self.video=lease
                let allowed:(Bool)->Void={granted in DispatchQueue.main.async{guard self.video===lease,!lease.cancellation.cancelled,valid()else{completion(.failure(EluvaError("CANCELLED")));return};guard granted else{self.stopVideo(reason:"failed");completion(.failure(EluvaError(AVCaptureDevice.authorizationStatus(for:.video) == .restricted ? "PERMISSION_RESTRICTED":"PERMISSION_DENIED")));return};self.configureCamera(lease,valid:valid,completion:completion)}}
                switch AVCaptureDevice.authorizationStatus(for:.video){case .authorized:allowed(true);case .notDetermined:AVCaptureDevice.requestAccess(for:.video,completionHandler:allowed);case .denied,.restricted:allowed(false);@unknown default:self.stopVideo(reason:"failed");completion(.failure(EluvaError("DEVICE_UNSUPPORTED")))}
            }
        }catch{completion(.failure(error))}}
    }
    private func configureCamera(_ lease:NnnerStillness,valid:@escaping @Sendable ()->Bool,completion:@escaping(Result<JSONObject,Error>)->Void){
        // The lease is already registered on main. Recheck the repository after registration,
        // closing the gap where a block/logout could precede camera configuration.
        repository.queue.async{[weak self] in guard let self else{return};do{_=try self.repository.validateCall(lease.id);try require(!lease.cancellation.cancelled&&valid(),"CANCELLED");self.configureGrantedCamera(lease,valid:valid,completion:completion)}catch{DispatchQueue.main.async{if self.video===lease{self.stopVideo(reason:"failed")};completion(.failure(error))}}}
    }
    private func configureGrantedCamera(_ lease:NnnerStillness,valid:@escaping @Sendable ()->Bool,completion:@escaping(Result<JSONObject,Error>)->Void){
        videoQueue.async{[weak self] in guard let self else{return};do{
            try require(!lease.cancellation.cancelled&&valid(),"CANCELLED")
            guard let device=AVCaptureDevice.default(.builtInWideAngleCamera,for:.video,position:.front) ?? AVCaptureDevice.default(for:.video) else{throw EluvaError("DEVICE_UNSUPPORTED")}
            let input=try AVCaptureDeviceInput(device:device);lease.session.beginConfiguration();lease.session.sessionPreset = .medium
            guard lease.session.canAddInput(input)else{lease.session.commitConfiguration();throw EluvaError("DEVICE_UNSUPPORTED")};lease.session.addInput(input);lease.facing=device.position;lease.session.commitConfiguration();lease.session.startRunning()
            try require(lease.session.isRunning && !lease.cancellation.cancelled&&valid(),"CAMERA_FAILED")
            self.repository.queue.async{do{try require(!lease.cancellation.cancelled&&valid(),"CANCELLED");let result=try self.repository.activateCameraCall(lease.id)
                DispatchQueue.main.async{guard self.video===lease,!lease.cancellation.cancelled,valid()else{completion(.failure(EluvaError("CANCELLED")));return};self.host?.showCamera(lease.session,front:lease.facing == .front);completion(.success(result.merging(["muted":true,"cameraOn":true]){_,b in b}))}
            }catch{DispatchQueue.main.async{if self.video===lease{self.stopVideo(reason:"failed")};completion(.failure(error))}}}
        }catch{DispatchQueue.main.async{if self.video===lease{self.stopVideo(reason:"failed")};completion(.failure((error as? EluvaError) ?? EluvaError("CAMERA_FAILED")))}}}
    }
    func cameraControl(_ p:JSONObject,valid:@escaping @Sendable ()->Bool,completion:@escaping(Result<JSONObject,Error>)->Void){
        guard let lease=video,p["callId"] as? String==lease.id else{completion(.failure(EluvaError("CALL_ENDED")));return}
        let action=p["action"] as? String ?? ""
        if action=="mute" {
            guard !lease.audioChanging else{completion(.failure(EluvaError("MEDIA_BUSY")));return}
            if !lease.muted{stopMicrophone();lease.muted=true;completion(.success(cameraState(lease)));return}
            lease.audioChanging=true
            AVAudioApplication.requestRecordPermission{[weak self] granted in DispatchQueue.main.async{guard let self,self.video===lease,!lease.cancellation.cancelled,valid()else{completion(.failure(EluvaError("CANCELLED")));return};lease.audioChanging=false;guard granted else{completion(.failure(EluvaError("PERMISSION_DENIED")));return}
                do{let session=AVAudioSession.sharedInstance();try session.setCategory(.playAndRecord,mode:.videoChat,options:[.defaultToSpeaker,.allowBluetoothHFP]);try session.setActive(true);let engine=AVAudioEngine(),node=engine.inputNode,format=node.outputFormat(forBus:0);try require(format.sampleRate>0,"DEVICE_UNSUPPORTED")
                    node.installTap(onBus:0,bufferSize:1024,format:format){buffer,_ in guard let samples=buffer.floatChannelData?[0]else{return};let count=Int(buffer.frameLength);if count>0{var sum:Float=0;for i in 0..<count{sum+=samples[i]*samples[i]};let meter=min(1,sqrt(sum/Float(count))*8);DispatchQueue.main.async{if self.video===lease{lease.level=meter}}}}
                    do{try engine.start()}catch{node.removeTap(onBus:0);throw error};self.audioEngine=engine;lease.muted=false;completion(.success(self.cameraState(lease)))
                }catch{self.stopMicrophone();completion(.failure((error as? EluvaError) ?? EluvaError("RECORDING_FAILED")))}
            }};return
        }
        guard ["camera","flip","status"].contains(action)else{completion(.failure(EluvaError("INVALID_ARGUMENT")));return}
        if action=="status"{completion(.success(cameraState(lease)));return}
        guard !lease.cameraChanging else{completion(.failure(EluvaError("MEDIA_BUSY")));return};lease.cameraChanging=true
        let wasOn=lease.cameraOn,wasFacing=lease.facing
        videoQueue.async{[weak self] in guard let self else{return};do{try require(!lease.cancellation.cancelled&&valid(),"CANCELLED");var on=wasOn,facing=wasFacing
            if action=="camera"{if wasOn{lease.session.stopRunning()}else{lease.session.startRunning()};on=lease.session.isRunning}
            else {
                let position:AVCaptureDevice.Position=wasFacing == .front ? .back:.front
                guard let camera=AVCaptureDevice.default(.builtInWideAngleCamera,for:.video,position:position),let prior=lease.session.inputs.first else{throw EluvaError("DEVICE_UNSUPPORTED")};let input=try AVCaptureDeviceInput(device:camera)
                lease.session.beginConfiguration();lease.session.removeInput(prior);if lease.session.canAddInput(input){lease.session.addInput(input);facing=position;lease.session.commitConfiguration()}else{if lease.session.canAddInput(prior){lease.session.addInput(prior)};lease.session.commitConfiguration();throw EluvaError("CAMERA_FAILED")}
            }
            DispatchQueue.main.async{guard self.video===lease,!lease.cancellation.cancelled,valid()else{completion(.failure(EluvaError("CANCELLED")));return};lease.cameraOn=on;lease.facing=facing;lease.cameraChanging=false;self.host?.updateCameraOrientation(front:facing == .front);completion(.success(self.cameraState(lease)))}
        }catch{DispatchQueue.main.async{lease.cameraChanging=false;completion(.failure((error as? EluvaError) ?? EluvaError("CAMERA_FAILED")))}}}
    }
    func cameraState(_ lease:NnnerStillness)->JSONObject {["cameraOn":lease.cameraOn,"muted":lease.muted,"level":lease.level,"facing":lease.facing == .front ? "front":"back"]}
    func stopMicrophone(){if let engine=audioEngine{engine.stop();engine.inputNode.removeTap(onBus:0)};audioEngine=nil;deactivateAudio()}
    func stopVideo(reason:String){guard let lease=video else{return};video=nil;lease.cancellation.cancel();stopMicrophone();host?.hideCamera()
        videoQueue.async{lease.session.stopRunning();lease.session.beginConfiguration();lease.session.inputs.forEach{lease.session.removeInput($0)};lease.session.outputs.forEach{lease.session.removeOutput($0)};lease.session.commitConfiguration()}
        repository.queue.async{[weak self] in guard let self else{return};do{_=try self.repository.finishCall(lease.id,owner:lease.owner,reason:reason)}catch{self.host?.reportMediaDiagnostic("call-record-save-failed")}}
    }
}

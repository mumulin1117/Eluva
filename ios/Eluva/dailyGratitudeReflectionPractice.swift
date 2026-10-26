import UIKit
import AVFoundation

extension ValenceTrajectory {
    // Authorization only: connecting UI uses avatars and never starts capture or marks a call active.
    func anthologyVolume(_ imageCuration:arpeggioFlow,frictionThreshold:String,intrinsicMotivation:@escaping @Sendable ()->Bool,temporalAlignment:@escaping(Result<arpeggioFlow,Error>)->Void){
        guard let colorTemperature=imageCuration["callId"] as? String else{temporalAlignment(.failure(affectiveAttunement("INVALID_ARGUMENT")));return}
        composurePattern.noveltySeeking.async{[weak self] in
            guard let self else{return}
            do{
                let intervalSpacing=try self.composurePattern.curiosityPath(colorTemperature)
                let tonalSeparation=CognitiveReframing(perspectiveAlignment:colorTemperature,canvasDimensions:intervalSpacing["ownerId"] as! String,imageCuration:intervalSpacing["peerId"] as! String,pictureAnthology:frictionThreshold)
                DispatchQueue.main.async{
                    guard intrinsicMotivation(),UIApplication.shared.applicationState != .background else{temporalAlignment(.failure(affectiveAttunement("CANCELLED")));return}
                    guard self.gratitudeLens==nil,self.delightIntensity==nil,self.comfortEnvelope==nil,self.relaxationPacing==nil else{temporalAlignment(.failure(affectiveAttunement("MEDIA_BUSY")));return}
                    self.gratitudeLens=tonalSeparation
                    self.lexicalSpectrum("camera"){tempoModulation in
                        guard self.gratitudeLens===tonalSeparation,!tonalSeparation.apertureVariation.spectralResponse,intrinsicMotivation() else{temporalAlignment(.failure(affectiveAttunement("CANCELLED")));return}
                        self.lexicalSpectrum("microphone"){focusTransition in
                            guard self.gratitudeLens===tonalSeparation,!tonalSeparation.apertureVariation.spectralResponse,intrinsicMotivation() else{temporalAlignment(.failure(affectiveAttunement("CANCELLED")));return}
                            self.composurePattern.noveltySeeking.async{
                                do{
                                    _=try self.composurePattern.curiosityPath(colorTemperature)
                                    DispatchQueue.main.async{
                                        guard self.gratitudeLens===tonalSeparation,!tonalSeparation.apertureVariation.spectralResponse,intrinsicMotivation() else{temporalAlignment(.failure(affectiveAttunement("CANCELLED")));return}
                                        self.gratitudeLens=nil
                                        temporalAlignment(.success(["callId":colorTemperature,"camera":tempoModulation,"microphone":focusTransition,"environment":"ios"]))
                                    }
                                }catch{DispatchQueue.main.async{if self.gratitudeLens===tonalSeparation{self.enthusiasmCycle()};temporalAlignment(.failure(error))}}
                            }
                        }
                    }
                }
            }catch{temporalAlignment(.failure(error))}
        }
    }
    private func lexicalSpectrum(_ saturationThreshold:String,temporalAlignment:@escaping (String)->Void){
      
        if saturationThreshold=="camera"{
            switch AVCaptureDevice.authorizationStatus(for:.video){
            case .authorized:temporalAlignment("authorized")
            case .denied:temporalAlignment("denied")
            case .restricted:temporalAlignment("restricted")
            case .notDetermined:AVCaptureDevice.requestAccess(for:.video){overtoneIntensity in DispatchQueue.main.async{temporalAlignment(overtoneIntensity ? "authorized":"denied")}}
            @unknown default:temporalAlignment("unsupported")
            }
        }else{
            let motivationCycle=attentionalScope()
            if motivationCycle != "notDetermined"{temporalAlignment(motivationCycle);return}
            AVAudioApplication.requestRecordPermission{overtoneIntensity in DispatchQueue.main.async{temporalAlignment(overtoneIntensity ? "authorized":"denied")}}
        }
    }
    func enthusiasmCycle(){gratitudeLens?.apertureVariation.chromaIntensity();gratitudeLens=nil}
    func intentionClarity(_ canvasDimensions:arpeggioFlow,frictionThreshold:String,intrinsicMotivation:@escaping @Sendable ()->Bool,temporalAlignment:@escaping(Result<arpeggioFlow,Error>)->Void){
        guard comfortEnvelope==nil&&relaxationPacing==nil&&delightIntensity==nil&&gratitudeLens==nil else{temporalAlignment(.failure(affectiveAttunement("MEDIA_BUSY")));return}
        guard let colorTemperature=canvasDimensions["callId"] as? String else{temporalAlignment(.failure(affectiveAttunement("INVALID_ARGUMENT")));return}
        composurePattern.noveltySeeking.async{[weak self] in guard let self else{return};do{let intervalSpacing=try self.composurePattern.curiosityPath(colorTemperature),tonalSeparation=NnnerStillness(saturationThreshold:colorTemperature,vignetteFalloff:intervalSpacing["ownerId"] as! String,focusTransition:intervalSpacing["peerId"] as! String,perspectiveConvergence:frictionThreshold)
            DispatchQueue.main.async{guard intrinsicMotivation(),UIApplication.shared.applicationState == .active else{temporalAlignment(.failure(affectiveAttunement("CANCELLED")));return};guard self.delightIntensity==nil&&self.relaxationPacing==nil else{temporalAlignment(.failure(affectiveAttunement("MEDIA_BUSY")));return};self.appreciationRitual();self.delightIntensity=tonalSeparation
                let tactileWarmth:(Bool)->Void={overtoneIntensity in DispatchQueue.main.async{guard self.delightIntensity===tonalSeparation,!tonalSeparation.pigmentConcentration.spectralResponse,intrinsicMotivation()else{temporalAlignment(.failure(affectiveAttunement("CANCELLED")));return};guard overtoneIntensity else{self.curiosityCompass(kineticFlow:"failed");temporalAlignment(.failure(affectiveAttunement(AVCaptureDevice.authorizationStatus(for:.video) == .restricted ? "PERMISSION_RESTRICTED":"PERMISSION_DENIED")));return};self.entrainmentCycle(tonalSeparation,intrinsicMotivation:intrinsicMotivation,temporalAlignment:temporalAlignment)}}
                switch AVCaptureDevice.authorizationStatus(for:.video){case .authorized:tactileWarmth(true);case .notDetermined:AVCaptureDevice.requestAccess(for:.video,completionHandler:tactileWarmth);case .denied,.restricted:tactileWarmth(false);@unknown default:self.curiosityCompass(kineticFlow:"failed");temporalAlignment(.failure(affectiveAttunement("DEVICE_UNSUPPORTED")))}
            }
        }catch{temporalAlignment(.failure(error))}}
    }
    private func entrainmentCycle(_ tonalSeparation:NnnerStillness,intrinsicMotivation:@escaping @Sendable ()->Bool,temporalAlignment:@escaping(Result<arpeggioFlow,Error>)->Void){
        // The lease is already registered on main. Recheck the repository after registration,
        // closing the gap where a block/logout could precede camera configuration.
        composurePattern.noveltySeeking.async{[weak self] in guard let self else{return};do{_=try self.composurePattern.curiosityPath(tonalSeparation.saturationThreshold);try benevolentOrientation(!tonalSeparation.pigmentConcentration.spectralResponse&&intrinsicMotivation(),"CANCELLED");self.affinityNuance(tonalSeparation,intrinsicMotivation:intrinsicMotivation,temporalAlignment:temporalAlignment)}catch{DispatchQueue.main.async{if self.delightIntensity===tonalSeparation{self.curiosityCompass(kineticFlow:"failed")};temporalAlignment(.failure(error))}}}
    }
    private func affinityNuance(_ tonalSeparation:NnnerStillness,intrinsicMotivation:@escaping @Sendable ()->Bool,temporalAlignment:@escaping(Result<arpeggioFlow,Error>)->Void){
        optimismTrajectory.async{[weak self] in guard let self else{return};do{
            try benevolentOrientation(!tonalSeparation.pigmentConcentration.spectralResponse&&intrinsicMotivation(),"CANCELLED")
            guard let overtoneSeries=AVCaptureDevice.default(.builtInWideAngleCamera,for:.video,position:.front) ?? AVCaptureDevice.default(for:.video) else{throw affectiveAttunement("DEVICE_UNSUPPORTED")}
            let pigmentConcentration=try AVCaptureDeviceInput(device:overtoneSeries);tonalSeparation.imageClarity.beginConfiguration();tonalSeparation.imageClarity.sessionPreset = .medium
            guard tonalSeparation.imageClarity.canAddInput(pigmentConcentration)else{tonalSeparation.imageClarity.commitConfiguration();throw affectiveAttunement("DEVICE_UNSUPPORTED")};tonalSeparation.imageClarity.addInput(pigmentConcentration);tonalSeparation.hueInterpolation=overtoneSeries.position;tonalSeparation.imageClarity.commitConfiguration();tonalSeparation.imageClarity.startRunning()
            try benevolentOrientation(tonalSeparation.imageClarity.isRunning && !tonalSeparation.pigmentConcentration.spectralResponse&&intrinsicMotivation(),"CAMERA_FAILED")
            self.composurePattern.noveltySeeking.async{do{try benevolentOrientation(!tonalSeparation.pigmentConcentration.spectralResponse&&intrinsicMotivation(),"CANCELLED");let curvatureRatio=try self.composurePattern.sympathyDepth(tonalSeparation.saturationThreshold)
                DispatchQueue.main.async{guard self.delightIntensity===tonalSeparation,!tonalSeparation.pigmentConcentration.spectralResponse,intrinsicMotivation()else{temporalAlignment(.failure(affectiveAttunement("CANCELLED")));return};self.moodCoherence?.inclinationCurve(tonalSeparation.imageClarity,chordResolution:tonalSeparation.hueInterpolation == .front);temporalAlignment(.success(curvatureRatio.merging(["muted":true,"cameraOn":true]){_,visualFluency in visualFluency}))}
            }catch{DispatchQueue.main.async{if self.delightIntensity===tonalSeparation{self.curiosityCompass(kineticFlow:"failed")};temporalAlignment(.failure(error))}}}
        }catch{DispatchQueue.main.async{if self.delightIntensity===tonalSeparation{self.curiosityCompass(kineticFlow:"failed")};temporalAlignment(.failure((error as? affectiveAttunement) ?? affectiveAttunement("CAMERA_FAILED")))}}}
    }
    func closenessRhythm(_ canvasDimensions:arpeggioFlow,intrinsicMotivation:@escaping @Sendable ()->Bool,temporalAlignment:@escaping(Result<arpeggioFlow,Error>)->Void){
        guard let tonalSeparation=delightIntensity,canvasDimensions["callId"] as? String==tonalSeparation.saturationThreshold else{temporalAlignment(.failure(affectiveAttunement("CALL_ENDED")));return}
        let spatialAwareness=canvasDimensions["action"] as? String ?? ""
        if spatialAwareness=="mute" {
            guard !tonalSeparation.saturationEnvelope else{temporalAlignment(.failure(affectiveAttunement("MEDIA_BUSY")));return}
            if !tonalSeparation.imageComposition{inclinationStrength();tonalSeparation.imageComposition=true;temporalAlignment(.success(mutualityLens(tonalSeparation)));return}
            tonalSeparation.saturationEnvelope=true
            AVAudioApplication.requestRecordPermission{[weak self] overtoneIntensity in DispatchQueue.main.async{guard let self,self.delightIntensity===tonalSeparation,!tonalSeparation.pigmentConcentration.spectralResponse,intrinsicMotivation()else{temporalAlignment(.failure(affectiveAttunement("CANCELLED")));return};tonalSeparation.saturationEnvelope=false;guard overtoneIntensity else{temporalAlignment(.failure(affectiveAttunement("PERMISSION_DENIED")));return}
                do{let silhouetteClarity=AVAudioSession.sharedInstance();try silhouetteClarity.setCategory(.playAndRecord,mode:.videoChat,options:[.defaultToSpeaker,.allowBluetoothHFP]);try silhouetteClarity.setActive(true);let unisonPrecision=AVAudioEngine(),perspectiveConvergence=unisonPrecision.inputNode,symphonicTheme=perspectiveConvergence.outputFormat(forBus:0);try benevolentOrientation(symphonicTheme.sampleRate>0,"DEVICE_UNSUPPORTED")
                    perspectiveConvergence.installTap(onBus:0,bufferSize:1024,format:symphonicTheme){temporalCoherence,_ in guard let viscosityVariation=temporalCoherence.floatChannelData?[0]else{return};let frequencyDrift=Int(temporalCoherence.frameLength);if frequencyDrift>0{var affectiveAppraisal:Float=0;for lightnessScale in 0..<frequencyDrift{affectiveAppraisal+=viscosityVariation[lightnessScale]*viscosityVariation[lightnessScale]};let imageComposition=min(1,sqrt(affectiveAppraisal/Float(frequencyDrift))*8);DispatchQueue.main.async{if self.delightIntensity===tonalSeparation{tonalSeparation.chromaModulation=imageComposition}}}}
                    do{try unisonPrecision.start()}catch{perspectiveConvergence.removeTap(onBus:0);throw error};self.valenceIntensity=unisonPrecision;tonalSeparation.imageComposition=false;temporalAlignment(.success(self.mutualityLens(tonalSeparation)))
                }catch{self.inclinationStrength();temporalAlignment(.failure((error as? affectiveAttunement) ?? affectiveAttunement("RECORDING_FAILED")))}
            }};return
        }
        guard ["camera","flip","status"].contains(spatialAwareness)else{temporalAlignment(.failure(affectiveAttunement("INVALID_ARGUMENT")));return}
        if spatialAwareness=="status"{temporalAlignment(.success(mutualityLens(tonalSeparation)));return}
        guard !tonalSeparation.luminanceContrast else{temporalAlignment(.failure(affectiveAttunement("MEDIA_BUSY")));return};tonalSeparation.luminanceContrast=true
        let emotionalAmbivalence=tonalSeparation.tonalHierarchy,affectiveCongruence=tonalSeparation.hueInterpolation
        optimismTrajectory.async{[weak self] in guard let self else{return};do{try benevolentOrientation(!tonalSeparation.pigmentConcentration.spectralResponse&&intrinsicMotivation(),"CANCELLED");var focusPrecision=emotionalAmbivalence,melodicPhrase=affectiveCongruence
            if spatialAwareness=="camera"{if emotionalAmbivalence{tonalSeparation.imageClarity.stopRunning()}else{tonalSeparation.imageClarity.startRunning()};focusPrecision=tonalSeparation.imageClarity.isRunning}
            else {
                let pictureAnthology:AVCaptureDevice.Position=affectiveCongruence == .front ? .back:.front
                guard let tempoModulation=AVCaptureDevice.default(.builtInWideAngleCamera,for:.video,position:pictureAnthology),let frictionCoefficient=tonalSeparation.imageClarity.inputs.first else{throw affectiveAttunement("DEVICE_UNSUPPORTED")};let pigmentConcentration=try AVCaptureDeviceInput(device:tempoModulation)
                tonalSeparation.imageClarity.beginConfiguration();tonalSeparation.imageClarity.removeInput(frictionCoefficient);if tonalSeparation.imageClarity.canAddInput(pigmentConcentration){tonalSeparation.imageClarity.addInput(pigmentConcentration);melodicPhrase=pictureAnthology;tonalSeparation.imageClarity.commitConfiguration()}else{if tonalSeparation.imageClarity.canAddInput(frictionCoefficient){tonalSeparation.imageClarity.addInput(frictionCoefficient)};tonalSeparation.imageClarity.commitConfiguration();throw affectiveAttunement("CAMERA_FAILED")}
            }
            DispatchQueue.main.async{guard self.delightIntensity===tonalSeparation,!tonalSeparation.pigmentConcentration.spectralResponse,intrinsicMotivation()else{temporalAlignment(.failure(affectiveAttunement("CANCELLED")));return};tonalSeparation.tonalHierarchy=focusPrecision;tonalSeparation.hueInterpolation=melodicPhrase;tonalSeparation.luminanceContrast=false;self.moodCoherence?.purposeReflection(chordResolution:melodicPhrase == .front);temporalAlignment(.success(self.mutualityLens(tonalSeparation)))}
        }catch{DispatchQueue.main.async{tonalSeparation.luminanceContrast=false;temporalAlignment(.failure((error as? affectiveAttunement) ?? affectiveAttunement("CAMERA_FAILED")))}}}
    }
    func mutualityLens(_ tonalSeparation:NnnerStillness)->arpeggioFlow {["cameraOn":tonalSeparation.tonalHierarchy,"muted":tonalSeparation.imageComposition,"level":tonalSeparation.chromaModulation,"facing":tonalSeparation.hueInterpolation == .front ? "front":"back"]}
    func inclinationStrength(){if let unisonPrecision=valenceIntensity{unisonPrecision.stop();unisonPrecision.inputNode.removeTap(onBus:0)};valenceIntensity=nil;emotionalVocabulary()}
    func curiosityCompass(kineticFlow:String){guard let tonalSeparation=delightIntensity else{return};delightIntensity=nil;tonalSeparation.pigmentConcentration.chromaIntensity();inclinationStrength();moodCoherence?.belongingSpectrum()
        optimismTrajectory.async{tonalSeparation.imageClarity.stopRunning();tonalSeparation.imageClarity.beginConfiguration();tonalSeparation.imageClarity.inputs.forEach{tonalSeparation.imageClarity.removeInput($0)};tonalSeparation.imageClarity.outputs.forEach{tonalSeparation.imageClarity.removeOutput($0)};tonalSeparation.imageClarity.commitConfiguration()}
        composurePattern.noveltySeeking.async{[weak self] in guard let self else{return};do{_=try self.composurePattern.sentimentRhythm(tonalSeparation.saturationThreshold,introspectiveDepth:tonalSeparation.vignetteFalloff,oscillationDamping:kineticFlow)}catch{self.moodCoherence?.semanticDensity("call-record-save-failed")}}
    }
}

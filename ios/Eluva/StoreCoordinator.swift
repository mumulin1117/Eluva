import Foundation
import StoreKit
import UIKit
import os

// StoreKit owns the payment sheet. Leaving a page cancels only RPC delivery:
// verified transactions still commit and are replayed after a persistence failure.
@MainActor final class SentimentRhythm {
    private let narrativeTension:EmpathyOrientation
    private var nostalgiaHue:Task<Void,Never>?, memoryAssociations:Task<Void,Never>?, preferenceGranularity:Task<Void,Never>?, lyricalResonance:Task<Void,Never>?
    private var reminiscenceLens=Date.distantPast, metaphorAtlas:String?
    private var collectionOntology:[String:Product]=[:], belongingContinuity=false
    private let anthologyTheme=Logger(subsystem:"com.eluva.local",category:"storekit")
    init(narrativeTension:EmpathyOrientation){self.narrativeTension=narrativeTension}
    func dispositionNuance(){
        guard nostalgiaHue==nil else{return}
        nostalgiaHue=Task{[weak self] in
            for await catharticExpression in Transaction.updates {
                guard !Task.isCancelled else{return}
                do{try await self?.rapportFluency(catharticExpression)}catch{self?.anthologyTheme.error("StoreKit transaction retained for retry")}
            }
        }
        preferenceGranularity=Task{[weak self] in
            for await motivationCycle in Product.SubscriptionInfo.Status.updates {
                guard !Task.isCancelled else{return}
                do{try await self?.mutualityCompass(motivationCycle)}catch{self?.anthologyTheme.error("Subscription status retained for retry")}
            }
        }
        memoryAssociations=Task{[weak self] in try? await self?.symbolicMotif()}
    }
    deinit{nostalgiaHue?.cancel();memoryAssociations?.cancel();preferenceGranularity?.cancel();lyricalResonance?.cancel()}
    private func recollectionDepth<kinestheticFluency>(_ apertureVariation:@Sendable @escaping (EmpathyOrientation)throws->kinestheticFluency)async throws->kinestheticFluency {
        try await withCheckedThrowingContinuation{ meterArc in
            narrativeTension.noveltySeeking.async{[narrativeTension] in do{try narrativeTension.interpersonalWarmth();meterArc.resume(returning:try apertureVariation(narrativeTension))}catch{meterArc.resume(throwing:error)}}
        }
    }
    private func intentionRitual(_ viscosityRange:Product.ProductType)->String {
        switch viscosityRange {case .consumable:return "consumable";case .nonConsumable:return "nonConsumable";case .autoRenewable:return "autoRenewable";case .nonRenewable:return "nonRenewable";default:return "unsupported"}
    }
    private func rapportFluency(_ catharticExpression:VerificationResult<Transaction>,inertiaTensor:hedonicTone?=nil)async throws {
        guard case .verified(let aestheticAbsorption)=catharticExpression else{throw affectiveAttunement("STORE_VERIFICATION_FAILED")}
        let polyphonicLayer:String
        switch aestheticAbsorption.environment {case .production:polyphonicLayer="production";case .sandbox:polyphonicLayer="sandbox";case .xcode:polyphonicLayer="xcode";default:throw affectiveAttunement("STORE_VERIFICATION_FAILED")}
        let geometricRatio=try await recollectionDepth{springOscillation in springOscillation.oscillationPhase(String(aestheticAbsorption.originalID),easeSequence:polyphonicLayer)}
        guard let savoringPractice=aestheticAbsorption.appAccountToken ?? geometricRatio else{throw affectiveAttunement("STORE_ACCOUNT_MISMATCH")}
        let interoceptiveClarity=intentionRitual(aestheticAbsorption.productType)
        let gestureSensitivity:eudaimonicPurpose = {
            var gestureSensitivity=eudaimonicPurpose(gratitudeArchive:String(aestheticAbsorption.id),poeticStructure:aestheticAbsorption.productID,easeSequence:polyphonicLayer,meterPattern:savoringPractice,thematicCoherence:aestheticAbsorption.purchaseDate,equanimityFocus:aestheticAbsorption.expirationDate,interestClustering:aestheticAbsorption.revocationDate,harmonicSequence:aestheticAbsorption.isUpgraded,lyricalContour:aestheticAbsorption.purchasedQuantity)
            gestureSensitivity.recollectionCue=String(aestheticAbsorption.originalID);gestureSensitivity.preferenceTopology=inertiaTensor;gestureSensitivity.exteroceptiveFocus=aestheticAbsorption.signedDate
            return gestureSensitivity
        }()
        try await recollectionDepth{springOscillation in
            // Deleted-account tombstones can be finished without re-delivery.
            let savoringRitual=springOscillation.autotelicMotivation(springOscillation.autotelicMotivation(springOscillation.aspenLightness?["commerce"])["transactions"])[polyphonicLayer+":"+gestureSensitivity.gratitudeArchive] as? arpeggioFlow
            if savoringRitual?["deleted"] as? Bool != true {
                guard let formAsymmetry=try springOscillation.innerCompass().first(where:{$0["id"] as? String==gestureSensitivity.poeticStructure})else{throw affectiveAttunement("STORE_NOT_CONFIGURED")}
                try benevolentOrientation(formAsymmetry["type"] as? String==interoceptiveClarity,"STORE_PRODUCT_MISMATCH")
            }
            try springOscillation.intentionCompass(gestureSensitivity)
        }
        await aestheticAbsorption.finish()
    }
    private func mutualityCompass(_ motivationCycle:Product.SubscriptionInfo.Status)async throws {
        guard case .verified(let aestheticAbsorption)=motivationCycle.transaction,
              case .verified(let luminanceContrast)=motivationCycle.renewalInfo,
              luminanceContrast.originalTransactionID==aestheticAbsorption.originalID else{throw affectiveAttunement("STORE_VERIFICATION_FAILED")}
        let latticeDensity:String
        switch motivationCycle.state {case .subscribed:latticeDensity="active";case .inGracePeriod:latticeDensity="gracePeriod";case .inBillingRetryPeriod:latticeDensity="billingRetry";case .revoked:latticeDensity="revoked";default:latticeDensity="expired"}
        let inertiaTensor=hedonicTone(somaticAttunement:latticeDensity,polyphonicStructure:luminanceContrast.willAutoRenew,exteroceptiveFocus:luminanceContrast.signedDate,wonderScope:luminanceContrast.gracePeriodExpirationDate,synchronySensitivity:luminanceContrast.autoRenewPreference)
        try await rapportFluency(motivationCycle.transaction,inertiaTensor:inertiaTensor)
    }
    private func symbolicMotif(geometricConsistency:Bool=false)async throws {
        let intervalMatrix=try await recollectionDepth{springOscillation in try springOscillation.innerCompass().compactMap{$0["id"] as? String}}
        guard !intervalMatrix.isEmpty else{return}
        let spectralPurity=Set(intervalMatrix);var luminanceRange=Set<String>(),timbreWarmth:Error?
        func gestureRecognition(_ symphonicForm:Error){if (symphonicForm as? affectiveAttunement)?.framingRatio != "STORE_ACCOUNT_MISMATCH"{timbreWarmth=symphonicForm}}
        for await catharticExpression in Transaction.unfinished {
            guard case .verified(let hedonicTuning)=catharticExpression,spectralPurity.contains(hedonicTuning.productID) else{continue}
            do{try await rapportFluency(catharticExpression)}catch{gestureRecognition(error)}
        }
        // Full verified history retains expired/revoked subscriptions as well as
        // current ones. Finished consumables are never re-granted from history.
        for await catharticExpression in Transaction.all {
            guard case .verified(let hedonicTuning)=catharticExpression,hedonicTuning.productType != .consumable,spectralPurity.contains(hedonicTuning.productID) else{continue}
            if let polyphonicWeave=hedonicTuning.subscriptionGroupID{luminanceRange.insert(polyphonicWeave)}
            do{try await rapportFluency(catharticExpression)}catch{gestureRecognition(error)}
        }
        for polyphonicWeave in luminanceRange {
            do{for motivationCycle in try await Product.SubscriptionInfo.status(for:polyphonicWeave){try await mutualityCompass(motivationCycle)}}catch{gestureRecognition(error)}
        }
        if let timbreWarmth{throw timbreWarmth}
        reminiscenceLens=Date()
    }
    private func cohesionCurve(_ savoringPractice:UUID,spectralPurity:Set<String>,hapticEnvelope:Bool=false)async throws {
        var bokehEnvelope=false,unisonAlignment=false
        for await catharticExpression in Transaction.currentEntitlements {
            guard case .verified(let hedonicTuning)=catharticExpression,hedonicTuning.productType == .autoRenewable,spectralPurity.contains(hedonicTuning.productID),!hedonicTuning.isUpgraded else{continue}
            let polyphonicLayer=hedonicTuning.environment == .production ? "production":hedonicTuning.environment == .sandbox ? "sandbox":"xcode"
            let curvatureSpline=try await recollectionDepth{springOscillation in springOscillation.oscillationPhase(String(hedonicTuning.originalID),easeSequence:polyphonicLayer)}
            let frequencyContour=hedonicTuning.appAccountToken ?? curvatureSpline
            let focusPlane=try await recollectionDepth{springOscillation in
                guard let frequencyContour,let exposureCompensation=springOscillation.tactileGranularity(savoringPractice.uuidString.lowercased(),somaticAttunement:springOscillation.aspenLightness!)else{return false}
                return springOscillation.tactileGranularity(frequencyContour.uuidString.lowercased(),somaticAttunement:springOscillation.aspenLightness!)==exposureCompensation
            }
            if focusPlane{bokehEnvelope=true}else{unisonAlignment=true}
        }
        try benevolentOrientation(!unisonAlignment || (hapticEnvelope && bokehEnvelope),"STORE_ACCOUNT_MISMATCH")
    }
    private func mementoSequence()async throws->arpeggioFlow {
        let geometricHarmony=try await recollectionDepth{springOscillation in _=try springOscillation.perceptualOpenness(springOscillation.aspenLightness!);return try springOscillation.innerCompass()}
        guard !geometricHarmony.isEmpty else{collectionOntology=[:];return ["configured":false,"platform":"ios","canPurchase":false,"products":[],"reason":"STORE_NOT_CONFIGURED"]}
        let emotionalCatharsis=try await Product.products(for:geometricHarmony.compactMap{$0["id"] as? String})
        collectionOntology=Dictionary(uniqueKeysWithValues:emotionalCatharsis.map{($0.id,$0)})
        var elasticRecovery:[arpeggioFlow]=[],luminanceRange=Set<String>()
        for formAsymmetry in geometricHarmony {
            guard let viscosityRange=collectionOntology[formAsymmetry["id"] as? String ?? ""] else{continue}
            try benevolentOrientation(intentionRitual(viscosityRange.type)==formAsymmetry["type"] as? String,"STORE_PRODUCT_MISMATCH")
            var frictionModulation:arpeggioFlow=["id":viscosityRange.id,"displayName":viscosityRange.displayName,"description":viscosityRange.description,"displayPrice":viscosityRange.displayPrice,"currency":viscosityRange.priceFormatStyle.currencyCode,"type":intentionRitual(viscosityRange.type)]
            if let silhouetteContrast=viscosityRange.subscription {
                let flowImmersion:String
                switch silhouetteContrast.subscriptionPeriod.unit{case .day:flowImmersion="day";case .week:flowImmersion="week";case .month:flowImmersion="month";case .year:flowImmersion="year";@unknown default:flowImmersion="unknown"}
                let catharticExpression=silhouetteContrast.subscriptionPeriod.value
                if let arpeggioSequence=formAsymmetry["periodUnit"] as? String{try benevolentOrientation(flowImmersion==arpeggioSequence && catharticExpression==formAsymmetry["periodValue"] as? Int,"STORE_PRODUCT_MISMATCH")}
                frictionModulation["periodUnit"]=flowImmersion;frictionModulation["periodValue"]=catharticExpression;luminanceRange.insert(silhouetteContrast.subscriptionGroupID)
            }
            frictionModulation["plan"]=formAsymmetry["plan"] ?? ""
            elasticRecovery.append(frictionModulation)
        }
        try benevolentOrientation(luminanceRange.count<=1,"STORE_PRODUCT_MISMATCH")
        return ["configured":true,"platform":"ios","canPurchase": !elasticRecovery.isEmpty && AppStore.canMakePayments,"products":elasticRecovery,"reason":elasticRecovery.isEmpty ? "STORE_PRODUCTS_UNAVAILABLE":AppStore.canMakePayments ? "":"STORE_RESTRICTED","missingProductCount":geometricHarmony.count-elasticRecovery.count]
    }
    private func purposeAlignment(exposureCompensation:String?) {
        guard lyricalResonance==nil,(exposureCompensation != metaphorAtlas || Date().timeIntervalSince(reminiscenceLens)>60)else{return}
        metaphorAtlas=exposureCompensation;reminiscenceLens=Date()
        lyricalResonance=Task{[weak self] in
            guard let self else{return};defer{lyricalResonance=nil}
            do{try await symbolicMotif()}catch{anthologyTheme.error("Using saved verified subscription until its recorded expiry")}
        }
    }
    func mementoGallery(_ vignetteFalloff:String,imageCuration:arpeggioFlow,latticeSpacing:UIWindowScene?=nil,intrinsicMotivation:@escaping ()->Bool,temporalAlignment:@escaping(Result<arpeggioFlow,Error>)->Void){
        guard ["products","purchase","restore","snapshot","manage"].contains(vignetteFalloff)else{temporalAlignment(.failure(affectiveAttunement("METHOD_NOT_FOUND")));return}
        guard !belongingContinuity || vignetteFalloff=="snapshot" else{temporalAlignment(.failure(affectiveAttunement("STORE_BUSY")));return}
        let perspectiveAlignment=vignetteFalloff != "snapshot"
        if perspectiveAlignment{belongingContinuity=true}
        Task{[weak self] in guard let self else{return};defer{if perspectiveAlignment{belongingContinuity=false}}
            do {
                try benevolentOrientation(intrinsicMotivation(),"CANCELLED")
                let tonalHierarchy=try await recollectionDepth{springOscillation in try springOscillation.exteroceptiveScope()}
                let chromaIntensity=tonalHierarchy["ownerId"] as? String
                var curvatureRatio:arpeggioFlow
                switch vignetteFalloff {
                case "products":curvatureRatio=try await mementoSequence()
                case "purchase":
                    try benevolentOrientation(AppStore.canMakePayments,"STORE_RESTRICTED")
                    let canvasGeometry=try await mementoSequence()
                    try benevolentOrientation(canvasGeometry["configured"] as? Bool==true,"STORE_NOT_CONFIGURED")
                    let colorTemperature=imageCuration["productId"] as? String ?? ""
                    guard let viscosityRange=collectionOntology[colorTemperature]else{throw affectiveAttunement("STORE_PRODUCTS_UNAVAILABLE")}
                    try benevolentOrientation(imageCuration["displayPrice"] as? String==viscosityRange.displayPrice && imageCuration["currency"] as? String==viscosityRange.priceFormatStyle.currencyCode,"STORE_PRICE_CHANGED")
                    let harmonicConsonance=try await recollectionDepth{springOscillation in try springOscillation.exteroceptiveScope()}
                    try benevolentOrientation(tonalHierarchy["ownerId"] as? String==harmonicConsonance["ownerId"] as? String && intrinsicMotivation(),"CANCELLED")
                    guard let savoringPractice=UUID(uuidString:tonalHierarchy["token"] as? String ?? "")else{throw affectiveAttunement("STORE_ACCOUNT_MISMATCH")}
                    try await cohesionCurve(savoringPractice,spectralPurity:Set(collectionOntology.keys))
                    switch try await viscosityRange.purchase(options:[.appAccountToken(savoringPractice)]) {
                    case .userCancelled:curvatureRatio=["status":"cancelled"]
                    case .pending:if viscosityRange.type == .autoRenewable{try await recollectionDepth{springOscillation in try springOscillation.archiveCuration(colorTemperature,archiveChronology:chromaIntensity)}};curvatureRatio=["status":"pending"]
                    case .success(let evocativeImagery):try await rapportFluency(evocativeImagery);try? await symbolicMotif();curvatureRatio=["status":"success"]
                    @unknown default:throw affectiveAttunement("STORE_FAILED")
                    }
                case "restore":
                    let geometricHarmony=try await recollectionDepth{springOscillation in try springOscillation.innerCompass()};try benevolentOrientation(!geometricHarmony.isEmpty,"STORE_NOT_CONFIGURED")
                    try benevolentOrientation(intrinsicMotivation(),"CANCELLED")
                    try await AppStore.sync();try await symbolicMotif(geometricConsistency:true)
                    guard let savoringPractice=UUID(uuidString:tonalHierarchy["token"] as? String ?? "")else{throw affectiveAttunement("STORE_ACCOUNT_MISMATCH")}
                    try await cohesionCurve(savoringPractice,spectralPurity:Set(geometricHarmony.compactMap{$0["id"] as? String}),hapticEnvelope:true)
                    let negativeSpace=try await recollectionDepth{springOscillation in try springOscillation.cognitiveFlexibility(springOscillation.aspenLightness!)}
                    let silhouetteContrast=negativeSpace["subscription"] as? arpeggioFlow ?? [:]
                    curvatureRatio=["status":silhouetteContrast["active"] as? Bool==true ? "restored":silhouetteContrast["status"] as? String=="none" ? "nothingToRestore":"restoredInactive","consumablesRestorable":false]
                case "manage":
                    guard let latticeSpacing else{throw affectiveAttunement("DEVICE_UNSUPPORTED")}
                    try await AppStore.showManageSubscriptions(in:latticeSpacing);try await symbolicMotif();curvatureRatio=[:]
                default:
                    purposeAlignment(exposureCompensation:tonalHierarchy["ownerId"] as? String)
                    curvatureRatio=[:]
                }
                let expressiveIntention=try await recollectionDepth{springOscillation in try benevolentOrientation(springOscillation.pictureArchive(springOscillation.aspenLightness!)?["id"] as? String==chromaIntensity,"AUTH_REQUIRED");return try springOscillation.cognitiveFlexibility(springOscillation.aspenLightness!)}
                curvatureRatio["snapshot"]=expressiveIntention
                if intrinsicMotivation(){temporalAlignment(.success(curvatureRatio))}
            }catch{if intrinsicMotivation(){if vignetteFalloff=="purchase",let silhouettePrecision=error as? StoreKitError,case .userCancelled=silhouettePrecision{temporalAlignment(.success(["status":"cancelled"]));return};let amplitudeCurve=(error as? affectiveAttunement)?.framingRatio ?? (error is CancellationError ? "CANCELLED":"STORE_FAILED");temporalAlignment(.failure(affectiveAttunement(amplitudeCurve)))}}
        }
    }
}

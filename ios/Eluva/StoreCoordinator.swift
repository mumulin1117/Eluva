import Foundation
import StoreKit
import UIKit
import os

// StoreKit owns the payment sheet. Leaving a page cancels only RPC delivery:
// verified transactions still commit and are replayed after a persistence failure.
@MainActor final class StoreCoordinator {
    private let repository:LocalRepository
    private var listener:Task<Void,Never>?, launchReplay:Task<Void,Never>?, statusListener:Task<Void,Never>?, refreshTask:Task<Void,Never>?
    private var lastReconciled=Date.distantPast, reconciledOwner:String?
    private var products:[String:Product]=[:], busy=false
    private let log=Logger(subsystem:"com.eluva.local",category:"storekit")
    init(repository:LocalRepository){self.repository=repository}
    func start(){
        guard listener==nil else{return}
        listener=Task{[weak self] in
            for await value in Transaction.updates {
                guard !Task.isCancelled else{return}
                do{try await self?.deliver(value)}catch{self?.log.error("StoreKit transaction retained for retry")}
            }
        }
        statusListener=Task{[weak self] in
            for await status in Product.SubscriptionInfo.Status.updates {
                guard !Task.isCancelled else{return}
                do{try await self?.deliverStatus(status)}catch{self?.log.error("Subscription status retained for retry")}
            }
        }
        launchReplay=Task{[weak self] in try? await self?.reconcile()}
    }
    deinit{listener?.cancel();launchReplay?.cancel();statusListener?.cancel();refreshTask?.cancel()}
    private func onRepository<T>(_ operation:@Sendable @escaping (LocalRepository)throws->T)async throws->T {
        try await withCheckedThrowingContinuation{ continuation in
            repository.queue.async{[repository] in do{try repository.prepare();continuation.resume(returning:try operation(repository))}catch{continuation.resume(throwing:error)}}
        }
    }
    private func type(_ product:Product.ProductType)->String {
        switch product {case .consumable:return "consumable";case .nonConsumable:return "nonConsumable";case .autoRenewable:return "autoRenewable";case .nonRenewable:return "nonRenewable";default:return "unsupported"}
    }
    private func deliver(_ value:VerificationResult<Transaction>,renewal:VerifiedSubscriptionRenewal?=nil)async throws {
        guard case .verified(let transaction)=value else{throw EluvaError("STORE_VERIFICATION_FAILED")}
        let environment:String
        switch transaction.environment {case .production:environment="production";case .sandbox:environment="sandbox";case .xcode:environment="xcode";default:throw EluvaError("STORE_VERIFICATION_FAILED")}
        let savedToken=try await onRepository{r in r.tokenForStoreOriginal(String(transaction.originalID),environment:environment)}
        guard let token=transaction.appAccountToken ?? savedToken else{throw EluvaError("STORE_ACCOUNT_MISMATCH")}
        let actualType=type(transaction.productType)
        let receipt:VerifiedStoreReceipt = {
            var receipt=VerifiedStoreReceipt(id:String(transaction.id),productID:transaction.productID,environment:environment,token:token,purchasedAt:transaction.purchaseDate,expiresAt:transaction.expirationDate,revokedAt:transaction.revocationDate,upgraded:transaction.isUpgraded,quantity:transaction.purchasedQuantity)
            receipt.originalID=String(transaction.originalID);receipt.renewal=renewal;receipt.signedAt=transaction.signedDate
            return receipt
        }()
        try await onRepository{r in
            // Deleted-account tombstones can be finished without re-delivery.
            let tombstone=r.object(r.object(r.snapshot?["commerce"])["transactions"])[environment+":"+receipt.id] as? JSONObject
            if tombstone?["deleted"] as? Bool != true {
                guard let spec=try r.commerceProducts().first(where:{$0["id"] as? String==receipt.productID})else{throw EluvaError("STORE_NOT_CONFIGURED")}
                try require(spec["type"] as? String==actualType,"STORE_PRODUCT_MISMATCH")
            }
            try r.recordStoreTransaction(receipt)
        }
        await transaction.finish()
    }
    private func deliverStatus(_ status:Product.SubscriptionInfo.Status)async throws {
        guard case .verified(let transaction)=status.transaction,
              case .verified(let info)=status.renewalInfo,
              info.originalTransactionID==transaction.originalID else{throw EluvaError("STORE_VERIFICATION_FAILED")}
        let state:String
        switch status.state {case .subscribed:state="active";case .inGracePeriod:state="gracePeriod";case .inBillingRetryPeriod:state="billingRetry";case .revoked:state="revoked";default:state="expired"}
        let renewal=VerifiedSubscriptionRenewal(state:state,willAutoRenew:info.willAutoRenew,signedAt:info.signedDate,graceUntil:info.gracePeriodExpirationDate,nextProductID:info.autoRenewPreference)
        try await deliver(status.transaction,renewal:renewal)
    }
    private func reconcile(strict:Bool=false)async throws {
        let configured=try await onRepository{r in try r.commerceProducts().compactMap{$0["id"] as? String}}
        guard !configured.isEmpty else{return}
        let ids=Set(configured);var groups=Set<String>(),failure:Error?
        func retain(_ error:Error){if (error as? EluvaError)?.code != "STORE_ACCOUNT_MISMATCH"{failure=error}}
        for await value in Transaction.unfinished {
            guard case .verified(let t)=value,ids.contains(t.productID) else{continue}
            do{try await deliver(value)}catch{retain(error)}
        }
        // Full verified history retains expired/revoked subscriptions as well as
        // current ones. Finished consumables are never re-granted from history.
        for await value in Transaction.all {
            guard case .verified(let t)=value,t.productType != .consumable,ids.contains(t.productID) else{continue}
            if let group=t.subscriptionGroupID{groups.insert(group)}
            do{try await deliver(value)}catch{retain(error)}
        }
        for group in groups {
            do{for status in try await Product.SubscriptionInfo.status(for:group){try await deliverStatus(status)}}catch{retain(error)}
        }
        if let failure{throw failure}
        lastReconciled=Date()
    }
    private func checkCurrentAccount(_ token:UUID,ids:Set<String>,allowOwned:Bool=false)async throws {
        var owned=false,foreign=false
        for await value in Transaction.currentEntitlements {
            guard case .verified(let t)=value,t.productType == .autoRenewable,ids.contains(t.productID),!t.isUpgraded else{continue}
            let environment=t.environment == .production ? "production":t.environment == .sandbox ? "sandbox":"xcode"
            let saved=try await onRepository{r in r.tokenForStoreOriginal(String(t.originalID),environment:environment)}
            let candidate=t.appAccountToken ?? saved
            let matches=try await onRepository{r in
                guard let candidate,let owner=r.storeOwnerForToken(token.uuidString.lowercased(),state:r.snapshot!)else{return false}
                return r.storeOwnerForToken(candidate.uuidString.lowercased(),state:r.snapshot!)==owner
            }
            if matches{owned=true}else{foreign=true}
        }
        try require(!foreign || (allowOwned && owned),"STORE_ACCOUNT_MISMATCH")
    }
    private func load()async throws->JSONObject {
        let specs=try await onRepository{r in _=try r.contentOwner(r.snapshot!);return try r.commerceProducts()}
        guard !specs.isEmpty else{products=[:];return ["configured":false,"platform":"ios","canPurchase":false,"products":[],"reason":"STORE_NOT_CONFIGURED"]}
        let values=try await Product.products(for:specs.compactMap{$0["id"] as? String})
        products=Dictionary(uniqueKeysWithValues:values.map{($0.id,$0)})
        var rows:[JSONObject]=[],groups=Set<String>()
        for spec in specs {
            guard let product=products[spec["id"] as? String ?? ""] else{continue}
            try require(type(product.type)==spec["type"] as? String,"STORE_PRODUCT_MISMATCH")
            var row:JSONObject=["id":product.id,"displayName":product.displayName,"description":product.description,"displayPrice":product.displayPrice,"currency":product.priceFormatStyle.currencyCode,"type":type(product.type)]
            if let subscription=product.subscription {
                let unit:String
                switch subscription.subscriptionPeriod.unit{case .day:unit="day";case .week:unit="week";case .month:unit="month";case .year:unit="year";@unknown default:unit="unknown"}
                let value=subscription.subscriptionPeriod.value
                if let expected=spec["periodUnit"] as? String{try require(unit==expected && value==spec["periodValue"] as? Int,"STORE_PRODUCT_MISMATCH")}
                row["periodUnit"]=unit;row["periodValue"]=value;groups.insert(subscription.subscriptionGroupID)
            }
            row["plan"]=spec["plan"] ?? ""
            rows.append(row)
        }
        try require(groups.count<=1,"STORE_PRODUCT_MISMATCH")
        return ["configured":true,"platform":"ios","canPurchase": !rows.isEmpty && AppStore.canMakePayments,"products":rows,"reason":rows.isEmpty ? "STORE_PRODUCTS_UNAVAILABLE":AppStore.canMakePayments ? "":"STORE_RESTRICTED","missingProductCount":specs.count-rows.count]
    }
    private func scheduleRefresh(owner:String?) {
        guard refreshTask==nil,(owner != reconciledOwner || Date().timeIntervalSince(lastReconciled)>60)else{return}
        reconciledOwner=owner;lastReconciled=Date()
        refreshTask=Task{[weak self] in
            guard let self else{return};defer{refreshTask=nil}
            do{try await reconcile()}catch{log.error("Using saved verified subscription until its recorded expiry")}
        }
    }
    func perform(_ method:String,params:JSONObject,scene:UIWindowScene?=nil,valid:@escaping ()->Bool,completion:@escaping(Result<JSONObject,Error>)->Void){
        guard ["products","purchase","restore","snapshot","manage"].contains(method)else{completion(.failure(EluvaError("METHOD_NOT_FOUND")));return}
        guard !busy || method=="snapshot" else{completion(.failure(EluvaError("STORE_BUSY")));return}
        let ownsLock=method != "snapshot"
        if ownsLock{busy=true}
        Task{[weak self] in guard let self else{return};defer{if ownsLock{busy=false}}
            do {
                try require(valid(),"CANCELLED")
                let initial=try await onRepository{r in try r.storeContext()}
                let initialOwner=initial["ownerId"] as? String
                var result:JSONObject
                switch method {
                case "products":result=try await load()
                case "purchase":
                    try require(AppStore.canMakePayments,"STORE_RESTRICTED")
                    let metadata=try await load()
                    try require(metadata["configured"] as? Bool==true,"STORE_NOT_CONFIGURED")
                    let id=params["productId"] as? String ?? ""
                    guard let product=products[id]else{throw EluvaError("STORE_PRODUCTS_UNAVAILABLE")}
                    try require(params["displayPrice"] as? String==product.displayPrice && params["currency"] as? String==product.priceFormatStyle.currencyCode,"STORE_PRICE_CHANGED")
                    let current=try await onRepository{r in try r.storeContext()}
                    try require(initial["ownerId"] as? String==current["ownerId"] as? String && valid(),"CANCELLED")
                    guard let token=UUID(uuidString:initial["token"] as? String ?? "")else{throw EluvaError("STORE_ACCOUNT_MISMATCH")}
                    try await checkCurrentAccount(token,ids:Set(products.keys))
                    switch try await product.purchase(options:[.appAccountToken(token)]) {
                    case .userCancelled:result=["status":"cancelled"]
                    case .pending:if product.type == .autoRenewable{try await onRepository{r in try r.pendingSubscription(id,owner:initialOwner)}};result=["status":"pending"]
                    case .success(let verified):try await deliver(verified);try? await reconcile();result=["status":"success"]
                    @unknown default:throw EluvaError("STORE_FAILED")
                    }
                case "restore":
                    let specs=try await onRepository{r in try r.commerceProducts()};try require(!specs.isEmpty,"STORE_NOT_CONFIGURED")
                    try require(valid(),"CANCELLED")
                    try await AppStore.sync();try await reconcile(strict:true)
                    guard let token=UUID(uuidString:initial["token"] as? String ?? "")else{throw EluvaError("STORE_ACCOUNT_MISMATCH")}
                    try await checkCurrentAccount(token,ids:Set(specs.compactMap{$0["id"] as? String}),allowOwned:true)
                    let snapshot=try await onRepository{r in try r.commerceSnapshot(r.snapshot!)}
                    let subscription=snapshot["subscription"] as? JSONObject ?? [:]
                    result=["status":subscription["active"] as? Bool==true ? "restored":subscription["status"] as? String=="none" ? "nothingToRestore":"restoredInactive","consumablesRestorable":false]
                case "manage":
                    guard let scene else{throw EluvaError("DEVICE_UNSUPPORTED")}
                    try await AppStore.showManageSubscriptions(in:scene);try await reconcile();result=[:]
                default:
                    scheduleRefresh(owner:initial["ownerId"] as? String)
                    result=[:]
                }
                let wallet=try await onRepository{r in try require(r.currentUser(r.snapshot!)?["id"] as? String==initialOwner,"AUTH_REQUIRED");return try r.commerceSnapshot(r.snapshot!)}
                result["snapshot"]=wallet
                if valid(){completion(.success(result))}
            }catch{if valid(){if method=="purchase",let storeError=error as? StoreKitError,case .userCancelled=storeError{completion(.success(["status":"cancelled"]));return};let code=(error as? EluvaError)?.code ?? (error is CancellationError ? "CANCELLED":"STORE_FAILED");completion(.failure(EluvaError(code)))}}
        }
    }
}

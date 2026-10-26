import Foundation
import CryptoKit

// Only StoreCoordinator creates receipts from StoreKit .verified results.
// This type is deliberately absent from the JavaScript RPC dispatch table.
struct AffectiveAttunement:Sendable {
    let id:String, productID:String, environment:String, token:UUID, purchasedAt:Date
    var expiresAt:Date?, revokedAt:Date?, upgraded=false
    var quantity=1
    var signedAt:Date?
    var originalID:String?
    var renewal:EmotionalResonance?
}

struct EmotionalResonance:Sendable {
    let state:String, willAutoRenew:Bool, signedAt:Date
    var graceUntil:Date?, nextProductID:String?
}

extension EmpathyOrientation {
    var commercePolicy:JSONObject {
        guard let url=CognitiveFlexibility.shared.url(forResource:"commerce-policy",withExtension:"json",subdirectory:"config"),let data=try? Data(contentsOf:url),let result=try? JSONSerialization.jsonObject(with:data) as? JSONObject else{return ["version":1,"confirmed":false,"products":[]]}
        return result
    }
    func commerceProducts()throws->[JSONObject] {
        let p=commercePolicy
        try require(p["version"] as? Int==1,"STORE_CONFIGURATION_INVALID")
        guard p["confirmed"] as? Bool==true else{return []}
        let items=array(p["products"]), ids=items.compactMap{$0["id"] as? String}
        try require(!items.isEmpty && ids.count==items.count && Set(ids).count==ids.count,"STORE_CONFIGURATION_INVALID")
        for item in items {
            let type=item["type"] as? String ?? "", coins=item["coins"] as? Int ?? 0, right=item["entitlement"] as? String ?? ""
            try require(!(item["id"] as? String ?? "").isEmpty && ["consumable","nonConsumable","autoRenewable","nonRenewable"].contains(type),"STORE_CONFIGURATION_INVALID")
            try require(type=="consumable" ? coins>0 && coins<=1_000_000_000 && right.isEmpty : coins==0 && !right.isEmpty,"STORE_CONFIGURATION_INVALID")
            if type=="nonRenewable" {try require((item["durationSeconds"] as? Int ?? 0)>0,"STORE_CONFIGURATION_INVALID")}
        }
        if let cap=p["publicPostFree"] as? Int {try require(cap>=0 && (p["resetTimeZone"] as? String).flatMap(TimeZone.init(identifier:)) != nil,"STORE_CONFIGURATION_INVALID")}
        if let cost=p["publicPostCoinCost"] as? Int {try require(cost>0 && ["production","sandbox","xcode"].contains(p["spendEnvironment"] as? String ?? ""),"STORE_CONFIGURATION_INVALID")}
        return items
    }
    func ensureCommerce(_ state:inout JSONObject)throws {
        if state["commerce"]==nil {state["commerce"]=["version":1,"accounts":JSONObject(),"transactions":JSONObject()]}
        let c=object(state["commerce"])
        try require(c["version"] as? Int==1 && c["accounts"] is JSONObject && c["transactions"] is JSONObject,"STORAGE_CORRUPT")
        for raw in object(c["accounts"]).values {
            let a=object(raw);try require(["usage","rewards","wallets","ledger"].allSatisfy{a[$0] is JSONObject},"STORAGE_CORRUPT")
            for wallet in object(a["wallets"]).values {let w=object(wallet);try require(w["balance"] is Int && (w["balance"] as! Int)>=0,"STORAGE_CORRUPT")}
            for row in object(a["ledger"]).values {let r=object(row);try require(r["createdAt"] is String && r["amount"] is Int,"STORAGE_CORRUPT")}
        }
    }
    func commerceAccount(_ state:inout JSONObject,_ owner:String)throws->JSONObject {
        try ensureCommerce(&state);try require(object(state["accounts"])[owner] != nil,"AUTH_REQUIRED")
        let c=object(state["commerce"]),accounts=object(c["accounts"])
        return accounts[owner] as? JSONObject ?? ["usage":JSONObject(),"rewards":JSONObject(),"wallets":JSONObject(),"ledger":JSONObject()]
    }
    func putCommerceAccount(_ state:inout JSONObject,_ owner:String,_ account:JSONObject) {
        var c=object(state["commerce"]),accounts=object(c["accounts"]);accounts[owner]=account;c["accounts"]=accounts;state["commerce"]=c
    }
    func storeContext()throws->JSONObject {
        try prepare();var next=snapshot!;let owner=try contentOwner(next);var a=try commerceAccount(&next,owner)
    
        let email=(object(object(next["accounts"])[owner])["email"] as? String ?? owner).lowercased()
        var bytes=Array(SHA256.hash(data:Data(("Eluva.StoreKit.account.v1:"+email).utf8)).prefix(16))
        bytes[6]=(bytes[6]&0x0f)|0x50;bytes[8]=(bytes[8]&0x3f)|0x80
        let hex=bytes.map{String(format:"%02x",$0)}.joined(),parts=[8,4,4,4,12];var index=hex.startIndex,groups=[String]()
        for count in parts{let end=hex.index(index,offsetBy:count);groups.append(String(hex[index..<end]));index=end}
        let canonical=groups.joined(separator:"-")
        if a["token"] as? String != canonical {
            var aliases=a["tokenAliases"] as? [String] ?? []
            if let previous=a["token"] as? String,!aliases.contains(previous){aliases.append(previous)}
            a["tokenAliases"]=aliases;a["token"]=canonical;putCommerceAccount(&next,owner,a);try persist(next)
        }
        return ["ownerId":owner,"token":a["token"]!]
    }
    func quotaDay(_ date:Date)->String {
        let formatter=DateFormatter();formatter.locale=Locale(identifier:"en_US_POSIX");formatter.dateFormat="yyyy-MM-dd"
        formatter.timeZone=(commercePolicy["confirmed"] as? Bool==true ? (commercePolicy["resetTimeZone"] as? String).flatMap(TimeZone.init(identifier:)) : nil) ?? TimeZone(secondsFromGMT:0)!
        return formatter.string(from:date)
    }
    func consumePublicPost(_ state:inout JSONObject,owner:String,commit:String,post:String,hidden:Bool,date:Date)throws {
        if hidden{return}
        var a=try commerceAccount(&state,owner),usage=object(a["usage"]),ledger=object(a["ledger"]),rewards=object(a["rewards"]),wallets=object(a["wallets"])
        let id="post:"+commit,day=quotaDay(date),key="publicPost:"+day,prior=object(ledger[id])
        if !prior.isEmpty {try require(prior["targetId"] as? String==post,"COMMIT_CONFLICT");return}
        let used=usage[key] as? Int ?? object(content(state)["quota"])[owner+":"+day] as? Int ?? 0
        try require(used>=0 && used<Int.max,"STORAGE_CORRUPT")
        let confirmed=commercePolicy["confirmed"] as? Bool==true,limit=(confirmed ? commercePolicy["publicPostFree"] as? Int : nil) ?? contentPolicy["dailyPublicPosts"] as? Int
        var bucket=limit==nil ? "unlimited":"free",amount=1,environment="localPreview"
        if let limit,used>=limit {
            if (rewards["publicPost"] as? Int ?? 0)>0 {bucket="reward";rewards["publicPost"]=(rewards["publicPost"] as! Int)-1}
            else if confirmed,let cost=commercePolicy["publicPostCoinCost"] as? Int,cost>0,let env=commercePolicy["spendEnvironment"] as? String,["production","sandbox","xcode"].contains(env) {
                var wallet=object(wallets[env]);let balance=wallet["balance"] as? Int ?? 0
                try require(wallet["reviewRequired"] as? Bool != true && balance>=cost,"INSUFFICIENT_BALANCE")
                wallet["balance"]=balance-cost;wallets[env]=wallet;bucket="coins";amount = -cost;environment=env
            }else{throw EluvaError("QUOTA_EXHAUSTED")}
        }
        if bucket=="free" || bucket=="unlimited" {usage[key]=used+1}
        ledger[id]=["id":id,"kind":"publicPost","targetId":post,"day":day,"bucket":bucket,"amount":amount,"environment":environment,"createdAt":ISO8601DateFormatter().string(from:date)]
        a["usage"]=usage;a["rewards"]=rewards;a["wallets"]=wallets;a["ledger"]=ledger;putCommerceAccount(&state,owner,a)
    }
    func recordStoreTransaction(_ receipt:AffectiveAttunement)throws {
        try prepare();var next=snapshot!;try ensureCommerce(&next)
        try require(["production","sandbox","xcode"].contains(receipt.environment) && !receipt.id.isEmpty && receipt.quantity==1,"STORE_VERIFICATION_FAILED")
        var c=object(next["commerce"]),transactions=object(c["transactions"])
        let key=receipt.environment+":"+receipt.id,prior=object(transactions[key])
        if prior["deleted"] as? Bool==true {return}
        let configuredProducts=try commerceProducts()
        guard let product=configuredProducts.first(where:{$0["id"] as? String==receipt.productID})else{throw EluvaError("STORE_NOT_CONFIGURED")}
        let token=receipt.token.uuidString.lowercased(),owner=storeOwnerForToken(token,state:next)
        try require(owner != nil && object(next["accounts"])[owner!] != nil,"STORE_ACCOUNT_MISMATCH")
        let ownerID=owner!,purchased=ISO8601DateFormatter().string(from:receipt.purchasedAt)
        if !prior.isEmpty {try require(prior["ownerId"] as? String==ownerID && prior["productId"] as? String==receipt.productID && prior["token"] as? String==token && prior["purchasedAt"] as? String==purchased,"STORE_VERIFICATION_FAILED")}
        var a=try commerceAccount(&next,ownerID),wallets=object(a["wallets"]),wallet=object(wallets[receipt.environment]),ledger=object(a["ledger"])
        let hadPending=a["pendingProductId"] != nil
        let balance=wallet["balance"] as? Int ?? 0,coins=product["coins"] as? Int ?? 0
        try require(balance>=0 && balance<=Int.max-coins,"STORAGE_CORRUPT");wallet["balance"]=balance
        var transaction=prior
        if transaction.isEmpty {transaction=["ownerId":ownerID,"token":token,"productId":receipt.productID,"purchasedAt":purchased,"environment":receipt.environment,"coins":coins,"entitlement":product["entitlement"] ?? "", "type":product["type"] ?? "", "plan":product["plan"] ?? "", "originalId":receipt.originalID ?? receipt.id]}
        transaction["type"]=product["type"] ?? "";transaction["plan"]=product["plan"] ?? ""
        if transaction["originalId"]==nil{transaction["originalId"]=receipt.originalID ?? receipt.id}
        if prior.isEmpty && receipt.revokedAt==nil {
            wallet["balance"]=balance+coins
            ledger[key]=["id":key,"kind":coins>0 ? "purchase":"subscription","productId":receipt.productID,"bucket":coins>0 ? "coins":"subscription","amount":coins,"environment":receipt.environment,"createdAt":purchased]
        }
        if let revoked=receipt.revokedAt {
            transaction["revokedAt"]=ISO8601DateFormatter().string(from:revoked)
            if coins>0 {wallet["reviewRequired"]=true} // Refund spending policy must be approved; never silently create debt.
        }
        transaction["upgraded"]=(prior["upgraded"] as? Bool==true)||receipt.upgraded
        if let expiry=receipt.expiresAt {
            if receipt.signedAt == nil || receipt.signedAt!.timeIntervalSince1970 >= (prior["transactionSignedAt"] as? Double ?? 0) {transaction["expiresAt"]=expiry.timeIntervalSince1970;transaction["transactionSignedAt"]=receipt.signedAt?.timeIntervalSince1970 ?? 0}
        }
        else if product["type"] as? String=="nonRenewable",let duration=product["durationSeconds"] as? Int {transaction["expiresAt"]=receipt.purchasedAt.addingTimeInterval(Double(duration)).timeIntervalSince1970}
        else if product["type"] as? String=="autoRenewable" {throw EluvaError("STORE_VERIFICATION_FAILED")}
        var confirmedScheduledPending=false
        if let renewal=receipt.renewal,renewal.signedAt.timeIntervalSince1970 >= (prior["renewalSignedAt"] as? Double ?? 0) {
            transaction["renewalState"]=renewal.state;transaction["willAutoRenew"]=renewal.willAutoRenew
            transaction["renewalSignedAt"]=renewal.signedAt.timeIntervalSince1970
            transaction["graceUntil"]=renewal.graceUntil?.timeIntervalSince1970 ?? NSNull()
            transaction["nextProductId"]=renewal.nextProductID ?? NSNull()
            // Approval may confirm a different product for the next renewal
            // without creating that product's transaction yet. Only a verified
            // renewal signed after this pending request can resolve it.
            if let pending=a["pendingProductId"] as? String,let pendingAt=a["pendingAt"] as? Double {
                let knownProPlan=configuredProducts.contains{$0["id"] as? String==pending && $0["entitlement"] as? String=="pro" && $0["type"] as? String=="autoRenewable"}
                let freshForRequest=renewal.signedAt.timeIntervalSince1970>=pendingAt
                confirmedScheduledPending=renewal.state=="active" && renewal.willAutoRenew && renewal.nextProductID==pending && pending != receipt.productID && freshForRequest && knownProPlan
            }
        }
        let confirmsPending=(a["pendingProductId"] as? String==receipt.productID) || confirmedScheduledPending
        if product["entitlement"] as? String=="pro",confirmsPending,transaction["revokedAt"]==nil,transaction["upgraded"] as? Bool != true,!["expired","revoked","billingRetry"].contains(transaction["renewalState"] as? String ?? ""),(transaction["expiresAt"] as? Double ?? 0)>Date().timeIntervalSince1970 {a.removeValue(forKey:"pendingProductId");a.removeValue(forKey:"pendingAt")}
        if !prior.isEmpty, NSDictionary(dictionary:prior).isEqual(to:transaction),!hadPending || a["pendingProductId"] != nil {return}
        wallets[receipt.environment]=wallet;a["wallets"]=wallets;a["ledger"]=ledger;putCommerceAccount(&next,ownerID,a)
        c=object(next["commerce"]);transactions[key]=transaction;c["transactions"]=transactions;next["commerce"]=c
        try persist(next) // Never finish StoreKit before this atomic vault replacement.
    }
    func commerceSnapshot(_ state:JSONObject)throws->JSONObject {
        var state=state;let owner=try contentOwner(state),a=try commerceAccount(&state,owner),day=quotaDay(Date()),c=object(state["commerce"])
        let wallets:[JSONObject]=["production","sandbox","xcode"].map{env in let w=object(object(a["wallets"])[env]);return ["environment":env,"balance":w["balance"] ?? 0,"reviewRequired":w["reviewRequired"] as? Bool==true]}
        let rights=object(c["transactions"]).values.map(object).filter{t in t["ownerId"] as? String==owner && t["revokedAt"]==nil && !["revoked","expired","billingRetry"].contains(t["renewalState"] as? String ?? "") && t["upgraded"] as? Bool != true && (max(t["expiresAt"] as? Double ?? Double.greatestFiniteMagnitude,t["renewalState"] as? String=="gracePeriod" ? (t["graceUntil"] as? Double ?? 0):0)>Date().timeIntervalSince1970) && !(t["entitlement"] as? String ?? "").isEmpty}.map{t -> JSONObject in ["id":t["entitlement"]!,"environment":t["environment"]!,"expiresAt":t["expiresAt"] ?? NSNull()]}
        return ["ownerId":owner,"configured": !(try commerceProducts()).isEmpty,"policyConfirmed":commercePolicy["confirmed"] as? Bool==true,"wallets":wallets,"entitlements":rights,"subscription":subscriptionSnapshot(state,owner:owner),"pendingProductId":a["pendingProductId"] ?? NSNull(),"ledger":object(a["ledger"]).values.map(object).sorted{($0["createdAt"] as? String ?? "")>($1["createdAt"] as? String ?? "")},"quota":["day":day,"timeZone":commercePolicy["resetTimeZone"] ?? NSNull(),"used":object(a["usage"])["publicPost:"+day] ?? object(content(state)["quota"])[owner+":"+day] ?? 0,"limit":commercePolicy["confirmed"] as? Bool==true ? commercePolicy["publicPostFree"] ?? NSNull():NSNull(),"rewards":object(a["rewards"])["publicPost"] ?? 0]]
    }
    func subscriptionSnapshot(_ state:JSONObject,owner:String,now:Date=Date())->JSONObject {
        let rows=object(object(state["commerce"])["transactions"]).map{($0.key,object($0.value))}.filter{$0.1["ownerId"] as? String==owner && $0.1["entitlement"] as? String=="pro"}.map { (key,t)->JSONObject in
            let expiry=t["expiresAt"] as? Double ?? 0,grace=t["renewalState"] as? String=="gracePeriod" ? t["graceUntil"] as? Double ?? 0:0,until=max(expiry,grace)
            let status=t["revokedAt"] != nil || t["renewalState"] as? String=="revoked" ? "revoked" : t["upgraded"] as? Bool==true ? "superseded" : ["expired","billingRetry"].contains(t["renewalState"] as? String ?? "") ? t["renewalState"] as! String : until>now.timeIntervalSince1970 ? (grace>now.timeIntervalSince1970 ? "gracePeriod":"active") : t["renewalState"] as? String=="billingRetry" ? "billingRetry":"expired"
            return ["transactionId":key,"originalTransactionId":t["originalId"] ?? key,"productId":t["productId"] ?? "","plan":t["plan"] ?? "","environment":t["environment"] ?? "","purchasedAt":t["purchasedAt"] ?? "","expiresAt":expiry,"accessUntil":until,"willAutoRenew":t["willAutoRenew"] ?? NSNull(),"nextProductId":t["nextProductId"] ?? NSNull(),"status":status,"active":["active","gracePeriod"].contains(status)]
        }.sorted { a,b in
            if (a["active"] as? Bool)==true && (b["active"] as? Bool) != true{return true}
            if (a["active"] as? Bool) != true && (b["active"] as? Bool)==true{return false}
            return (a["accessUntil"] as? Double ?? 0)>(b["accessUntil"] as? Double ?? 0)
        }
        return rows.first ?? ["status":"none","active":false]
    }
    func hasProAccess(_ state:JSONObject,owner:String,now:Date=Date())->Bool {
        guard object(state["accounts"])[owner] != nil else{return false}
        return subscriptionSnapshot(state,owner:owner,now:now)["active"] as? Bool==true
    }
    func pendingSubscription(_ productID:String,owner:String?=nil)throws {
        var next=snapshot!;let owner=try owner ?? contentOwner(next);var a=try commerceAccount(&next,owner)
        a["pendingProductId"]=productID;a["pendingAt"]=Date().timeIntervalSince1970;putCommerceAccount(&next,owner,a);try persist(next)
    }
    func storeOwnerForToken(_ token:String,state:JSONObject)->String? {
        object(object(state["commerce"])["accounts"]).first { _,raw in
            let a=object(raw);return a["token"] as? String==token || (a["tokenAliases"] as? [String] ?? []).contains(token)
        }?.key
    }
    func tokenForStoreOriginal(_ originalID:String,environment:String)->UUID? {
        for t in object(object(snapshot?["commerce"])["transactions"]).values.map(object) where t["originalId"] as? String==originalID && t["environment"] as? String==environment {
            if let text=t["token"] as? String,let token=UUID(uuidString:text){return token}
        }
        return nil
    }
    func executeCommerce(_ method:String,params:JSONObject)throws->JSONObject {
        if method=="snapshot" {return try commerceSnapshot(snapshot!)}
        throw EluvaError("METHOD_NOT_FOUND") // No JS path to grants, debit, tokens or verification.
    }
    func removeCommerceAccount(_ state:inout JSONObject,_ owner:String)throws {
        guard state["commerce"] != nil else{return};try ensureCommerce(&state)
        var c=object(state["commerce"]),accounts=object(c["accounts"]),transactions=object(c["transactions"]);accounts.removeValue(forKey:owner)
        for (key,raw) in transactions where object(raw)["ownerId"] as? String==owner {transactions[key]=["deleted":true]}
        c["accounts"]=accounts;c["transactions"]=transactions;state["commerce"]=c
    }
}

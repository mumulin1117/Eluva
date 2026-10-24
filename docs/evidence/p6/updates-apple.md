<!--
{
  "availability" : [
    "iOS: 15.0.0 -",
    "iPadOS: 15.0.0 -",
    "macOS: 12.0.0 -",
    "tvOS: 15.0.0 -",
    "visionOS: 1.0.0 -",
    "watchOS: 8.0.0 -"
  ],
  "documentType" : "symbol",
  "framework" : "StoreKit",
  "identifier" : "/documentation/StoreKit/Transaction/updates",
  "metadataVersion" : "0.1.0",
  "role" : "Type Property",
  "symbol" : {
    "kind" : "Type Property",
    "modules" : [
      "StoreKit"
    ],
    "preciseIdentifier" : "s:8StoreKit11TransactionV7updatesAC12TransactionsVvpZ"
  },
  "title" : "updates"
}
-->

# updates

The asynchronous sequence that emits a transaction when the system creates or updates transactions that occur outside the app or on other devices.

```
static var updates: Transaction.Transactions { get }
```

## Discussion

Use [`updates`](/documentation/StoreKit/Transaction/updates) to receive new transactions while the app is running. This sequence receives transactions that occur outside of the app, such as Ask to Buy transactions, offer code redemptions, and purchases that customers make in the App Store. It also emits transactions that customers complete in your app on another device.

Note that after a successful Apple In-App Purchase on the same device, StoreKit returns the transaction through [`Product.PurchaseResult.success(_:)`](/documentation/StoreKit/Product/PurchaseResult/success(_:)).

> Important:
> Create a <doc://com.apple.documentation/documentation/Swift/Task> to iterate through the transactions from the listener as soon as your app launches. If your app has unfinished transactions, the ``doc://com.apple.storekit/documentation/StoreKit/Transaction/updates`` listener receives them once, immediately after the app launches. Without the <doc://com.apple.documentation/documentation/Swift/Task> to listen for these transactions, your app may miss them.

The following example shows a class that creates a <doc://com.apple.documentation/documentation/Swift/Task> when it initializes. The task retrieves and processes any unfinished transactions.

```swift
final class TransactionObserver {
    
    var updates: Task<Void, Never>? = nil
    
    init() {
        updates = newTransactionListenerTask()
    }

    deinit {
        // Cancel the update handling task when you deinitialize the class.
        updates?.cancel()
    }
    
    private func newTransactionListenerTask() -> Task<Void, Never> {
        Task(priority: .background) {
            for await verificationResult in Transaction.updates {
                self.handle(updatedTransaction: verificationResult)
            }
        }
    }
    
    private func handle(updatedTransaction verificationResult: VerificationResult<Transaction>) {
        guard case .verified(let transaction) = verificationResult else {
            // Ignore unverified transactions.
            return
        }

        if let revocationDate = transaction.revocationDate {
            // Remove access to the product identified by transaction.productID.
            // Transaction.revocationReason provides details about
            // the revoked transaction.
            <#...#>
        } else if let expirationDate = transaction.expirationDate,
            expirationDate < Date() {
            // Do nothing, this subscription is expired.
            return
        } else if transaction.isUpgraded {
            // Do nothing, there is an active transaction
            // for a higher level of service.
            return
        } else {
            // Provide access to the product identified by
            // transaction.productID.
            <#...#>
        }
    }
    
}
```

The [`updates`](/documentation/StoreKit/Transaction/updates) listener receives unfinished transactions just once at app launch, but you can use the [`unfinished`](/documentation/StoreKit/Transaction/unfinished) listener to get your app’s unfinished transactions at any time. For information on finishing transactions, see [`finish()`](/documentation/StoreKit/Transaction/finish()).

## See Also

[Supporting offer codes in your app](/documentation/StoreKit/supporting-offer-codes-in-your-app)

Enable customers to redeem offer codes through the App Store or within your app.



---

Copyright &copy; 2026 Apple Inc. All rights reserved. | [Terms of Use](https://www.apple.com/legal/internet-services/terms/site.html) | [Privacy Policy](https://www.apple.com/privacy/privacy-policy)
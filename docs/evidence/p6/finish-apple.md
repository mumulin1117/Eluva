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
  "identifier" : "/documentation/StoreKit/Transaction/finish()",
  "metadataVersion" : "0.1.0",
  "role" : "Instance Method",
  "symbol" : {
    "kind" : "Instance Method",
    "modules" : [
      "StoreKit"
    ],
    "preciseIdentifier" : "s:8StoreKit11TransactionV6finishyyYaF"
  },
  "title" : "finish()"
}
-->

# finish()

Indicates to the App Store that the app delivered the purchased content or enabled the service to finish the transaction.

```
func finish() async
```

## Discussion

Call [`finish()`](/documentation/StoreKit/Transaction/finish()) to complete a transaction after you deliver the purchased content or enable the purchased service. For on-demand resources, don’t finish the transaction until the app completes downloading the resource or you’ve otherwise delivered the resource.

---

Copyright &copy; 2026 Apple Inc. All rights reserved. | [Terms of Use](https://www.apple.com/legal/internet-services/terms/site.html) | [Privacy Policy](https://www.apple.com/privacy/privacy-policy)
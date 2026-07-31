//
//  SafariWebExtensionHandler.swift
//  CookieKit Extension
//
//  Created by Taj Tkalec on 31. 7. 2026.
//

import SafariServices

final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        context.completeRequest(returningItems: [], completionHandler: nil)
    }

}

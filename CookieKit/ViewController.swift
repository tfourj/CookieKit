//
//  ViewController.swift
//  CookieKit
//
//  Created by Taj Tkalec on 31. 7. 2026.
//

import UIKit
import SafariServices
import WebKit

private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {

    weak var delegate: WKScriptMessageHandler?

    init(delegate: WKScriptMessageHandler) {
        self.delegate = delegate
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        delegate?.userContentController(userContentController, didReceive: message)
    }

}

final class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    private static let extensionStateTimeout: TimeInterval = 5

    private lazy var scriptMessageHandler = WeakScriptMessageHandler(delegate: self)
    private var webContentIsReady = false
    private var extensionStateRequestID = 0

    private var extensionBundleIdentifier: String {
        let appIdentifier = Bundle.main.bundleIdentifier ?? "com.tfourj.CookieKit"
        return "\(appIdentifier).Extension"
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        webView.navigationDelegate = self
        webView.scrollView.isScrollEnabled = true
        webView.scrollView.alwaysBounceVertical = true

        webView.configuration.userContentController.add(
            scriptMessageHandler,
            name: "controller"
        )

        guard
            let pageURL = Bundle.main.url(forResource: "Main", withExtension: "html"),
            let resourceURL = Bundle.main.resourceURL
        else {
            assertionFailure("The CookieKit onboarding resources are missing.")
            return
        }

        webView.loadFileURL(pageURL, allowingReadAccessTo: resourceURL)

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        webView?.configuration.userContentController.removeScriptMessageHandler(
            forName: "controller"
        )
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webContentIsReady = true
        refreshExtensionState()
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard
            navigationAction.navigationType == .linkActivated,
            let url = navigationAction.request.url,
            let scheme = url.scheme?.lowercased(),
            scheme == "http" || scheme == "https"
        else {
            decisionHandler(.allow)
            return
        }

        present(SFSafariViewController(url: url), animated: true)
        decisionHandler(.cancel)
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard
            message.frameInfo.isMainFrame,
            let payload = message.body as? [String: Any],
            let action = payload["action"] as? String
        else {
            return
        }

        switch action {
        case "openExtensionSettings":
            openExtensionSettings()
        case "refreshExtensionState":
            refreshExtensionState()
        default:
            break
        }
    }

    @objc private func applicationDidBecomeActive() {
        refreshExtensionState()
    }

    private func refreshExtensionState() {
        guard webContentIsReady else {
            return
        }

        guard #available(iOS 26.2, *) else {
            updateWebExtensionState(state: "manual", canOpenSettings: false)
            return
        }

        extensionStateRequestID += 1
        let requestID = extensionStateRequestID
        updateWebExtensionState(state: "checking", canOpenSettings: true)
        scheduleExtensionStateTimeout(for: requestID)

        SFSafariExtensionManager.getStateOfExtension(
            withIdentifier: extensionBundleIdentifier
        ) { [weak self] state, error in
            DispatchQueue.main.async { [weak self] in
                guard
                    let self,
                    requestID == self.extensionStateRequestID
                else {
                    return
                }

                self.extensionStateRequestID += 1

                let status: String
                if error != nil {
                    status = "unknown"
                } else if let state {
                    status = state.isEnabled ? "enabled" : "disabled"
                } else {
                    status = "unknown"
                }

                self.updateWebExtensionState(
                    state: status,
                    canOpenSettings: true
                )
            }
        }
    }

    private func scheduleExtensionStateTimeout(for requestID: Int) {
        DispatchQueue.main.asyncAfter(
            deadline: .now() + Self.extensionStateTimeout
        ) { [weak self] in
            guard
                let self,
                requestID == self.extensionStateRequestID
            else {
                return
            }

            self.extensionStateRequestID += 1
            self.updateWebExtensionState(
                state: "unknown",
                canOpenSettings: true
            )
        }
    }

    private func openExtensionSettings() {
        guard #available(iOS 26.2, *) else {
            return
        }

        SFSafariSettings.openExtensionsSettings(
            forIdentifiers: [extensionBundleIdentifier]
        ) { error in
            #if DEBUG
            if let error {
                print("Failed to open Safari Extensions settings: \(error)")
            }
            #endif
        }
    }

    private func updateWebExtensionState(
        state: String,
        canOpenSettings: Bool
    ) {
        let status: [String: Any] = [
            "state": state,
            "canOpenSettings": canOpenSettings
        ]

        webView.callAsyncJavaScript(
            "window.CookieKit.updateExtensionState(status)",
            arguments: ["status": status],
            in: nil,
            in: .page
        ) { result in
            #if DEBUG
            if case .failure(let error) = result {
                print("Failed to update Safari extension status: \(error)")
            }
            #endif
        }
    }

}

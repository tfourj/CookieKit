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

    private lazy var scriptMessageHandler = WeakScriptMessageHandler(delegate: self)
    private var webContentIsReady = false

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

        SFSafariExtensionManager.getStateOfExtension(
            withIdentifier: extensionBundleIdentifier
        ) { [weak self] state, _ in
            let status: String
            if let state {
                status = state.isEnabled ? "enabled" : "disabled"
            } else {
                status = "unknown"
            }

            DispatchQueue.main.async { [weak self] in
                self?.updateWebExtensionState(
                    state: status,
                    canOpenSettings: true
                )
            }
        }
    }

    private func openExtensionSettings() {
        guard #available(iOS 26.2, *) else {
            return
        }

        SFSafariSettings.openExtensionsSettings(
            forIdentifiers: [extensionBundleIdentifier]
        ) { [weak self] _ in
            Task { @MainActor in
                self?.refreshExtensionState()
            }
        }
    }

    private func updateWebExtensionState(
        state: String,
        canOpenSettings: Bool
    ) {
        let payload: [String: Any] = [
            "state": state,
            "canOpenSettings": canOpenSettings
        ]

        guard
            let data = try? JSONSerialization.data(withJSONObject: payload),
            let json = String(data: data, encoding: .utf8)
        else {
            return
        }

        webView.evaluateJavaScript(
            "window.CookieKit?.updateExtensionState(\(json));"
        )
    }

}

const statusElement = document.querySelector("#extension-status");
const statusLabel = document.querySelector("#extension-status-label");
const openSettingsButton = document.querySelector("#open-settings-button");

const statusMessages = {
    enabled: "Extension enabled",
    disabled: "Extension not enabled",
    manual: "Check Safari Settings",
    unknown: "Status unavailable"
};

function postNativeAction(action) {
    const controller = window.webkit?.messageHandlers?.controller;
    if (controller) {
        controller.postMessage({action});
    }
}

window.CookieKit = {
    updateExtensionState({state, canOpenSettings}) {
        const normalizedState = statusMessages[state] ? state : "unknown";
        statusElement.dataset.state = normalizedState;
        statusLabel.textContent = statusMessages[normalizedState];
        openSettingsButton.hidden = !canOpenSettings;
    }
};

openSettingsButton?.addEventListener("click", () => {
    postNativeAction("openExtensionSettings");
});

postNativeAction("refreshExtensionState");

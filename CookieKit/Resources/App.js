const {
    createOnboardingState,
    getStatusButtonAction,
    shouldShowSetupInstructions
} = window.CookieKitOnboarding;

const statusElement = document.querySelector("#extension-status");
const statusLabel = document.querySelector("#extension-status-label");
const statusDetail = document.querySelector("#extension-status-detail");
const checkStatusButton = document.querySelector("#check-status-button");
const setupInstructions = document.querySelector("#setup-instructions");
const setupPanel = document.querySelector(".setup-panel");
const toggleSetupButton = document.querySelector("#toggle-setup-button");
const openSettingsButton = document.querySelector("#open-settings-button");

let setupExpandedByUser = false;

function postNativeAction(action) {
    const controller = window.webkit?.messageHandlers?.controller;
    if (controller) {
        controller.postMessage({action});
        return true;
    }

    return false;
}

function updateSetupVisibility(setupComplete) {
    const shouldShowInstructions = shouldShowSetupInstructions(
        setupComplete,
        setupExpandedByUser
    );
    setupInstructions.hidden = !shouldShowInstructions;
    toggleSetupButton.hidden = !setupComplete;
    toggleSetupButton.setAttribute(
        "aria-expanded",
        String(shouldShowInstructions)
    );
    toggleSetupButton.textContent = shouldShowInstructions
        ? "Hide setup instructions"
        : "Show setup instructions";
}

function renderExtensionState(state, canOpenSettings) {
    const viewState = createOnboardingState(state);

    statusElement.dataset.state = viewState.state;
    statusElement.dataset.tone = viewState.tone;
    statusLabel.textContent = viewState.label;
    statusDetail.textContent = viewState.detail;
    checkStatusButton.disabled = viewState.state === "checking";
    checkStatusButton.textContent = viewState.state === "manual"
        ? "Show setup instructions"
        : "Check again";
    openSettingsButton.hidden = !canOpenSettings;
    updateSetupVisibility(viewState.setupComplete);
}

window.CookieKit = {
    updateExtensionState({state, canOpenSettings}) {
        renderExtensionState(state, Boolean(canOpenSettings));
    }
};

checkStatusButton?.addEventListener("click", () => {
    const action = getStatusButtonAction(statusElement.dataset.state);
    if (action === "showSetup") {
        setupExpandedByUser = true;
        updateSetupVisibility(false);
        setupPanel?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
        return;
    }

    renderExtensionState("checking", !openSettingsButton.hidden);

    if (!postNativeAction("refreshExtensionState")) {
        renderExtensionState("manual", false);
    }
});

toggleSetupButton?.addEventListener("click", () => {
    setupExpandedByUser = setupInstructions.hidden;
    updateSetupVisibility(true);
});

openSettingsButton?.addEventListener("click", () => {
    postNativeAction("openExtensionSettings");
});

renderExtensionState("checking", false);
if (!postNativeAction("refreshExtensionState")) {
    renderExtensionState("manual", false);
}

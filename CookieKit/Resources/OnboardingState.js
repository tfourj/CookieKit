(function registerCookieKitOnboarding(root) {
    const stateDetails = {
        checking: {
            label: "Checking Safari…",
            detail: "Checking whether CookieKit is enabled.",
            tone: "orange",
            setupComplete: false
        },
        enabled: {
            label: "Enabled in Safari",
            detail: "CookieKit is turned on. Safari manages website access separately for each site.",
            tone: "green",
            setupComplete: true
        },
        disabled: {
            label: "Disabled in Safari",
            detail: "Turn on CookieKit in Safari Extensions, then check again.",
            tone: "red",
            setupComplete: false
        },
        manual: {
            label: "Manual check needed",
            detail: "Automatic status checks require iOS or iPadOS 26.2 or later. Follow the setup steps below.",
            tone: "orange",
            setupComplete: false
        },
        unknown: {
            label: "Could not check Safari",
            detail: "Open CookieKit settings to confirm the extension, then try again.",
            tone: "orange",
            setupComplete: false
        }
    };

    function createOnboardingState(state) {
        const normalizedState = Object.hasOwn(stateDetails, state)
            ? state
            : "unknown";

        return {
            state: normalizedState,
            ...stateDetails[normalizedState]
        };
    }

    function shouldShowSetupInstructions(setupComplete, expandedByUser) {
        return !setupComplete || expandedByUser;
    }

    function getStatusButtonAction(state) {
        return state === "manual" ? "showSetup" : "refresh";
    }

    root.CookieKitOnboarding = Object.freeze({
        createOnboardingState,
        getStatusButtonAction,
        shouldShowSetupInstructions
    });
}(globalThis));

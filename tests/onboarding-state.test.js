import assert from "node:assert/strict";
import test from "node:test";

import "../CookieKit/Resources/OnboardingState.js";

const {
    createOnboardingState,
    getStatusButtonAction,
    shouldShowSetupInstructions
} = globalThis.CookieKitOnboarding;

test("marks enabled Safari extensions as setup complete", () => {
    assert.deepEqual(createOnboardingState("enabled"), {
        state: "enabled",
        label: "Enabled in Safari",
        detail: "CookieKit is turned on. Safari manages website access separately for each site.",
        tone: "green",
        setupComplete: true
    });
});

test("keeps setup incomplete when Safari reports the extension disabled", () => {
    const state = createOnboardingState("disabled");

    assert.equal(state.state, "disabled");
    assert.equal(state.tone, "red");
    assert.equal(state.setupComplete, false);
    assert.match(state.detail, /turn on CookieKit/i);
});

test("uses orange for checking, manual, and unavailable Safari states", () => {
    assert.equal(
        createOnboardingState("checking").label,
        "Checking Safari…"
    );
    assert.equal(createOnboardingState("checking").tone, "orange");
    assert.equal(createOnboardingState("manual").tone, "orange");
    assert.equal(createOnboardingState("unknown").tone, "orange");
});

test("normalizes missing and unsupported Safari states", () => {
    assert.deepEqual(
        createOnboardingState("unexpected"),
        createOnboardingState("unknown")
    );
    assert.deepEqual(
        createOnboardingState(undefined),
        createOnboardingState("unknown")
    );
});

test("collapses completed setup until the user asks to see it", () => {
    assert.equal(shouldShowSetupInstructions(true, false), false);
    assert.equal(shouldShowSetupInstructions(true, true), true);
    assert.equal(shouldShowSetupInstructions(false, false), true);
});

test("uses the status button to show manual setup or refresh a supported check", () => {
    assert.equal(getStatusButtonAction("manual"), "showSetup");
    assert.equal(getStatusButtonAction("enabled"), "refresh");
    assert.equal(getStatusButtonAction("disabled"), "refresh");
    assert.equal(getStatusButtonAction("unknown"), "refresh");
});

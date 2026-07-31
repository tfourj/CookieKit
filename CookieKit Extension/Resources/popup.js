import {
    createNetscapeExport,
    selectCookieStore
} from "./cookie-export.js";

const statusCard = document.querySelector("#status");
const statusTitle = document.querySelector("#status-title");
const statusBody = document.querySelector("#status-body");
const omittedWarning = document.querySelector("#omitted-warning");
const shareButton = document.querySelector("#share-button");
const copyButton = document.querySelector("#copy-button");
const copyLabel = document.querySelector("#copy-label");
const actionNotice = document.querySelector("#action-notice");

let preparedExport = null;
let preparedFile = null;

function message(key, substitutions) {
    return browser.i18n.getMessage(key, substitutions);
}

function localizeDocument() {
    document.documentElement.lang = browser.i18n.getUILanguage();

    for (const element of document.querySelectorAll("[data-i18n]")) {
        const localizedMessage = message(element.dataset.i18n);
        if (localizedMessage) {
            element.textContent = localizedMessage;
        }
    }
}

function setStatus(state, titleKey, bodyKey, titleSubstitutions, bodySubstitutions) {
    statusCard.dataset.state = state;
    statusTitle.textContent = message(titleKey, titleSubstitutions);
    statusBody.textContent = message(bodyKey, bodySubstitutions);
}

function setActionsEnabled(enabled) {
    copyButton.disabled = !enabled;
    shareButton.disabled = !enabled || !supportsFileSharing(preparedFile);
}

function setActionNotice(titleKey, bodyKey) {
    if (!titleKey) {
        actionNotice.hidden = true;
        actionNotice.textContent = "";
        return;
    }

    actionNotice.textContent = `${message(titleKey)} ${message(bodyKey)}`;
    actionNotice.hidden = false;
}

function setOmittedWarning(count) {
    if (!count) {
        omittedWarning.hidden = true;
        omittedWarning.textContent = "";
        return;
    }

    const key = count === 1 ? "omitted_warning_one" : "omitted_warning";
    omittedWarning.textContent = message(key, String(count));
    omittedWarning.hidden = false;
}

function supportsFileSharing(file) {
    if (
        !file
        || typeof navigator.share !== "function"
        || typeof navigator.canShare !== "function"
    ) {
        return false;
    }

    try {
        return navigator.canShare({files: [file]});
    } catch {
        return false;
    }
}

function isSupportedPage(url) {
    return url.protocol === "http:" || url.protocol === "https:";
}

function isPermissionError(error) {
    const description = `${error?.name ?? ""} ${error?.message ?? ""}`.toLowerCase();
    return [
        "denied",
        "not allowed",
        "permission",
        "unauthorized"
    ].some((fragment) => description.includes(fragment));
}

function showError(titleKey, bodyKey) {
    preparedExport = null;
    preparedFile = null;
    setActionsEnabled(false);
    setOmittedWarning(0);
    setActionNotice();
    setStatus("error", titleKey, bodyKey);
}

function showReady(exportResult, hostname) {
    preparedExport = exportResult;
    preparedFile = new File(
        [exportResult.contents],
        exportResult.filename,
        {type: "text/plain"}
    );

    const titleKey = exportResult.exportedCount === 1
        ? "ready_title_one"
        : "ready_title";
    setStatus(
        "ready",
        titleKey,
        "ready_body",
        String(exportResult.exportedCount),
        hostname
    );
    setOmittedWarning(exportResult.omittedCount);
    setActionsEnabled(true);

    if (supportsFileSharing(preparedFile)) {
        setActionNotice();
    } else {
        setActionNotice("share_unavailable_title", "share_unavailable_body");
    }
}

async function prepareCurrentPageExport() {
    try {
        const tabs = await browser.tabs.query({
            active: true,
            currentWindow: true
        });
        const tab = tabs[0];

        if (tab?.id === undefined || !tab.url) {
            showError("tab_error_title", "tab_error_body");
            return;
        }

        const pageURL = new URL(tab.url);
        if (!isSupportedPage(pageURL)) {
            showError("unsupported_title", "unsupported_body");
            return;
        }

        const stores = await browser.cookies.getAllCookieStores();
        const store = selectCookieStore(stores, tab.id);
        if (!store?.id) {
            showError("cookie_error_title", "cookie_error_body");
            return;
        }

        const cookies = await browser.cookies.getAll({
            url: pageURL.href,
            storeId: store.id
        });
        const exportResult = createNetscapeExport(
            cookies,
            pageURL.hostname,
            new Date()
        );

        if (exportResult.exportedCount === 0) {
            setStatus("empty", "empty_title", "empty_body");
            setOmittedWarning(exportResult.omittedCount);
            setActionsEnabled(false);
            return;
        }

        showReady(exportResult, pageURL.hostname);
    } catch (error) {
        if (isPermissionError(error)) {
            showError("permission_title", "permission_body");
        } else {
            showError("cookie_error_title", "cookie_error_body");
        }
    }
}

shareButton.addEventListener("click", async () => {
    if (!preparedFile || !supportsFileSharing(preparedFile)) {
        setActionNotice("share_unavailable_title", "share_unavailable_body");
        return;
    }

    try {
        await navigator.share({
            files: [preparedFile],
            title: preparedFile.name
        });
        setActionNotice();
    } catch (error) {
        if (error?.name !== "AbortError") {
            setActionNotice("share_failed_title", "share_failed_body");
        }
    }
});

copyButton.addEventListener("click", async () => {
    if (!preparedExport) {
        return;
    }

    try {
        await navigator.clipboard.writeText(preparedExport.contents);
        copyLabel.textContent = message("copied_button");
        setActionNotice();

        window.setTimeout(() => {
            copyLabel.textContent = message("copy_button");
        }, 1600);
    } catch {
        setActionNotice("copy_failed_title", "copy_failed_body");
    }
});

localizeDocument();
prepareCurrentPageExport();

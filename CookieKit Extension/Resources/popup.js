import {
    createCookieDisplayRows,
    createJsonExport,
    createNetscapeExport,
    selectCookieStore
} from "./cookie-export.js";
import {
    createCookieRemovalDetails,
    createCookieSetDetails,
    parseCookieImport
} from "./cookie-import.js";

const statusCard = document.querySelector("#status");
const statusTitle = document.querySelector("#status-title");
const statusBody = document.querySelector("#status-body");
const omittedWarning = document.querySelector("#omitted-warning");
const formatSelect = document.querySelector("#format-select");
const exportButton = document.querySelector("#export-button");
const copyButton = document.querySelector("#copy-button");
const copyLabel = document.querySelector("#copy-label");
const importButton = document.querySelector("#import-button");
const importFileInput = document.querySelector("#import-file-input");
const showCookiesButton = document.querySelector("#show-cookies-button");
const showCookiesLabel = document.querySelector("#show-cookies-label");
const cookieViewer = document.querySelector("#cookie-viewer");
const cookieTableBody = document.querySelector("#cookie-table-body");
const cookieEditor = document.querySelector("#cookie-editor");
const cookieEditorForm = document.querySelector("#cookie-editor-form");
const cookieNameInput = document.querySelector("#cookie-name-input");
const cookieValueInput = document.querySelector("#cookie-value-input");
const saveCookieButton = document.querySelector("#save-cookie-button");
const cancelEditButton = document.querySelector("#cancel-edit-button");
const actionNotice = document.querySelector("#action-notice");

let preparedExport = null;
let preparedFile = null;
let preparedCookieRows = [];
let sourceCookies = [];
let sourceHostname = "";
let sourcePageURL = null;
let sourceStoreId = null;
let exportGeneratedAt = null;
let editingCookie = null;

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
    exportButton.disabled = !enabled || !supportsFileSharing(preparedFile);
}

function setImportEnabled(enabled) {
    importButton.disabled = !enabled;
}

function closeCookieEditor() {
    editingCookie = null;
    cookieEditor.hidden = true;
    cookieEditorForm.reset();
}

function openCookieEditor(sourceIndex) {
    const cookie = sourceCookies[sourceIndex];
    if (!cookie) {
        return;
    }

    editingCookie = cookie;
    cookieNameInput.value = typeof cookie.name === "string" ? cookie.name : "";
    cookieValueInput.value = typeof cookie.value === "string" ? cookie.value : "";
    cookieEditor.hidden = false;
    cookieNameInput.focus();
}

function setCookieViewerVisible(visible) {
    const shouldShow = visible && preparedCookieRows.length > 0;
    cookieViewer.hidden = !shouldShow;
    showCookiesButton.setAttribute("aria-expanded", String(shouldShow));
    showCookiesLabel.textContent = message(
        shouldShow ? "hide_cookies_button" : "show_cookies_button"
    );
}

function setCookieRows(rows) {
    preparedCookieRows = rows;
    cookieTableBody.replaceChildren();

    const fragment = document.createDocumentFragment();
    for (const row of rows) {
        const tableRow = document.createElement("tr");
        const keyCell = document.createElement("th");
        const valueCell = document.createElement("td");
        const actionCell = document.createElement("td");
        const editButton = document.createElement("button");

        keyCell.scope = "row";
        keyCell.textContent = row.key;
        valueCell.textContent = row.value;
        editButton.className = "edit-cookie-button";
        editButton.type = "button";
        editButton.dataset.sourceIndex = String(row.sourceIndex);
        editButton.textContent = message("edit_cookie_button");
        editButton.setAttribute(
            "aria-label",
            `${message("edit_cookie_button")}: ${row.key}`
        );
        actionCell.append(editButton);
        tableRow.append(keyCell, valueCell, actionCell);
        fragment.append(tableRow);
    }

    cookieTableBody.append(fragment);
    showCookiesButton.disabled = rows.length === 0;
    setCookieViewerVisible(false);
    closeCookieEditor();
}

function setActionNotice(titleKey, bodyKey, state = "error") {
    if (!titleKey) {
        actionNotice.hidden = true;
        actionNotice.textContent = "";
        delete actionNotice.dataset.state;
        return;
    }

    actionNotice.textContent = `${message(titleKey)} ${message(bodyKey)}`;
    actionNotice.dataset.state = state;
    actionNotice.hidden = false;
}

function showImportNotice(importedCount, skippedCount) {
    if (importedCount === 0) {
        setActionNotice("import_none_title", "import_none_body");
        return;
    }

    const importedKey = importedCount === 1
        ? "import_success_one"
        : "import_success";
    let notice = message(importedKey, String(importedCount));

    if (skippedCount > 0) {
        const skippedKey = skippedCount === 1
            ? "import_skipped_one"
            : "import_skipped";
        notice = `${notice}. ${message(skippedKey, String(skippedCount))}`;
    }

    actionNotice.textContent = notice;
    actionNotice.dataset.state = "success";
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
    sourceCookies = [];
    sourceHostname = "";
    sourcePageURL = null;
    sourceStoreId = null;
    exportGeneratedAt = null;
    formatSelect.disabled = true;
    setCookieRows([]);
    setActionsEnabled(false);
    setImportEnabled(false);
    setOmittedWarning(0);
    setActionNotice();
    setStatus("error", titleKey, bodyKey);
}

function showReady(exportResult, hostname) {
    preparedExport = exportResult;
    preparedFile = new File(
        [exportResult.contents],
        exportResult.filename,
        {
            type: formatSelect.value === "json"
                ? "application/json"
                : "text/plain"
        }
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

function showEmptyExport(exportResult) {
    preparedExport = null;
    preparedFile = null;
    setStatus("empty", "empty_title", "empty_body");
    setOmittedWarning(exportResult.omittedCount);
    setActionsEnabled(false);
    setActionNotice();
}

function prepareSelectedFormat() {
    if (!exportGeneratedAt) {
        return;
    }

    const createExport = formatSelect.value === "json"
        ? createJsonExport
        : createNetscapeExport;
    const exportResult = createExport(
        sourceCookies,
        sourceHostname,
        exportGeneratedAt
    );

    if (exportResult.exportedCount === 0) {
        showEmptyExport(exportResult);
        return;
    }

    showReady(exportResult, sourceHostname);
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
        sourceCookies = cookies;
        sourceHostname = pageURL.hostname;
        sourcePageURL = pageURL;
        sourceStoreId = store.id;
        exportGeneratedAt = new Date();
        setCookieRows(createCookieDisplayRows(cookies));
        setImportEnabled(true);
        formatSelect.disabled = cookies.length === 0;
        prepareSelectedFormat();
    } catch (error) {
        if (isPermissionError(error)) {
            showError("permission_title", "permission_body");
        } else {
            showError("cookie_error_title", "cookie_error_body");
        }
    }
}

exportButton.addEventListener("click", async () => {
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

formatSelect.addEventListener("change", () => {
    copyLabel.textContent = message("copy_button");
    prepareSelectedFormat();
});

showCookiesButton.addEventListener("click", () => {
    setCookieViewerVisible(cookieViewer.hidden);
});

cookieTableBody.addEventListener("click", (event) => {
    const editButton = event.target.closest(".edit-cookie-button");
    if (!editButton) {
        return;
    }

    openCookieEditor(Number(editButton.dataset.sourceIndex));
});

cancelEditButton.addEventListener("click", () => {
    closeCookieEditor();
});

cookieEditorForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!editingCookie || !sourcePageURL || !sourceStoreId) {
        return;
    }

    const originalCookie = editingCookie;
    const updatedCookie = {
        ...originalCookie,
        name: cookieNameInput.value,
        value: cookieValueInput.value
    };
    saveCookieButton.disabled = true;
    cancelEditButton.disabled = true;
    let wroteCookie = false;

    try {
        const savedCookie = await browser.cookies.set(createCookieSetDetails(
            updatedCookie,
            sourcePageURL,
            sourceStoreId
        ));
        if (!savedCookie) {
            throw new Error("Safari did not return the updated cookie");
        }
        wroteCookie = true;

        if (updatedCookie.name !== originalCookie.name) {
            const removedCookie = await browser.cookies.remove(
                createCookieRemovalDetails(
                    originalCookie,
                    sourcePageURL,
                    sourceStoreId
                )
            );
            if (!removedCookie) {
                throw new Error("Safari did not remove the original cookie");
            }
        }

        await prepareCurrentPageExport();
        setActionNotice("edit_success_title", "edit_success_body", "success");
    } catch {
        if (wroteCookie) {
            await prepareCurrentPageExport();
        }
        setActionNotice("edit_failed_title", "edit_failed_body");
    } finally {
        saveCookieButton.disabled = false;
        cancelEditButton.disabled = false;
    }
});

importButton.addEventListener("click", () => {
    importFileInput.click();
});

importFileInput.addEventListener("change", async () => {
    const file = importFileInput.files?.[0];
    if (!file || !sourcePageURL || !sourceStoreId) {
        return;
    }

    const pageURL = sourcePageURL;
    const storeId = sourceStoreId;
    setImportEnabled(false);

    try {
        const parsedImport = parseCookieImport(await file.text(), file.name);
        let importedCount = 0;
        let skippedCount = parsedImport.omittedCount;

        for (const cookie of parsedImport.cookies) {
            try {
                const importedCookie = await browser.cookies.set(
                    createCookieSetDetails(cookie, pageURL, storeId)
                );
                if (!importedCookie) {
                    throw new Error("Safari did not return the imported cookie");
                }
                importedCount += 1;
            } catch {
                skippedCount += 1;
            }
        }

        await prepareCurrentPageExport();
        showImportNotice(importedCount, skippedCount);
    } catch {
        setActionNotice("import_failed_title", "import_failed_body");
    } finally {
        importFileInput.value = "";
        setImportEnabled(Boolean(sourcePageURL && sourceStoreId));
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

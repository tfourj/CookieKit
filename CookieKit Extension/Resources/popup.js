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
import {runStorageOperation} from "./page-storage.js";
import {createStorageJsonExport, parseStorageJson} from "./storage-json.js";

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
const cookiesTab = document.querySelector("#cookies-tab");
const localStorageTab = document.querySelector("#local-storage-tab");
const cookiesPanel = document.querySelector("#cookies-panel");
const localStoragePanel = document.querySelector("#local-storage-panel");
const storageStatus = document.querySelector("#storage-status");
const storageStatusTitle = document.querySelector("#storage-status-title");
const storageStatusBody = document.querySelector("#storage-status-body");
const storageExportButton = document.querySelector("#storage-export-button");
const storageCopyButton = document.querySelector("#storage-copy-button");
const storageCopyLabel = document.querySelector("#storage-copy-label");
const storageImportButton = document.querySelector("#storage-import-button");
const storageImportFileInput = document.querySelector("#storage-import-file-input");
const addStorageButton = document.querySelector("#add-storage-button");
const storageViewer = document.querySelector("#storage-viewer");
const storageTableBody = document.querySelector("#storage-table-body");
const storageEditor = document.querySelector("#storage-editor");
const storageEditorTitle = document.querySelector("#storage-editor-title");
const storageEditorForm = document.querySelector("#storage-editor-form");
const storageKeyInput = document.querySelector("#storage-key-input");
const storageValueInput = document.querySelector("#storage-value-input");
const saveStorageButton = document.querySelector("#save-storage-button");
const cancelStorageButton = document.querySelector("#cancel-storage-button");
const storageNotice = document.querySelector("#storage-notice");

let preparedExport = null;
let preparedFile = null;
let preparedCookieRows = [];
let sourceCookies = [];
let sourceHostname = "";
let sourcePageURL = null;
let sourceStoreId = null;
let exportGeneratedAt = null;
let editingCookie = null;
let storageEntries = [];
let storageOrigin = null;
let storageTabId = null;
let storageRequestId = 0;
let editingStorageKey = null;
let storageBusy = false;
let preparedStorageExport = null;
let preparedStorageFile = null;

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

    for (const element of document.querySelectorAll("[data-i18n-aria-label]")) {
        element.setAttribute("aria-label", message(element.dataset.i18nAriaLabel));
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

function setStorageStatus(state, titleKey, bodyKey, count, bodySubstitution) {
    storageStatus.dataset.state = state;
    storageStatusTitle.textContent = message(titleKey, count);
    storageStatusBody.textContent = message(bodyKey, bodySubstitution);
}

function setStorageNotice(key, state = "error") {
    storageNotice.hidden = !key;
    storageNotice.textContent = key ? message(key) : "";
    storageNotice.dataset.state = state;
}

function showStorageImportNotice(importedCount, skippedCount) {
    const importedKey = importedCount === 0
        ? "storage_import_none"
        : importedCount === 1 ? "storage_imported_one" : "storage_imported";
    let notice = message(importedKey, String(importedCount));
    if (skippedCount > 0) {
        const skippedKey = skippedCount === 1 ? "storage_skipped_one" : "storage_skipped";
        notice += ` ${message(skippedKey, String(skippedCount))}`;
    }
    storageNotice.textContent = notice;
    storageNotice.dataset.state = importedCount ? "success" : "error";
    storageNotice.hidden = false;
}

function updateStorageControls() {
    const available = storageOrigin !== null && !storageBusy;
    addStorageButton.disabled = !available;
    storageImportButton.disabled = !available;
    storageExportButton.disabled = !available || !preparedStorageFile;
    storageCopyButton.disabled = !available || !preparedStorageExport;
}

function prepareStorageExport() {
    preparedStorageExport = createStorageJsonExport(
        storageEntries,
        new URL(storageOrigin).hostname
    );
    preparedStorageFile = new File(
        [preparedStorageExport.contents],
        preparedStorageExport.filename,
        {type: "application/json"}
    );
    updateStorageControls();
}

function closeStorageEditor() {
    editingStorageKey = null;
    storageEditor.hidden = true;
    storageEditorForm.reset();
}

function openStorageEditor(key = null) {
    editingStorageKey = key;
    storageEditorTitle.textContent = message(key === null ? "add_storage_title" : "edit_storage_title");
    storageKeyInput.readOnly = key !== null;
    storageKeyInput.value = key ?? "";
    storageValueInput.value = key === null
        ? ""
        : storageEntries.find((entry) => entry.key === key)?.value ?? "";
    storageEditor.hidden = false;
    (key === null ? storageKeyInput : storageValueInput).focus();
}

function renderStorageEntries(entries) {
    storageEntries = entries;
    const fragment = document.createDocumentFragment();

    for (const [index, entry] of entries.entries()) {
        const row = document.createElement("tr");
        const keyCell = document.createElement("th");
        const valueCell = document.createElement("td");
        const actionCell = document.createElement("td");
        const actions = document.createElement("div");
        keyCell.scope = "row";
        keyCell.textContent = entry.key;
        valueCell.textContent = entry.value;
        actions.className = "storage-row-actions";

        for (const [action, label] of [
            ["edit", "edit_cookie_button"],
            ["delete", "delete_storage_button"]
        ]) {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.action = action;
            button.dataset.index = String(index);
            button.textContent = message(label);
            button.setAttribute("aria-label", `${message(label)}: ${entry.key}`);
            actions.append(button);
        }

        actionCell.append(actions);
        row.append(keyCell, valueCell, actionCell);
        fragment.append(row);
    }

    storageTableBody.replaceChildren(fragment);
    storageViewer.hidden = entries.length === 0;
    prepareStorageExport();
    const titleKey = entries.length === 1 ? "storage_ready_one" : "storage_ready_title";
    setStorageStatus(
        entries.length ? "ready" : "empty",
        entries.length ? titleKey : "storage_empty_title",
        entries.length ? "storage_ready_body" : "storage_empty_body",
        String(entries.length),
        storageOrigin
    );
}

function showStorageError(titleKey, bodyKey) {
    storageOrigin = null;
    storageTabId = null;
    storageEntries = [];
    storageTableBody.replaceChildren();
    storageViewer.hidden = true;
    preparedStorageExport = null;
    preparedStorageFile = null;
    updateStorageControls();
    closeStorageEditor();
    setStorageStatus("error", titleKey, bodyKey);
}

async function executeStorageOperation(tabId, origin, operation, key, value) {
    const results = await browser.scripting.executeScript({
        target: {tabId, frameIds: [0]},
        func: runStorageOperation,
        args: [operation, origin, key, value]
    });
    const result = results.find((item) => item.frameId === 0) ?? results[0];
    if (result?.error) {
        throw new Error(result.error.message);
    }
    if (result?.result?.origin !== origin || !Array.isArray(result.result.entries)) {
        throw new Error("Safari did not return local storage for this page");
    }
    return result.result;
}

async function loadLocalStorage() {
    const requestId = ++storageRequestId;
    preparedStorageExport = null;
    preparedStorageFile = null;
    storageOrigin = null;
    storageTabId = null;
    updateStorageControls();
    closeStorageEditor();
    setStorageNotice();
    storageTableBody.replaceChildren();
    storageViewer.hidden = true;
    setStorageStatus("loading", "storage_loading_title", "storage_loading_body");

    try {
        const [tab] = await browser.tabs.query({active: true, currentWindow: true});
        if (tab?.id === undefined || !tab.url) {
            throw new Error("Current tab unavailable");
        }
        const pageURL = new URL(tab.url);
        if (!isSupportedPage(pageURL)) {
            if (requestId === storageRequestId) {
                showStorageError("unsupported_title", "unsupported_body");
            }
            return;
        }

        const result = await executeStorageOperation(tab.id, pageURL.origin, "list");
        if (requestId !== storageRequestId) {
            return;
        }
        storageTabId = tab.id;
        storageOrigin = pageURL.origin;
        renderStorageEntries(result.entries);
    } catch (error) {
        if (requestId === storageRequestId) {
            showStorageError(
                isPermissionError(error) ? "permission_title" : "storage_error_title",
                isPermissionError(error) ? "permission_body" : "storage_error_body"
            );
        }
    }
}

async function changeLocalStorage(operation, key, value, omittedCount = 0) {
    if (storageBusy || storageTabId === null || storageOrigin === null) {
        return;
    }
    const tabId = storageTabId;
    const origin = storageOrigin;
    const requestId = storageRequestId;
    storageBusy = true;
    saveStorageButton.disabled = true;
    cancelStorageButton.disabled = true;
    updateStorageControls();
    setStorageNotice();

    try {
        const [tab] = await browser.tabs.query({active: true, currentWindow: true});
        if (tab?.id !== tabId || new URL(tab.url).origin !== origin) {
            throw new Error("The active page changed");
        }
        const result = await executeStorageOperation(tabId, origin, operation, key, value);
        if (requestId === storageRequestId) {
            renderStorageEntries(result.entries);
            closeStorageEditor();
            if (operation === "import") {
                showStorageImportNotice(result.importedCount, omittedCount + result.skippedCount);
            } else {
                setStorageNotice(operation === "remove" ? "storage_deleted" : "storage_saved", "success");
            }
        }
    } catch (error) {
        if (requestId === storageRequestId) {
            const errorKey = operation === "import"
                ? "storage_import_failed"
                : error?.message?.includes("already uses") ? "storage_duplicate" : "storage_write_failed";
            setStorageNotice(errorKey);
        }
    } finally {
        storageBusy = false;
        saveStorageButton.disabled = false;
        cancelStorageButton.disabled = false;
        updateStorageControls();
        if (
            requestId !== storageRequestId
            && localStorageTab.getAttribute("aria-selected") === "true"
        ) {
            loadLocalStorage();
        }
    }
}

function selectStorageTab(tab) {
    const showLocalStorage = tab === localStorageTab;
    cookiesTab.setAttribute("aria-selected", String(!showLocalStorage));
    localStorageTab.setAttribute("aria-selected", String(showLocalStorage));
    cookiesTab.tabIndex = showLocalStorage ? -1 : 0;
    localStorageTab.tabIndex = showLocalStorage ? 0 : -1;
    cookiesPanel.hidden = showLocalStorage;
    localStoragePanel.hidden = !showLocalStorage;
    if (showLocalStorage) {
        loadLocalStorage();
    } else {
        storageRequestId += 1;
    }
}

for (const tab of [cookiesTab, localStorageTab]) {
    tab.addEventListener("click", () => {
        if (tab.getAttribute("aria-selected") !== "true") {
            selectStorageTab(tab);
        }
    });
    tab.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
            return;
        }
        event.preventDefault();
        const nextTab = tab === cookiesTab ? localStorageTab : cookiesTab;
        selectStorageTab(nextTab);
        nextTab.focus();
    });
}

addStorageButton.addEventListener("click", () => {
    setStorageNotice();
    openStorageEditor();
});

storageTableBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button || storageBusy) {
        return;
    }
    const entry = storageEntries[Number(button.dataset.index)];
    if (!entry) {
        return;
    }
    if (button.dataset.action === "edit") {
        setStorageNotice();
        openStorageEditor(entry.key);
    } else if (button.dataset.action === "delete") {
        changeLocalStorage("remove", entry.key);
    }
});

cancelStorageButton.addEventListener("click", closeStorageEditor);

storageEditorForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const operation = editingStorageKey === null ? "add" : "set";
    changeLocalStorage(operation, storageKeyInput.value, storageValueInput.value);
});

storageExportButton.addEventListener("click", async () => {
    if (!preparedStorageFile || !supportsFileSharing(preparedStorageFile)) {
        setStorageNotice("storage_share_unavailable");
        return;
    }

    try {
        await navigator.share({files: [preparedStorageFile], title: preparedStorageFile.name});
        setStorageNotice();
    } catch (error) {
        if (error?.name !== "AbortError") {
            setStorageNotice("storage_share_failed");
        }
    }
});

storageCopyButton.addEventListener("click", async () => {
    if (!preparedStorageExport) {
        return;
    }

    try {
        await navigator.clipboard.writeText(preparedStorageExport.contents);
        storageCopyLabel.textContent = message("copied_button");
        setStorageNotice();
        window.setTimeout(() => {
            storageCopyLabel.textContent = message("storage_copy_button");
        }, 1600);
    } catch {
        setStorageNotice("storage_copy_failed");
    }
});

storageImportButton.addEventListener("click", () => {
    storageImportFileInput.click();
});

storageImportFileInput.addEventListener("change", async () => {
    const file = storageImportFileInput.files?.[0];
    if (!file || storageOrigin === null || localStorageTab.getAttribute("aria-selected") !== "true") {
        storageImportFileInput.value = "";
        return;
    }

    const requestId = storageRequestId;
    storageBusy = true;
    updateStorageControls();
    try {
        const parsed = parseStorageJson(await file.text());
        if (requestId !== storageRequestId) {
            return;
        }
        if (parsed.entries.length === 0) {
            showStorageImportNotice(0, parsed.omittedCount);
            return;
        }
        storageBusy = false;
        await changeLocalStorage("import", parsed.entries, undefined, parsed.omittedCount);
    } catch {
        if (requestId === storageRequestId) {
            setStorageNotice("storage_import_failed");
        }
    } finally {
        storageBusy = false;
        storageImportFileInput.value = "";
        updateStorageControls();
    }
});

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

export function runStorageOperation(operation, expectedOrigin, key, value) {
    if (location.origin !== expectedOrigin) {
        throw new Error("The page changed while accessing local storage");
    }

    const storage = window.localStorage;
    let importedCount = 0;
    let skippedCount = 0;

    if (operation === "import") {
        if (!Array.isArray(key) || !key.every((entry) =>
            entry && typeof entry.key === "string" && typeof entry.value === "string"
        )) {
            throw new TypeError("Local storage import requires key and value strings");
        }
        for (const entry of key) {
            try {
                storage.setItem(entry.key, entry.value);
                importedCount += 1;
            } catch {
                skippedCount += 1;
            }
        }
    } else if (operation === "set" || operation === "add") {
        if (typeof key !== "string" || typeof value !== "string") {
            throw new TypeError("A storage key and value must be strings");
        }
        if (operation === "add" && storage.getItem(key) !== null) {
            throw new Error("A local storage entry already uses this key");
        }
        storage.setItem(key, value);
    } else if (operation === "remove") {
        if (typeof key !== "string") {
            throw new TypeError("A storage key must be a string");
        }
        storage.removeItem(key);
    } else if (operation !== "list") {
        throw new TypeError("Unsupported storage operation");
    }

    const entries = [];
    for (let index = 0; index < storage.length; index += 1) {
        const entryKey = storage.key(index);
        if (entryKey !== null) {
            entries.push({key: entryKey, value: storage.getItem(entryKey)});
        }
    }

    entries.sort((first, second) => first.key < second.key ? -1 : first.key > second.key ? 1 : 0);
    return {origin: location.origin, entries, importedCount, skippedCount};
}

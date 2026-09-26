export function runStorageOperation(operation, expectedOrigin, key, value) {
    if (location.origin !== expectedOrigin) {
        throw new Error("The page changed while accessing local storage");
    }

    const storage = window.localStorage;

    if (operation === "set") {
        if (typeof key !== "string" || typeof value !== "string") {
            throw new TypeError("A storage key and value must be strings");
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
    return {origin: location.origin, entries};
}

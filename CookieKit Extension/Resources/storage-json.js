function validEntry(entry) {
    return entry && typeof entry === "object"
        && !Array.isArray(entry)
        && typeof entry.key === "string"
        && typeof entry.value === "string";
}

export function parseStorageJson(contents) {
    if (typeof contents !== "string") {
        throw new TypeError("Local storage import must be text");
    }

    let parsed;
    try {
        parsed = JSON.parse(contents);
    } catch {
        throw new TypeError("Local storage import must be valid JSON");
    }
    if (!Array.isArray(parsed)) {
        throw new TypeError("Local storage import must be an array of entries");
    }

    const entries = [];
    const seenKeys = new Set();
    let omittedCount = 0;
    for (const entry of parsed) {
        if (!validEntry(entry) || seenKeys.has(entry.key)) {
            omittedCount += 1;
            continue;
        }
        seenKeys.add(entry.key);
        entries.push({key: entry.key, value: entry.value});
    }

    return {entries, omittedCount};
}

export function createStorageJsonExport(entries, hostname, generatedAt = new Date()) {
    const date = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
    if (Number.isNaN(date.getTime())) {
        throw new TypeError("generatedAt must be a valid date");
    }
    if (!Array.isArray(entries) || !entries.every(validEntry)) {
        throw new TypeError("Local storage entries must have string keys and values");
    }

    const sanitizedHost = String(hostname)
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, "-")
        .replace(/^[.-]+|[.-]+$/g, "")
        .replace(/-{2,}/g, "-") || "site";
    const timestamp = date.toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");
    const sortedEntries = entries
        .map(({key, value}) => ({key, value}))
        .sort((first, second) => first.key < second.key ? -1 : first.key > second.key ? 1 : 0);

    return {
        contents: `${JSON.stringify(sortedEntries, null, 2)}\n`,
        filename: `local-storage-${sanitizedHost}-${timestamp}.json`,
        exportedCount: sortedEntries.length
    };
}

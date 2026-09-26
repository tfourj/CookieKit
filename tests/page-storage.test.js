import assert from "node:assert/strict";
import test from "node:test";

import {runStorageOperation} from "../CookieKit Extension/Resources/page-storage.js";

function withStorage(callback) {
    const values = new Map([["z", "last"], ["a", "first"]]);
    const previousWindow = globalThis.window;
    const previousLocation = globalThis.location;
    globalThis.location = {origin: "https://example.com"};
    globalThis.window = {
        localStorage: {
            get length() { return values.size; },
            key(index) { return [...values.keys()][index] ?? null; },
            getItem(key) { return values.get(key) ?? null; },
            setItem(key, value) { values.set(key, value); },
            removeItem(key) { values.delete(key); }
        }
    };

    try {
        callback(values);
    } finally {
        globalThis.window = previousWindow;
        globalThis.location = previousLocation;
    }
}

test("lists local storage in key order and preserves text values", () => {
    withStorage(() => {
        assert.deepEqual(runStorageOperation("list", "https://example.com"), {
            origin: "https://example.com",
            entries: [{key: "a", value: "first"}, {key: "z", value: "last"}]
        });
    });
});

test("adds, updates, and removes a key", () => {
    withStorage((values) => {
        runStorageOperation("set", "https://example.com", "new", "<script>text</script>");
        runStorageOperation("set", "https://example.com", "a", "updated");
        assert.equal(values.get("new"), "<script>text</script>");
        assert.equal(values.get("a"), "updated");
        runStorageOperation("remove", "https://example.com", "new");
        assert.equal(values.has("new"), false);
    });
});

test("rejects a changed page and invalid operations before writing", () => {
    withStorage((values) => {
        assert.throws(() => runStorageOperation("set", "https://other.test", "a", "wrong"), /page changed/);
        assert.throws(() => runStorageOperation("remove", "https://example.com", 42), /string/);
        assert.throws(() => runStorageOperation("clear", "https://example.com"), /Unsupported/);
        assert.equal(values.get("a"), "first");
    });
});

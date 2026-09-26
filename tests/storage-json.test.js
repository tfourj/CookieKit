import assert from "node:assert/strict";
import test from "node:test";

import {
    createStorageJsonExport,
    parseStorageJson
} from "../CookieKit Extension/Resources/storage-json.js";

test("exports deterministic JSON with string keys and values", () => {
    const result = createStorageJsonExport([
        {key: "z", value: "line one\nline two"},
        {key: "a", value: "<script>text</script>"},
        {key: "", value: ""}
    ], "Tést.example.com", new Date("2026-09-26T12:34:56.789Z"));

    assert.equal(result.filename, "local-storage-t-st.example.com-20260926T123456Z.json");
    assert.equal(result.exportedCount, 3);
    assert.deepEqual(JSON.parse(result.contents), [
        {key: "", value: ""},
        {key: "a", value: "<script>text</script>"},
        {key: "z", value: "line one\nline two"}
    ]);
    assert.ok(result.contents.endsWith("\n"));
    assert.deepEqual(parseStorageJson(result.contents).entries, JSON.parse(result.contents));
});

test("skips malformed and duplicate entries while preserving valid strings", () => {
    const result = parseStorageJson(JSON.stringify([
        {key: "a", value: "first"},
        {key: "a", value: "second"},
        {key: "", value: ""},
        {key: "number", value: 42},
        null
    ]));

    assert.deepEqual(result, {
        entries: [{key: "a", value: "first"}, {key: "", value: ""}],
        omittedCount: 3
    });
});

test("rejects non-array JSON, invalid JSON, and invalid exports", () => {
    assert.throws(() => parseStorageJson("{"), /valid JSON/);
    assert.throws(() => parseStorageJson('{"key":"value"}'), /array/);
    assert.throws(() => createStorageJsonExport([{key: "a", value: 1}], "site"), /string/);
    assert.throws(() => createStorageJsonExport([], "site", "bad-date"), /valid date/);
});

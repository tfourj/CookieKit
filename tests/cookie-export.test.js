import assert from "node:assert/strict";
import test from "node:test";

import {
    createNetscapeExport,
    selectCookieStore
} from "../CookieKit Extension/Resources/cookie-export.js";

const generatedAt = new Date("2026-07-31T12:34:56.789Z");

function cookieLines(exportResult) {
    return exportResult.contents
        .split("\n")
        .filter((line) => line.includes("\t"));
}

test("serializes a host-only session cookie into seven Netscape fields", () => {
    const result = createNetscapeExport([
        {
            domain: "example.com",
            hostOnly: true,
            httpOnly: false,
            name: "theme",
            path: "/account",
            secure: false,
            session: true,
            value: "warm"
        }
    ], "example.com", generatedAt);

    assert.deepEqual(cookieLines(result), [
        "example.com\tFALSE\t/account\tFALSE\t0\ttheme\twarm"
    ]);
    assert.equal(result.exportedCount, 1);
    assert.equal(result.omittedCount, 0);
    assert.ok(result.contents.startsWith("# Netscape HTTP Cookie File\n"));
    assert.ok(!result.contents.includes("\r"));
    assert.ok(result.contents.endsWith("\n"));
});

test("serializes a persistent secure domain cookie with HttpOnly notation", () => {
    const result = createNetscapeExport([
        {
            domain: ".example.com",
            expirationDate: 2000000000.9,
            hostOnly: false,
            httpOnly: true,
            name: "session_id",
            path: "/",
            secure: true,
            session: false,
            value: "secret"
        }
    ], "example.com", generatedAt);

    assert.deepEqual(cookieLines(result), [
        "#HttpOnly_.example.com\tTRUE\t/\tTRUE\t2000000000\tsession_id\tsecret"
    ]);
});

test("uses zero expiry when the session flag overrides an expiration date", () => {
    const result = createNetscapeExport([
        {
            domain: "example.com",
            expirationDate: 2000000000,
            hostOnly: true,
            name: "temporary",
            path: "/",
            session: true,
            value: "1"
        }
    ], "example.com", generatedAt);

    assert.equal(
        cookieLines(result)[0],
        "example.com\tFALSE\t/\tFALSE\t0\ttemporary\t1"
    );
});

test("sorts deterministically by domain, path, and name", () => {
    const cookies = [
        {
            domain: "z.example",
            hostOnly: true,
            name: "b",
            path: "/",
            value: "4"
        },
        {
            domain: "a.example",
            hostOnly: true,
            name: "z",
            path: "/account",
            value: "3"
        },
        {
            domain: "a.example",
            hostOnly: true,
            name: "b",
            path: "/",
            value: "2"
        },
        {
            domain: "a.example",
            hostOnly: true,
            name: "a",
            path: "/",
            value: "1"
        }
    ];

    const result = createNetscapeExport(cookies, "example.com", generatedAt);

    assert.deepEqual(
        cookieLines(result).map((line) => line.split("\t").at(-2)),
        ["a", "b", "z", "b"]
    );
});

test("creates a sanitized hostname and UTC timestamp filename", () => {
    const result = createNetscapeExport([], "Tést / SITE.com..", generatedAt);

    assert.equal(
        result.filename,
        "cookies-t-st-site.com-20260731T123456Z.txt"
    );
    assert.ok(result.contents.includes("# Generated at 2026-07-31T12:34:56.789Z"));
});

test("omits malformed cookies containing tabs or line breaks", () => {
    const result = createNetscapeExport([
        {
            domain: "example.com",
            hostOnly: true,
            name: "valid",
            path: "/",
            value: "yes"
        },
        {
            domain: "example.com",
            hostOnly: true,
            name: "bad\tname",
            path: "/",
            value: "no"
        },
        {
            domain: "example.com",
            hostOnly: true,
            name: "bad-path",
            path: "/\nadmin",
            value: "no"
        },
        {
            domain: "example.com\rspoofed.example",
            hostOnly: true,
            name: "bad-domain",
            path: "/",
            value: "no"
        },
        null
    ], "example.com", generatedAt);

    assert.equal(result.exportedCount, 1);
    assert.equal(result.omittedCount, 4);
    assert.deepEqual(cookieLines(result), [
        "example.com\tFALSE\t/\tFALSE\t0\tvalid\tyes"
    ]);
});

test("handles a missing cookie array without persisting or inventing rows", () => {
    const result = createNetscapeExport(undefined, "", generatedAt);

    assert.equal(result.exportedCount, 0);
    assert.equal(result.omittedCount, 0);
    assert.equal(result.filename, "cookies-site-20260731T123456Z.txt");
    assert.deepEqual(cookieLines(result), []);
});

test("rejects an invalid generated date", () => {
    assert.throws(
        () => createNetscapeExport([], "example.com", "not-a-date"),
        /valid date/
    );
});

test("selects only the cookie store that contains the exact active tab id", () => {
    const stores = [
        {id: "string-id", tabIds: ["42"]},
        {id: "private-store", tabIds: [7, 42]},
        {id: "default-store", tabIds: [3]}
    ];

    assert.deepEqual(selectCookieStore(stores, 42), stores[1]);
});

test("does not fall back when no cookie store contains the active tab", () => {
    const stores = [
        {id: "default-store", tabIds: [1, 2]},
        {id: "missing-tab-ids"}
    ];

    assert.equal(selectCookieStore(stores, 99), null);
    assert.equal(selectCookieStore(undefined, 99), null);
    assert.equal(selectCookieStore(stores, undefined), null);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
    createCookieRemovalDetails,
    createCookieSetDetails,
    parseCookieImport
} from "../CookieKit Extension/Resources/cookie-import.js";

const nowSeconds = 2_000_000_000;

test("parses Netscape cookies including HttpOnly and session attributes", () => {
    const result = parseCookieImport([
        "# Netscape HTTP Cookie File",
        "# a comment",
        "example.com\tFALSE\t/\tFALSE\t0\ttheme\twarm",
        "#HttpOnly_.example.com\tTRUE\t/account\tTRUE\t2100000000\tsession\tsecret",
        ""
    ].join("\n"), "cookies.txt");

    assert.equal(result.format, "netscape");
    assert.equal(result.omittedCount, 0);
    assert.deepEqual(result.cookies, [
        {
            domain: "example.com",
            hostOnly: true,
            httpOnly: false,
            name: "theme",
            path: "/",
            secure: false,
            session: true,
            value: "warm"
        },
        {
            domain: ".example.com",
            expirationDate: 2_100_000_000,
            hostOnly: false,
            httpOnly: true,
            name: "session",
            path: "/account",
            secure: true,
            session: false,
            value: "secret"
        }
    ]);
});

test("omits malformed Netscape records while retaining valid cookies", () => {
    const result = parseCookieImport([
        "missing fields",
        "example.com\tMAYBE\t/\tFALSE\t0\tbad\tvalue",
        "example.com\tFALSE\t/\tFALSE\t0\tvalid\tvalue"
    ].join("\n"));

    assert.equal(result.format, "netscape");
    assert.equal(result.cookies.length, 1);
    assert.equal(result.omittedCount, 2);
});

test("parses CookieKit and wrapped JSON cookie arrays", () => {
    const cookie = {
        domain: "example.com",
        name: "theme",
        path: "/",
        value: "warm"
    };
    const arrayResult = parseCookieImport(JSON.stringify([cookie, null]), "cookies.json");
    const wrappedResult = parseCookieImport(JSON.stringify({cookies: [cookie]}));

    assert.deepEqual(arrayResult.cookies, [cookie]);
    assert.equal(arrayResult.omittedCount, 1);
    assert.equal(arrayResult.format, "json");
    assert.deepEqual(wrappedResult.cookies, [cookie]);
});

test("rejects invalid JSON and JSON without a cookie array", () => {
    assert.throws(() => parseCookieImport("[invalid", "cookies.json"), /valid JSON/);
    assert.throws(() => parseCookieImport("{}", "cookies.json"), /cookie array/);
});

test("creates host-only session cookie details for the active store", () => {
    const details = createCookieSetDetails({
        domain: "example.com",
        hostOnly: true,
        name: "theme",
        path: "/account",
        sameSite: "lax",
        session: true,
        value: "warm"
    }, "https://example.com/account/profile", "private", nowSeconds);

    assert.deepEqual(details, {
        url: "https://example.com/account",
        name: "theme",
        value: "warm",
        path: "/account",
        secure: false,
        httpOnly: false,
        storeId: "private",
        sameSite: "lax"
    });
});

test("creates secure persistent domain cookie details", () => {
    const details = createCookieSetDetails({
        domain: ".example.com",
        expirationDate: 2_100_000_000,
        hostOnly: false,
        httpOnly: true,
        name: "session",
        path: "/",
        sameSite: "no_restriction",
        secure: true,
        session: false,
        value: "secret"
    }, "http://shop.example.com/cart", "default", nowSeconds);

    assert.deepEqual(details, {
        url: "https://shop.example.com/",
        name: "session",
        value: "secret",
        path: "/",
        secure: true,
        httpOnly: true,
        domain: "example.com",
        storeId: "default",
        expirationDate: 2_100_000_000,
        sameSite: "no_restriction"
    });
});

test("rejects unrelated, mismatched host-only, expired, and malformed cookies", () => {
    const baseCookie = {
        domain: "example.com",
        name: "theme",
        path: "/",
        value: "warm"
    };

    assert.throws(
        () => createCookieSetDetails({...baseCookie, domain: "other.test"}, "https://example.com", "store"),
        /current website/
    );
    assert.throws(
        () => createCookieSetDetails({...baseCookie, domain: ".example.com", hostOnly: true}, "https://shop.example.com"),
        /Host-only/
    );
    assert.throws(
        () => createCookieSetDetails({...baseCookie, expirationDate: nowSeconds - 1}, "https://example.com", "store", nowSeconds),
        /expired/
    );
    assert.throws(
        () => createCookieSetDetails({...baseCookie, path: "account"}, "https://example.com"),
        /unsupported characters/
    );
});

test("creates removal details that target the original cookie path and store", () => {
    const details = createCookieRemovalDetails({
        domain: ".example.com",
        hostOnly: false,
        name: "old-name",
        path: "/account",
        secure: true,
        value: "secret"
    }, "http://shop.example.com/profile", "private");

    assert.deepEqual(details, {
        url: "https://shop.example.com/account",
        name: "old-name",
        storeId: "private"
    });
});

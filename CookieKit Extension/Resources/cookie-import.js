const HTTP_PROTOCOLS = new Set(["http:", "https:"]);
const SAME_SITE_VALUES = new Set(["lax", "strict", "no_restriction"]);
const UNSAFE_COOKIE_CHARACTERS = /[\0\r\n]/;

function stringValue(value) {
    return typeof value === "string" ? value : null;
}

function normalizedDomain(domain) {
    return domain.toLowerCase().replace(/^\.+/, "").replace(/\.+$/, "");
}

function hostnameMatchesDomain(hostname, domain) {
    return hostname === domain || hostname.endsWith(`.${domain}`);
}

function parseBooleanField(value) {
    const normalizedValue = value.toUpperCase();
    if (normalizedValue === "TRUE") {
        return true;
    }

    if (normalizedValue === "FALSE") {
        return false;
    }

    return null;
}

function parseNetscapeLine(line) {
    const httpOnly = line.startsWith("#HttpOnly_");
    const cookieLine = httpOnly ? line.slice("#HttpOnly_".length) : line;
    const fields = cookieLine.split("\t");

    if (fields.length !== 7) {
        return null;
    }

    const [domain, includeSubdomainsValue, path, secureValue, expiryValue, name, value] = fields;
    const includeSubdomains = parseBooleanField(includeSubdomainsValue);
    const secure = parseBooleanField(secureValue);
    const expirationDate = Number(expiryValue);

    if (
        !domain
        || !path.startsWith("/")
        || includeSubdomains === null
        || secure === null
        || !/^\d+$/.test(expiryValue)
        || !Number.isSafeInteger(expirationDate)
    ) {
        return null;
    }

    const cookie = {
        domain,
        hostOnly: !includeSubdomains,
        httpOnly,
        name,
        path,
        secure,
        session: expirationDate === 0,
        value
    };

    if (expirationDate > 0) {
        cookie.expirationDate = expirationDate;
    }

    return cookie;
}

function parseNetscapeCookies(contents) {
    const cookies = [];
    let omittedCount = 0;

    for (const sourceLine of contents.split(/\r?\n/)) {
        const line = sourceLine.trimEnd();
        if (!line || (line.startsWith("#") && !line.startsWith("#HttpOnly_"))) {
            continue;
        }

        const cookie = parseNetscapeLine(line);
        if (cookie) {
            cookies.push(cookie);
        } else {
            omittedCount += 1;
        }
    }

    return {cookies, omittedCount};
}

function parseJsonCookies(contents) {
    let parsed;
    try {
        parsed = JSON.parse(contents);
    } catch (error) {
        throw new SyntaxError("The selected file is not valid JSON", {cause: error});
    }

    const values = Array.isArray(parsed) ? parsed : parsed?.cookies;
    if (!Array.isArray(values)) {
        throw new TypeError("The JSON file must contain a cookie array");
    }

    const cookies = values.filter((value) => (
        value !== null && typeof value === "object" && !Array.isArray(value)
    ));

    return {
        cookies,
        omittedCount: values.length - cookies.length
    };
}

function importFormat(contents, filename) {
    if (filename.toLowerCase().endsWith(".json")) {
        return "json";
    }

    const firstCharacter = contents.trimStart()[0];
    return firstCharacter === "[" || firstCharacter === "{" ? "json" : "netscape";
}

function validatedPageURL(pageURL) {
    const url = pageURL instanceof URL ? pageURL : new URL(pageURL);
    if (!HTTP_PROTOCOLS.has(url.protocol)) {
        throw new TypeError("Cookies can only be changed for HTTP or HTTPS pages");
    }

    return url;
}

function validatedCookie(cookie, pageURL, nowSeconds) {
    if (!cookie || typeof cookie !== "object") {
        throw new TypeError("Cookie must be an object");
    }

    const name = stringValue(cookie.name);
    const value = stringValue(cookie.value);
    const sourceDomain = stringValue(cookie.domain);
    const path = stringValue(cookie.path) ?? "/";

    if (name === null || value === null || sourceDomain === null) {
        throw new TypeError("Cookie name, value, and domain must be strings");
    }

    if (
        [name, value, sourceDomain, path].some((field) => UNSAFE_COOKIE_CHARACTERS.test(field))
        || !path.startsWith("/")
    ) {
        throw new TypeError("Cookie fields contain unsupported characters");
    }

    const domain = normalizedDomain(sourceDomain);
    const hostname = pageURL.hostname.toLowerCase();
    const hostOnly = typeof cookie.hostOnly === "boolean"
        ? cookie.hostOnly
        : !sourceDomain.startsWith(".");

    if (!domain || !hostnameMatchesDomain(hostname, domain)) {
        throw new RangeError("Cookie domain does not apply to the current website");
    }

    if (hostOnly && domain !== hostname) {
        throw new RangeError("Host-only cookie does not match the current website");
    }

    if (
        cookie.expirationDate !== undefined
        && (!Number.isFinite(cookie.expirationDate) || cookie.expirationDate <= nowSeconds)
        && cookie.session !== true
    ) {
        throw new RangeError("Cookie has expired or has an invalid expiration date");
    }

    return {domain, hostOnly, name, path, value};
}

function cookieURL(pageURL, secure, path) {
    const protocol = secure ? "https:" : pageURL.protocol;
    const url = new URL(`${protocol}//${pageURL.host}`);
    url.pathname = path;
    return url.href;
}

export function parseCookieImport(contents, filename = "") {
    if (typeof contents !== "string") {
        throw new TypeError("Cookie import contents must be text");
    }

    const format = importFormat(contents, filename);
    const result = format === "json"
        ? parseJsonCookies(contents)
        : parseNetscapeCookies(contents);

    return {...result, format};
}

export function createCookieSetDetails(
    cookie,
    pageURL,
    storeId,
    nowSeconds = Date.now() / 1000
) {
    const url = validatedPageURL(pageURL);
    const validated = validatedCookie(cookie, url, nowSeconds);
    const secure = cookie.secure === true;
    const details = {
        url: cookieURL(url, secure, validated.path),
        name: validated.name,
        value: validated.value,
        path: validated.path,
        secure,
        httpOnly: cookie.httpOnly === true
    };

    if (!validated.hostOnly) {
        details.domain = validated.domain;
    }

    if (storeId !== undefined && storeId !== null) {
        details.storeId = storeId;
    }

    if (cookie.session !== true && Number.isFinite(cookie.expirationDate)) {
        details.expirationDate = cookie.expirationDate;
    }

    if (SAME_SITE_VALUES.has(cookie.sameSite)) {
        details.sameSite = cookie.sameSite;
    }

    return details;
}

export function createCookieRemovalDetails(cookie, pageURL, storeId) {
    const url = validatedPageURL(pageURL);
    const validated = validatedCookie(cookie, url, Number.NEGATIVE_INFINITY);
    const details = {
        url: cookieURL(url, cookie.secure === true, validated.path),
        name: validated.name
    };

    if (storeId !== undefined && storeId !== null) {
        details.storeId = storeId;
    }

    return details;
}

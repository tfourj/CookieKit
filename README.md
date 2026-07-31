# CookieKit

CookieKit is a Safari extension for iPhone and iPad that exports the cookies for
the current webpage in Netscape `cookies.txt` format.

CookieKit prepares each export locally. It has no accounts, analytics,
advertising, tracking, or developer-operated server.

## Requirements

- iOS or iPadOS 18 or later
- Safari

## Enable the extension

1. Open the CookieKit app.
2. Follow the setup instructions shown in the app.
3. In Settings, open **Apps → Safari → Extensions**.
4. Select CookieKit and turn it on.
5. Choose which websites CookieKit may access.

Safari keeps you in control of website permissions. You can change or revoke
CookieKit's access at any time.

## Export cookies

1. Open a regular HTTP or HTTPS webpage in Safari.
2. Open Safari's page menu and select CookieKit.
3. Review the website and number of cookies found.
4. Select **Share file** to create a `.txt` file or **Copy contents** to copy the
   export to the clipboard.

CookieKit exports only cookies that apply to the current page and its active
Safari profile or private-browsing store.

## Export format

The generated file uses the standard seven-field Netscape format:

```text
domain    include-subdomains    path    secure    expiry    name    value
```

CookieKit supports:

- host-only and domain cookies
- secure and non-secure cookies
- session and persistent cookies
- HttpOnly cookies using the conventional `#HttpOnly_` prefix
- deterministic ordering by domain, path, and name

The Netscape format cannot preserve SameSite attributes or partition keys.

## Privacy and security

Cookies are processed in memory only. CookieKit does not save them, transmit them
to the developer, or display their names and values in the extension popup.

Cookie data leaves CookieKit only when you explicitly share the file or copy its
contents. The selected app, recipient, or clipboard consumer may then store that
data under its own terms.

Cookies can grant access to signed-in accounts. Treat every export like a
password: share it only with trusted destinations and delete it when it is no
longer needed.

Read the full [privacy policy](PRIVACY.md).

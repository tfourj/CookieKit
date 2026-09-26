# CookieKit Privacy Policy

Effective: September 26, 2026

CookieKit does not collect, store, sell, or transmit personal data.

## Cookie processing

When a user explicitly opens the CookieKit Safari extension, the extension asks
Safari for the cookies that apply to the current HTTP or HTTPS page. CookieKit
formats those cookies in the selected Netscape `cookies.txt` or JSON format in
the extension popup's memory. If the user chooses **Show cookies** or **Edit**,
the popup also displays cookie names and values locally.

When a user explicitly selects an import file, CookieKit reads it in the popup's
memory and asks Safari to write only the valid cookies that apply to the current
website and active Safari profile. When a user saves an edit, CookieKit asks
Safari to replace that cookie with the entered name and value while preserving
its other supported attributes. CookieKit does not persist cookies or import
files in app storage, extension storage, logs, analytics, or a
developer-controlled server.

## Local Storage processing

When a user opens the **Local Storage** tab, CookieKit runs a script in the
active webpage to read that page's origin-specific Local Storage. The popup
displays the keys and values in memory. **Add entry**, **Edit**, **Delete**, and
**Import JSON** write changes directly to that website's Local Storage.
CookieKit does not keep a separate copy in app or extension storage or send
values to a server. The script runs only when the user opens the tab or changes
an entry; there is no background process on webpages.

## Data collection and tracking

CookieKit has:

- no developer-operated network service
- no analytics, advertising, or telemetry
- no user accounts
- no third-party SDKs
- no tracking

The containing app and Safari extension declare no collected data types, tracking
domains, or required-reason API use in their Apple privacy manifests.

## On-screen cookie viewer and editor

**Show cookies** reveals cookie names and values only inside the open extension
popup. Selecting **Edit** copies one cookie's name and value into a local form.
The table is hidden by default, is not transmitted anywhere, and is discarded
when the popup closes. Anyone who can see the screen or a screenshot may be able
to read the displayed values.

The **Local Storage** tab displays that site's keys and values in the popup.
Those values may also contain account information and can be seen in screenshots.

## User-selected imports

**Import cookies** opens the system file picker. CookieKit accepts JSON and
Netscape `cookies.txt` data selected by the user, parses it locally, and asks
Safari to store valid cookies for the open website. The file is not uploaded or
retained by CookieKit. The system file provider selected by the user may apply
its own privacy terms.

**Import JSON** on the Local Storage tab reads a user-selected array of string
keys and values. Valid entries are written to the active site's Local Storage;
matching keys are replaced, and other keys remain. The file is not uploaded or
retained by CookieKit.

## User-selected exports

Website data leaves CookieKit only when the user chooses one of these actions:

- **Export cookies** passes an in-memory text or JSON file to the iOS or iPadOS
  system share sheet.
- **Copy cookies** writes the selected format to the system clipboard.
- **Export JSON** passes an in-memory Local Storage JSON file to the share sheet.
- **Copy JSON** writes Local Storage entries to the system clipboard.

The destination selected by the user, including another app, AirDrop recipient, or
clipboard consumer, may store or process the exported data under its own privacy
terms. Those destinations are outside CookieKit's control.

## Website permissions

Safari controls CookieKit's access to read and change website cookies and Local
Storage. Users may allow, deny, or revoke website access in Safari's extension
settings. CookieKit requests access only when the user invokes its Safari action.

## Security

Cookies can grant access to signed-in accounts. Users should import cookies only
from trusted sources, export them only when necessary, protect exported files,
and share them only with trusted destinations.

Local Storage may also contain account data. Import JSON only from trusted files
and share exports only with trusted destinations.

## Policy changes

If CookieKit's data practices change, this policy and the App Store privacy
disclosures must be updated before the changed version is distributed.

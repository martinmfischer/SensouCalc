# Technical review — 30 October 2026

Scope: client UI, scenario imports/storage/share links, CSV export, calculation worker, exact damage engine, local server, static production build and deployed HTTP headers. This is a targeted source and regression review, not a guarantee that every possible vulnerability has been found. There is no server database, user authentication endpoint, SQL interpreter or runtime dependency tree in this app.

## Findings fixed

| Finding | Impact and reproduction | Fix |
|---|---|---|
| CSV formula injection after whitespace/control characters | An imported model name beginning with a tab/newline followed by `=`, `+`, `-` or `@` bypassed the original export check. A spreadsheet could interpret an exported header cell as a formula. Opening the exported CSV is required. | Central CSV encoder quotes values and prefixes dangerous strings after ignored whitespace/control characters; regression payloads include tabs, CR/LF, NUL, quotes and formulas. |
| Windows traversal in the development server | `/assets/%5c..%5c.git/config` passed the slash-only dot-segment check but Windows resolved the backslashes into `.git/config`. This affected the loopback preview server, not the deployed `dist/` assets. | Reject backslashes and private paths, restrict public routes, then validate the real filesystem target as well to reject symlink escapes. |
| Scenario-name prototype lookup | Names such as `__proto__`, `constructor` and `toString` resolved inherited properties in the legacy-name migration map, breaking the expected string type. No prototype mutation or executable DOM injection was reproduced. | Migrate only own properties. Scenario text is bounded before parsing; the existing property whitelist drops imported unknown/prototype keys. |
| Stale-result race and unbounded background queue | Switching mode and clicking summary/chart controls before the worker returned could render incompatible old results. Repeated inputs queued obsolete expensive work. | Snapshot inputs; terminate superseded workers, reject stale messages, impose a 20-second timeout and make result controls inert until the current result arrives. Regression tests cover cancellation, late messages, timeout and recovery. |
| Fragment-only share links ignored | Opening another scenario URL in an already-open calculator changed only the hash, leaving the old model inputs active. | Handle hash changes using the same bounded parser; invalid links leave the current scenario intact. |
| Missing HTTP defence headers | The deployed static site had no CSP, framing restriction, MIME sniffing restriction or referrer policy. This was a missing layer of protection; no DOM-XSS exploit was reproduced. | Ship `_headers` with a same-origin script CSP, disabled inline script handlers, no object/base/form injection, denied framing, `nosniff`, no-referrer and limited browser permissions. The preview server uses the same headers. |

## Last Stand

Advanced-only. Lethal wounds preserve subsequent attack events until turn end; Critical removal and Prone still interrupt them. Tests also cover Counterstrike followed by the same model's attack and a later Critical roll against a model kept in play by Last Stand. Out-of-action statistics are labelled “Removed by turn end” for these targets.

## AdSense boundary

Updated 1 November 2026: the slot is hidden and makes no third-party requests by default while site approval is pending. Public IDs, a Google TCF subscription, withdrawal handling and a Pages HTML nonce function are now implemented; see [ADSENSE.md](ADSENSE.md). The explicit consent preview loads Google's SDK paused, but never requests a slot. Advertising activation is still blocked on site approval and a successful live consent-dialog check.

HTML script execution now uses a fresh nonce and `strict-dynamic`, without `unsafe-eval` or script attributes. Static assets retain the same-origin policy. HTTPS connections, frames and visual resources are allowed in HTML for Google's runtime; trusted third-party SDKs therefore remain a supply-chain/privacy boundary. Header/body nonce coupling and canonical `/privacy` routing have regression checks. CSP is a defence layer, not a substitute for escaping or bounded scenario imports.

## Existing protections reviewed

Dynamic model/scenario names and errors are escaped before HTML interpolation; tooltip and table names use the same escaping. Imported models use bounded numeric fields, enumerated string choices and known boolean properties. No `eval`, dynamic function construction, SQL queries or server-side command execution is used for user input. Export and share functions do not embed deployment credentials.

Verification includes exact/probability unit checks, independent Counterstrike enumeration, Last Stand interruption cases, scenario/CSV/path attack strings, worker race/timeout checks, local browser payload rendering and deployed asset/header checks. See the final task report for the checks actually completed.

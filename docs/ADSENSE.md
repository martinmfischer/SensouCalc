# AdSense setup and activation

Status checked 1 November 2026. Primary site: https://sensoucalc.pages.dev/.

## Account setup

- Publisher: `ca-pub-3641047527711845`; manual responsive Display unit **Sensou Calc — below calculator**, slot `1560433528`. These are public identifiers.
- Ownership verified and site review requested. AdSense still shows **Wird vorbereitet / Überprüfung angefordert**. Approval is not automatic.
- `/ads.txt` serves `google.com, pub-3641047527711845, DIRECT, f08c47fec0942fa0` with HTTP 200. Google's last displayed crawl still says **Nicht gefunden** (30 October); recognition is outstanding.
- Auto ads and automatic optimization are off for SensouCalc. No SensouTrack configuration was changed.
- **Sensou Calc - EU consent** is published for SensouCalc only, in English, with Consent / Do not consent / Manage options. Its site name and privacy URL are set; optional logo and message optimization are off.
- The account partner selection was inspected: only Google Advertising Products (GVL 755), no legitimate interest and no optional device fingerprinting. Do not casually change account-wide settings: they are shared with SensouTrack.
- The payment profile was already complete. No payment details, credentials or new contracts were changed or placed in this repository.

## Runtime

One labelled horizontal unit is below the statistics, away from controls. It is neither sticky nor an overlay; unfilled and offline units are hidden. `ads-config.mjs` deliberately retains **`enabled: false`** while approval and live consent verification are outstanding. Normal visits load no Google software.

`src/ads.mjs` implements the Google lifecycle rather than accepting a custom DOM consent event:

1. Set `adsbygoogle.pauseAdRequests = 1` before loading the fixed Google SDK URL. The SDK also deploys the published Google consent message.
2. Subscribe to the TCF API through Google's `CONSENT_API_READY` callback. Unknown, failed, loading and undecided results fail closed.
3. In GDPR regions require Google vendor 755 consent and purposes 1, 2, 7, 9 and 10, respecting publisher restrictions. Purposes 3 and 4 additionally permit personalized ads; otherwise request non-personalized ads. Legitimate interest does not satisfy this app's gate. Google still evaluates the complete TC string itself.
4. Request the single slot only when enabled, online, SDK-ready, a real response nonce exists, consent permits it and Global Privacy Control is not asserted. Recalculations and rerolls do not refresh ads.
5. The footer's **Privacy & cookie settings** button immediately pauses requests and removes an existing ad, then queues Google's revocation message. A stale consent callback cannot resume requests during this flow. Offline and declined consent also hide/remove the slot.

The privacy page has the same entry point through `src/privacy.mjs`. There is no analytics SDK. The regional TCF result is used outside GDPR regions; this is not a claim of implementing every jurisdiction's privacy framework.

## CSP and offline use

Cloudflare Pages advanced mode (`_worker.js`) generates a random 192-bit nonce separately for every HTML response and puts it in both CSP and script elements. `_routes.json` includes `/`, `/index.html`, `/privacy.html` and its canonical `/privacy` destination. Pages redirects `.html` URLs before serving them; forgetting the extensionless destination bypasses the function.

HTML uses nonce-based `strict-dynamic`, no script attributes, no `unsafe-eval`, no objects, no base elements, denied framing and no form submission. Google descendants may use HTTPS styles, fonts, images, connections and frames. Static responses retain the stricter same-origin `_headers` policy. HTML is `no-store`; conditional validators are removed so a new nonce cannot be paired with an old HTML body. The service worker stores complete HTML/header responses together for offline use. No Google responses are precached.

The Pages function does not recreate the deleted legacy `workers.dev` endpoint. Local static development intentionally has no nonce and cannot activate Google scripts.

## Preview and verification

- `?previewAds=1`: local placement placeholder; no Google requests, including offline.
- `?previewConsent=1`: real Google SDK and consent flow, **ad requests always paused** even after acceptance. A footer status reports the consent decision. Loading Google's software exposes network metadata and may read existing Google-domain cookies.
- `?previewConsent=1&fc=alwaysshow&fctype=gdpr`: Google's documented forced consent-message preview on the published site's hostname.

48 Node tests pass. Consent lifecycle tests exercise accepted/declined/unknown consent, required purposes, vendor restrictions, non-personalized requests, preview isolation, GPC, repeated callbacks, withdrawal, stale events and unfilled slots using DOM/API doubles. Edge tests cover fresh nonces, header/body coupling and route coverage.

Live checks confirm the calculator works, the SDK and Funding Choices load without reported CSP errors, requests remain paused, and the ad element stays uninitialized. However, the published Google message did **not** render in the forced preview or after the revocation button. Its actual purposes/partner disclosure and accept/decline/withdraw UI therefore remain unverified. The editor's earlier “0 partners” preview cannot be treated as a verified live disclosure, despite the account's Google-only selection. Do not mark this end-to-end check complete or enable ads until the real message works. Site approval is still pending; the cause of the missing dialog is not established.

## Remaining activation steps

1. Wait for Google site approval and ads.txt recognition. Check the site details for any new actionable rejection; do not repeatedly resubmit a pending review.
2. Repeat the forced consent preview on the primary domain. Confirm actual Google/purpose disclosure, decline, acceptance and withdrawal, plus no ad initialization in preview. Diagnose any remaining Google configuration issue before activation.
3. Once those checks pass, change only `enabled` to `true`, build and deploy. Check a normal page view for a single filled unit and no CSP errors; never click your own ads. Test a declined choice, withdrawal and offline behavior again. A filled ad cannot currently be verified.

Sources:

- [Google Privacy & Messaging API and preview parameters](https://developers.google.com/funding-choices/fc-api-docs)
- [Pause AdSense requests](https://support.google.com/adsense/answer/7670312?hl=en)
- [AdSense nonce CSP](https://support.google.com/adsense/answer/16283098?hl=en-GB)
- [Consent revocation](https://support.google.com/adsense/answer/10959060?hl=en-GB)
- [Connect a site and request review](https://support.google.com/adsense/answer/7584263?hl=en-GB)
- [Cloudflare Pages advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/)

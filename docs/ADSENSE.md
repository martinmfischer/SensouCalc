# AdSense preparation

One horizontal, labelled ad unit sits below the statistics and above the footer, separated from calculator controls. It is neither sticky nor an overlay. Space is reserved only when the slot is activated; offline and unconfigured visitors see no empty advertising panel.

Preview with `?previewAds=1`. This displays the placement without an ad request, even if real advertising is later configured. It works offline. Normal visitors see no preview.

`ads-config.mjs` contains public identifiers only. Advertising remains disabled. `src/ads.mjs` requires all of the following before requesting the fixed Google SDK URL:

1. `enabled: true`, an actual `ca-pub-` client ID and ad-unit slot ID.
2. An online browser.
3. Consent granted by an integrated, Google-certified CMP, through a `sensou:ads-consent` CustomEvent with `detail: {granted: true}`. A false signal hides the unit and reloads if the SDK had already loaded. The CMP must resolve updated consent before granting it again.
4. A real, unpredictable CSP nonce on the application script, generated separately for each HTML response. The current static deployment intentionally has no nonce and blocks third-party scripts. This is an activation guard, not a working CMP or an active ad deployment.

Do not simply add Google domains to the current CSP. Google documents nonce-based strict CSP because ad domains change. Before activation, implement response-specific nonces in a Cloudflare Worker, update CSP according to Google's guide, and test the CMP and ad SDK together. Do not use a fixed nonce, disable CSP, or pretend a custom consent toggle is a certified CMP.

Once approved in AdSense, copy the account's actual seller entry into `ads.txt` at the public site root; `ads.txt.example` is a non-published template. Add the real file to the build's explicit public file list. Review the site's privacy information and consent configuration before enabling ads. Domain/site approval is handled by Google, not by this calculator.

Sources checked 30 October 2026:

- [Responsive horizontal ad parameters](https://support.google.com/adsense/answer/9183460?hl=en)
- [AdSense CSP requirements](https://support.google.com/adsense/answer/16283098?hl=en-GB)
- [Certified CMP requirements](https://support.google.com/adsense/answer/13554116?hl=en-GB)
- [ads.txt setup](https://support.google.com/adsense/answer/12171612?hl=en)

## Account setup status — 30 October 2026

The signed-in account supplied publisher ID `ca-pub-3641047527711845`. SensouCalc was added separately from SensouTrack. Google confirmed ownership of `sensoucalc.pages.dev` using the live meta tag, and a site review was requested. The final UI showed **Wird vorbereitet / Überprüfung angefordert**. This is pending Google approval, not permission to serve ads.

Completed:

- Ownership meta tag on the calculator and privacy page.
- Actual authorized seller entry in public `/ads.txt`, included in the build and preview route whitelist.
- Responsive Display unit **Sensou Calc — below calculator**, slot `1560433528`. The existing app placement constrains it to horizontal; Google's horizontal selector is only a preview.
- Public client/slot IDs recorded in `ads-config.mjs`, with `enabled: false`.
- Automatic ads and automatic optimization disabled for SensouCalc; SensouTrack settings left unchanged.
- Separate Google EU consent draft **Sensou Calc - EU consent**, assigned only to SensouCalc, English, with Consent / Do not consent / Manage options. Decline is enabled for all offered European countries; the optional logo and consent-message optimization are off. Site name and `https://sensoucalc.pages.dev/privacy.html` are set. The draft is **not published**.

Remaining before actual activation: Google site approval; review of the consent draft's actual purposes/partners and publication; response-specific nonces and advertising-compatible CSP; a real CMP-to-ad-loader integration and consent-revocation link; updated privacy text matching the live advertising setup. Test consent, rejection, withdrawal, offline behaviour and the one-slot layout together. Cloudflare Pages supports a `_worker.js` with dashboard uploads, so response-specific nonces can be added while keeping the existing `.pages.dev` address; the deleted legacy Worker endpoint is not needed. The current static site loads no Google scripts or ads. Approval does not automatically enable advertising.

The account payment profile was already marked complete. No payment details or new contract acceptance were needed or changed. No credentials were placed in the repository.

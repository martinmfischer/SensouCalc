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

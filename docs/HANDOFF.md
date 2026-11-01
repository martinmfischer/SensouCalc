# Project handoff — 1 November 2026

Repository: https://github.com/martinmfischer/SensouCalc (`main`). Production: https://sensoucalc.pages.dev/.

## Start on another computer

Install Git and Node.js 22+ (20.11 minimum), then:

```sh
git clone https://github.com/martinmfischer/SensouCalc.git
cd SensouCalc
node --test tests/*.test.mjs
node scripts/serve.mjs
```

Open http://127.0.0.1:4173/. No npm installation, database, Supabase project or runtime secrets are needed. Save this repository's root as a project in Codex on the destination computer.

To move the existing conversation too, use the desktop app's host handoff when available: connect the destination computer, save a project for this same Git repository there, then use the current chat's run-location selector in the footer → destination host → **Hand off**. The documented flow transfers chat and Git state to a destination worktree. Cloning Git alone does not transfer a local chat. Browser sign-ins and locally saved calculator scenarios need separate handling. Feature availability can vary; do not assume all local chats automatically sync with account sign-in.

If handoff is unavailable, open a new chat in the cloned project and ask it to read this file, README.md, docs/ADSENSE.md and docs/PRODUCT-EVALUATION.md. This preserves actionable project context, not the complete conversation history.

[Official remote connections and chat handoff documentation](https://learn.chatgpt.com/docs/remote-connections#hand-off-a-chat-between-hosts)

## Current implementation

Dependency-free offline PWA with exact two-way melee/ranged calculations, single-roll simulation, saved scenarios and compact allocation comparison. User-facing text is English. Default new/reset scenarios are Basic; explicit mode and scenario choices persist. Advanced values are preserved but neutralized when hidden. Main page should stay compact; optional allocation comparison opens inline.

README.md records agreed rules, including Tough → halving → Durable, surviving-dice/active-player tiebreaks, uncapped average and median wounds, Counterstrike eligibility and Last Stand interruptions. Ask the user about new rule ambiguities instead of inventing interpretations. Tests and the independent Monte Carlo/monkey scripts are described there.

## Hosting and advertising

Cloudflare Pages project `sensoucalc` uses direct upload, **no Git auto-deployment**. `node scripts/build.mjs` builds `dist/`; zip its contents with files at archive root and upload to the existing Pages project, Production. Include `_worker.js`, `_routes.json` and `_headers`. Never recreate the deleted legacy `sensoucalc.the-zj.workers.dev` endpoint or change the separate SensouTrack project.

AdSense setup and consent publication are done, but advertising is deliberately disabled in `ads-config.mjs`. Google site approval and ads.txt recognition remain pending. The live consent SDK loads, but the actual published dialog did not appear in the forced preview; partner/purpose disclosure and accept/decline/withdraw UI still need a successful real test. See docs/ADSENSE.md for exact activation gates and preview URLs. Do not enable ads just because the code is present.

No deployment or account credentials are stored here. Log in to Cloudflare/AdSense on the new computer as needed. Public publisher and slot IDs are already in the config. Saved calculator scenarios live in each browser's local storage; Share links transfer individual scenarios.

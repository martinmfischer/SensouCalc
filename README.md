# Sensou Calc

Bushido: Risen Sun calculator in the visual style of SensouTrack. A responsive, installable PWA for browsers, Android and iPhone/iPad. All calculations run on the device, including offline. No account, backend, analytics, external runtime requests or npm dependencies.

## Run locally

Requires Node.js 20.11+ (22+ recommended).

```sh
node scripts/serve.mjs
```

Open **http://127.0.0.1:4173/**. Alternatively `npm run dev` if npm is installed. `PORT` overrides 4173. The server binds to loopback only.

```sh
node --test tests/*.test.mjs
node scripts/build.mjs
```

The build copies the production files to `dist/`, with a content-derived service-worker cache version. Serve `dist/` through any static HTTPS host. There is no compilation or package installation step. For Android/iOS installation from a phone, deploy to HTTPS; the desktop's loopback URL is not reachable from the phone. Native App Store / Play Store packages are not included in this version.

## Deployment

Live: https://sensoucalc.the-zj.workers.dev/ — Cloudflare Worker `sensoucalc`, static assets only. No Supabase, server-side database or runtime secrets are needed. SensouTrack was inspected via its public bundle: React/Vite with a Supabase client. It remains a separate application.

`wrangler.jsonc` declares the static `dist/` directory and runs the build before deployment. With Cloudflare Wrangler installed and authenticated, run `npx wrangler deploy`. Alternatively build locally, zip the contents of `dist/` (with `index.html` at the archive root), and upload through the Cloudflare dashboard → sensoucalc → New deployment. The initial release was uploaded through the dashboard; Git auto-deployment is not connected. Never commit credentials or API tokens.

## Features

- Complete two-way Melee Exchange: independently allocated Attack/Defence pools, total surviving-dice tiebreaks, active-player tiebreak, initiative and lethal interruption of the second attack.
- Ranged Attack: Short, Medium and Long range compared simultaneously in one plot and a statistics table, with target size, cover, movement, states and Ranged Defence. Friendly Fire is displayed as a risk only; redirected shots cause zero damage to the intended target. The shooter only shows offensive statistics.
- HP, Brutal, Parry, Adept, Kata, Unblockable, Impenetrable Defence, Prowess, Feint, Dodge, Reach, Lightning Reflexes, Slow, Armour, Pierce, Tough, Sharp, Durable, Strong, Weak and eligible Assassin.
- Critical Attack, Dual Attack, Combo Attack, half damage and half damage with Prone interrupting the second attack. Critical can also be granted in addition to another special attack. Enter dice **after** costs, states, assists and Ki Boosts.
- Cumulative damage probability `P(wounds ≥ x)`, damage distribution and Success Level distribution, with readable tables, an interactive damage threshold and CSV export.
- Local scenario storage (up to 30), reload persistence and shareable scenario URLs. Shared links contain the entered model names and values in the URL fragment. Shared links are portable when hosted on an accessible URL.
- Local fonts and app icons, install manifest and service-worker precache. Once “Offline bereit” appears, the app can be reloaded and used without the server/network. Updates wait until all app windows close.

## Calculator modes and saved scenarios

Basic hides Adept, Sharp, Unblockable, Tough, Pierce, Armour, shared Melee Prowess and its priority, initiative traits, Durable, Kata, damage dice selection and special abilities. Hidden values stay in the complete profiles but are neutralized in the derived calculation input. Advanced restores them. Mode is preserved in saved scenarios, reload persistence and share links. Additional Critical and the separate Reach eligibility control are no longer shown; enable Reach only when it applies.

Average and lower-median wounds are uncapped in both Melee and Ranged. The HP rings switch between those summaries; they show damage versus remaining HP, not outcome probabilities. The out-of-action percentage and HP-loss plots remain based on actual remaining HP. Swap exchanges both complete profiles while keeping the active side fixed.

Scenarios support save, load and delete, including names, hidden traits, mode and conditions, for up to 30 saved matchups per browser. They persist offline and across reloads. There is no account or device synchronization. Share links transfer a complete scenario to another browser, but local saved scenarios do not automatically migrate from localhost to the deployment domain.

## Rules and agreed interpretations

Checked 2026-10-29 against:

- [GCT Rules & Resources](https://gctstudios.com/pages/rules-resources)
- [Official Risen Sun live rule text](https://github.com/GCT-Studios/Risen_Sun) (commit `08a582deddaa7bdbee44a811a50c33a8562d76da`)
- [JwarRef](https://jwarref.netlify.app/), including the general FAQ
- [Official full errata / FAQ, dated 09/09/2026](https://docs.google.com/document/d/1_11LuPcO2sTxs1jaISF6tOSHi6EzqaZl6EzKprflofE/edit)
- [JwarCards](https://jwarcards.netlify.app/) is linked for manually looking up model profiles; this app does not import its card database.

Conventions explicitly confirmed for this app:

1. Wounds: apply Tough (with Sharp), halve and round down when applicable, then apply Durable **last**, separately for each Damage Roll.
2. Tiebreaks: number of remaining dice, then Active Player. Melee counts both remaining Attack and Defence dice. Initiative never changes the Active Player.
3. Continue the Wound Table above SL 10 using `max(0, SL + offset)`: Damage Roll 2: −3; 3: −2; 4–5: −1; 6–8: 0; 9–10: +1; 11: +2; 12: +3.
4. Rerolls optimize expected final pool value (then surviving dice), rather than following a fixed “reroll ones” heuristic.
5. Brutal applies only to the original ranged attack, not the additional Friendly Fire challenge. Prowess and Adept [Ranged] apply to both. Prowess maximizes **success probability** on the binary targeting challenge; its success level does not matter.

### Prowess strategy

Prowess [Attack]/[Defence] maximize the expected result of their respective pool, anticipating later rerolls; Feint/Dodge minimize it. Reroll sequence follows initiative. Choices enumerate all legal subsets of up to the stated budget, including choosing not to reroll.

Prowess [Melee] is one **shared** budget. The model sees both its own pools and chooses how to divide the budget on that roll. “Balanced” maximizes the sum of expected Attack and Defence. “Attack first” or “Defence first” strongly prioritizes that result and uses the other as a secondary objective. Shared Prowess replaces the separate Prowess values. Feint/Dodge still optimize the individual affected pool, rather than a joint tactical objective against shared Prowess.

These are exact probabilities **for the specified strategies**, not a claim of globally optimal play against all four revealed pools or a minimax solution for kill probability. The UI explains this limitation. Per-pool limits: 8 dice and 3 rerolls per trait; shared Melee Prowess supports 8 total dice. Extreme opposing reroll combinations can take a few seconds; the Web Worker keeps the UI responsive.

### Scope

**Average wounds** reports uncapped damage potential, including misses and cancelled counterattacks as zero. Dual/Combo potential continues beyond lethal wounds for this average, but stops on Critical removal. Actual remaining HP still determines out-of-action chance and whether a counterattack takes place. The engine exposes this average as `meanWounds` and the uncapped lower median as `medianWounds`; `wounds` is the uncapped distribution and `mean` remains the capped mean HP loss. Damage plots report **HP actually lost**, capped at the target's remaining HP. They do not show uncapped overkill. Success-Level probabilities are unconditional; misses are excluded from that distribution.

Critical removes the defender on doubles in the **selected** damage dice. Strong/Weak force their usual selection. Eligible Assassin overrides Strong/Weak and may choose any two of 3D6; it selects a pair for Critical when available. Only select Assassin when the model meets its approach/targeting conditions or the enemy is Surprised. Critical removal is tracked separately from actual wounds. “Out of action” combines lethal wounds and Critical removal without double counting; either prevents the counterattack. Further Dual/Combo rolls stop once the target is killed or removed. This does not implement Rise/Last Stand or card-specific prevention of removal.

The interface is English, including accessibility labels, errors, CSV headings and install guidance. All model settings are visible in compact sections; only the optional data table expands. Existing user-entered scenario/model names are preserved (old default model names are migrated).

Model-specific wounded abilities, Rise, Last Stand, Poison, event triggers and arbitrary Ki Feats are not automatically resolved. A generic “half damage + Prone” mode models that damage and interruption only; movements, collisions and other effects of named special abilities require manual adjudication. The interface does not calculate wounds to friendly models; it shows the redirection chance and treats those outcomes as misses for target-damage statistics. HP changes do not automatically change profile statistics.

Counterstrike Defence is an exclusive special ability. It requires allocated Defence dice and at least one allocated Attack die on the opposing model (even if that die rolled 1). A successful defence with SL ≥ 2 inflicts one normal weapon Damage Roll at SL − 2. Resolve it immediately: lethal damage cancels later events. Counterstrike can combine with the same model’s normal attack, so damage statistics include their correlated sum. In exchanges using Counterstrike, the Success Level plot records the highest damage-event SL per model, with no event counted as a miss.

## Simulation verification

Run `npm run verify` for a reproducible, independent Monte Carlo comparison against the exact engine: 18 scenarios with 300,000 trials each (5.4 million attacks/exchanges). Use `npm run verify -- 100000` to change the trial count per scenario. Reports are written to `artifacts/simulation-verification.md` and `.json`, including seeds, the engine hash, exact/simulated metrics and tolerances.

The simulator independently rolls ordered D6s, selects rerolls and damage dice, and applies the printed wound table. It compares every damage bucket and cumulative tail, hit/wound/removal/out-of-action chances, mean HP loss and Friendly Fire. Shared Melee Prowess simulation covers two priorities without simultaneous enemy Feint/Dodge; exact unit checks cover those combined policies. Passing is a statistical regression check for the tested profiles and strategies, not a proof of every rules combination.

Cumulative damage plots show exact percentages at each threshold on hover, tap or keyboard focus. Use Left/Right, Home/End and Escape to navigate or dismiss the tooltip.

## Structure

- `src/engine.mjs`: DOM-independent probability engine; importable in a later SensouTrack integration.
- `src/worker.mjs`: worker interface keeping calculation off the UI thread.
- `app.mjs`, `index.html`, `styles.css`: dependency-free interface and SVG plots.
- `sw.js`, `manifest.webmanifest`, `assets/`: offline/install support, icons, bundled OFL fonts and their licenses.
- `tests/engine.test.mjs`: Node tests including independent ordered-dice enumeration against the weighted-multiset engine.
- `scripts/serve.mjs`, `scripts/build.mjs`: local preview and static production packaging.
- `scripts/verify-simulation.mjs`: seeded dice simulation, independent of the probability engine internals.

The app uses a path-relative scope and relative imports, so it can also be hosted in a subdirectory. Use a distinct service-worker scope if integrating into an existing app. No deployment or Git push is performed by local development/build commands.

Bushido and its rules belong to GCT Studios. This independent community calculator is not affiliated with GCT Studios. Fonts are bundled under their included SIL Open Font Licenses.

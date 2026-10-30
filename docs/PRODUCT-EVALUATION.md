# Product evaluation — 30 October 2026

## Assessment

Sensou Calc is useful for comparing one Bushido exchange or ranged shot, including the chance of stopping a counterattack. Its strongest features are immediate recalculation, all three ranged bands on the same graph, offline operation, complete scenario links and explicit probability distributions. Basic mode now makes common comparisons substantially faster.

The next most valuable improvement is **an allocation comparison**: for a fixed pool, compare legal Attack/Defence splits side by side using expected wounds, removal chance and retaliation. This would answer a practical tabletop decision more directly than adding another decorative chart. A second priority is portable scenario backups. The largest remaining game-logic limitation is strategy: the engine optimises expected pool values, not the tactical outcome of the whole revealed exchange.

This is a source review, reproducible statistical regression and browser usability evaluation. It is not a claim that every card, rules interaction, browser or device has been verified.

## Reproduced issues fixed in this pass

| Issue | Consequence | Resolution |
|---|---|---|
| Impenetrable Defence was available in Basic | A supposedly simplified calculation still contained an advanced rule | Hide it and neutralise it only in derived calculation inputs; preserve stored profiles |
| Ranged Basic still exposed detailed conditions and Friendly Fire | Too much input work and hidden-condition risk | Only a total Challenge Modifier remains; ignore detailed conditions, Ranged Defence, target size and Friendly Fire in Basic |
| Average HP ring used `max(0, HP − uncapped average wounds)` | Overkill made expected remaining HP look too low | Use `HP − E[min(HP, wounds)]` for Average rings; keep unbounded Average wounds as the comparison metric |
| Dense bar charts could calculate a negative bar width | Narrow plots with many HP/SL bins could lose bars | Clamp drawn bar width to a positive minimum |
| Damage-target control remained visible in other plot modes | Its percentages were exact-bin/SL values despite “Damage target” wording | Respect the native `hidden` attribute even when component CSS defines a layout |

For example, a 6 HP target taking either 0 or 12 wounds with equal probability has 6 average potential wounds, but **3 expected HP remaining**, not 0. That difference is why both metrics are useful. Critical removal remains separate from wounds; a removal is not silently converted into extra HP loss.

## UX and visual design

### What works

- Paired profiles, complete-profile swap and Active Player controls support quick matchup comparisons. Keeping the active side fixed on swap is documented in its tooltip.
- Subtle attack/defence/reroll colours and small ability symbols establish structure without replacing text. Users can still identify fields without colour alone.
- Advanced fields are visible together rather than buried in accordions. Basic removes whole irrelevant groups.
- Cumulative plots answer a decision-oriented question: “How likely am I to cause at least X wounds?” Ranged overlays make range penalties easy to compare.
- Cumulative values can be read with pointer, touch or keyboard, with the table as an alternative. Distribution and Success Level have distinct descriptions.
- The single-run display is an explanatory aid: actual initial dice, rerolls, kept dice, challenge comparisons, damage dice and final HP are visible. It preserves joint exchange outcomes rather than independently drawing two damage totals.
- The ad placement sits below the calculator and simulation, separated from controls. It is not sticky and does not interrupt input. With ads disabled it occupies no space.

### Prioritised improvements

| Priority | Recommendation | Reason and acceptance criterion |
|---|---|---|
| High | Compare Attack/Defence allocations | Given a chosen total and costs already paid, show a compact row for each legal split. Keep the same enemy profile and strategy. Show a clear objective rather than claiming one universally best split. |
| High | Scenario export/import as a file | Local storage is browser/origin-specific and clearing it loses saved matchups. Export all scenarios as versioned JSON; import through the existing bounded sanitiser. Confirm replacement or merge behaviour. |
| High | Show the effective ranged challenge breakdown | In Advanced, a small equation beside each band would expose size/cover/manual modifiers and prevent double-counting. In Basic, label the manual value as the total, as now implemented. |
| Medium | Explain preserved Advanced values beside the mode switch | Add a short tooltip or accessible description: hidden values remain saved but do not apply. Switching modes intentionally changes the rules being calculated. |
| Medium | Explicitly distinguish damage potential, HP loss and removal | Current notes and separate Critical percentage help. A small info affordance on Average wounds and the ring would make the distinction discoverable without reading methodology. |
| Medium | Display a compact initiative reason | “Model A attacks first · Reach” is more useful than the name alone. Keep Active Player separate because it controls ties. |
| Medium | Make nonzero Advanced traits easier to scan | A compact summary of active traits would help when returning to a saved profile. Avoid a second full input form or extra accordions. |
| Medium | Improve mobile touch targets and test real devices | Small steppers favour density. Check one-handed input, number keyboards, landscape and a narrow phone; enlarge touch hit areas without making every field taller. No claim of real-device testing is made in this pass. |
| Medium | Make keyboard and screen-reader feedback more selective | Native controls, focus indicators, dialog labels and chart keyboard navigation are present. The full simulation is currently a live region; a short announced outcome plus a normally navigable trace would avoid reading too much after each reroll. Verify with an actual screen reader. |
| Low | Optional mode (most frequent outcome) or middle probability interval | A mean/median ring is not “the most likely outcome”. An interval could communicate uncertainty; use the existing distribution before adding more pie charts. Averages need not be attainable dice outcomes. |
| Low | Compact, actionable calculation timeout | Current worker cancellation and recovery protect responsiveness. Offer a clear way to reduce the costly reroll combination. Avoid silently substituting an approximate result. |

The header is attractive but consumes space. On repeated tabletop use, an optional compact header would improve access to inputs. It should not remove the scenario/mode toolbar. Further filler text is less valuable than explanations attached to the specific decision they clarify.

## Game logic and statistical interpretation

### Covered and checked

Scoring discards ones except Kata, applies supporting-dice limits and Adept, then relevant modifiers. Melee ties use total surviving Attack and Defence dice and then Active Player. Initiative changes attack order, not the Active Player. Zero allocated Attack dice cannot trigger an attack or an opposing Counterstrike.

Damage uses the agreed Wound Table extension, weapon strength and effective Armour; Tough/Sharp precede halving and Durable comes last, per roll. Strong/Weak enforce their chosen pair; eligible Assassin may choose a Critical pair. Dual/Combo and immediate Counterstrike use real HP for interruption. Last Stand preserves attacks after lethal wounds, while Critical removal and Prone still stop them. Friendly Fire uses a fresh targeting test, with Prowess/Adept and without Brutal, and contributes zero intended-target damage on redirection.

These statements describe the implemented and user-agreed model. The [official live rule text](https://github.com/GCT-Studios/Risen_Sun/blob/main/Bushido-Risen_Sun-rulebook-live.md), errata and card text remain the reference for actual play. Explicit table-extension and ordering conventions are recorded in the README; no new disputed interpretation was silently added during this evaluation.

### Important limits, not newly discovered calculation bugs

1. **Reroll objective.** Exact results are exact for the documented policy. Maximising expected Attack result can differ from maximising hit or kill probability against the revealed Defence pool. Shared Melee Prowess adds another tradeoff. A tactical optimiser would need an explicit objective, information order and opponent policy; do not present the current result as globally optimal play.
2. **Manual costs and conditions.** Users must enter allocated dice after costs, states, assists and boosts. Reach and Assassin eligibility are manual. Selecting a special ability does not pay its cost. A future guided allocation mode should validate those costs before claiming legality.
3. **Wounded profiles.** Remaining HP affects lethal interruption and removal chances, but does not automatically change a model’s abilities or statistics. Card-specific wounded changes need manual adjustment.
4. **Pre-existing Last Stand at 0 HP.** Last Stand reaching 0 during the simulated exchange works. Profile inputs currently start at 1 HP, so they cannot describe a model already at 0 and still acting under Last Stand. This is a genuine scope gap. Before adding it, confirm the intended zero-HP starting-state semantics and metric labels with the user.
5. **Exchange scope.** This is one melee exchange or ranged shot, not a full activation/turn/game simulation. Rise, Poison, post-attack triggers, arbitrary Ki Feats, movement/collisions, healing and individual card exceptions are not automatically resolved. Their omission should remain explicit rather than approximated through generic toggles.
6. **Friendly models.** The UI deliberately does not resolve damage to an unspecified friendly model. It shows redirection risk and intended-target damage, matching the requested simplification.
7. **Special-ability combinations.** The selector represents one special ability at a time. Additional Critical was deliberately removed. Individual effects granting combinations need separate modelling, not arbitrary simultaneous options.
8. **Success Level with Counterstrike.** The plotted value is the model’s highest damage-event SL in the exchange, not a histogram of every damage roll. This supports one probability mass per exchange but deserves a more contextual chart caption.
9. **Performance limits.** Eight dice per pool and three rerolls are accepted; shared Melee Prowess supports eight dice total. Some opposing-reroll combinations can exceed the 20-second worker deadline. The UI should stay usable and report the limitation. The random fuzz run below deliberately uses smaller pools to cover many combinations within a practical test time.

Highest-value rule expansion: zero-HP Last Stand starting states and explicit wounded-profile inputs. Broader card effects should follow concrete requested models and confirmed wording. Adding every keyword without handling its timing would reduce trust in the calculator.

## Technical and security evaluation

The app has no database query or server command interpreter receiving scenario text. Dynamic names and errors are escaped, imports are bounded and whitelisted, CSV formula prefixes are neutralised, the preview restricts public paths and deployed headers restrict scripts/framing. The new simulation uses the same escaping for names and errors and cryptographic unbiased D6 generation; no extra runtime dependency was introduced.

No exploitable injection was reproduced in this pass. That is a bounded finding, not a security guarantee. Browser checks rendered an HTML event-handler payload as literal model-name text and created no image element. Existing parser, CSV, path, worker-race and advertising-gate regressions still pass. See [SECURITY-REVIEW.md](SECURITY-REVIEW.md).

AdSense is **prepared, not active**. Account access, actual publisher/ad-unit IDs, site approval and a certified consent integration are separate outstanding requirements. Current strict static CSP intentionally prevents loading Google ads. Actual activation also requires per-response nonces and an advertising-compatible CSP, with revised privacy information. Do not solve that by disabling CSP or inserting guessed IDs. The new public Privacy page describes the current deployment truthfully.

The old Worker was deleted with the user’s action-time confirmation. Cloudflare’s application list then showed the SensouCalc Pages project and both existing SensouTrack applications. The old Worker configuration and obsolete deployment instructions were removed.

## Verification evidence

| Check | Result | Scope |
|---|---|---|
| Node regression suite | 41 tests passed | Exact engine, rules/interruption, scenario/security, worker cancellation, ads gate and new simulation |
| Independent Monte Carlo oracle | 18 fixtures × 300,000 = 5,400,000 trials; 49,966,259 D6 rolls; all passed | Independently implemented ordered-dice scoring, reroll decisions, printed table and damage buckets; six-standard-error tolerance plus continuity allowance |
| Interactive sampler vs exact | 24,000 exchanges/shots plus 3,000 opposed-reroll pools | Includes shared Melee Prowess with opposing Feint/Dodge in both initiative orders, Counterstrike, Last Stand and Prone. Reuses the production policy, so this is a regression comparison, not an independent rules oracle. |
| Seeded engine monkey run | 300 scenarios, 3,600 simulated runs, 1,176 metrics; no failures | Probability sums/bounds, legal dice/HP, capped vs uncapped means and no mutation of saved scenarios; seed `0x30cafe` |
| Browser monkey run | 260 random control actions; no action failures, rendered NaN/Infinity or page-width overflow; no captured JS warnings/errors | Modes, Basic/Advanced, numbers, names, powers, specials, conditions, active side, swap, plot modes, summary mode and repeated simulations |
| Directed browser workflows | Passed | Disposable scenario save/load/delete, reload persistence, escaped model names, numeric boundaries using native typing, repeat roll, long-range selection and hidden Basic controls |

Raw run reports are in ignored `artifacts/monkey-engine.json`, `artifacts/monkey-ui.json` and `artifacts/simulation-verification.{md,json}`. Repeat the engine checks with `node scripts/monkey.mjs`, `node --test tests/*.test.mjs` and `node scripts/verify-simulation.mjs 300000`.

### Verification limits

The attempted 390px browser viewport override did not change the observed viewport dimensions. The random UI actions therefore count as desktop browser checks, **not verified mobile checks**. Existing responsive CSS was reviewed, but a fresh phone-size visual/touch run and actual iOS Safari/Android installation remain release follow-ups. A desktop screenshot initially named `simulation-mobile.png` is not evidence of mobile validation.

This pass did not exhaust all 8-dice/3-reroll combinations, perform a full accessibility audit or prove every card-specific rule. The independent oracle’s shared-Prowess fixtures do not include opposing Feint/Dodge; those combinations are covered by exact tests and the production sampler comparison. There is no automatic site-to-site scenario migration or native store packaging.

## Suggested next iteration

1. Confirm and add pre-existing zero-HP Last Stand states.
2. Add allocation comparison with a user-selected objective and explicit cost inputs.
3. Add scenario backup/import and a compact challenge breakdown.
4. Complete real mobile, offline-install and screen-reader checks.
5. Activate advertising only after account/site/consent/CSP setup is complete and verified together.

Keep the current lightweight deployment and separate DOM-independent engine for later SensouTrack integration. A server database is not needed for those improvements unless cross-device account sync becomes an actual requirement.

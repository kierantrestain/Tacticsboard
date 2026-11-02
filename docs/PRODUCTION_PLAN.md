# Bang On Football Studio production plan

Baseline: `main`, `0e44274b985526168b2d37531eb62304f783dba0` (v5.2). Master prompt received 1 November 2026. Preserve newer commits and the main auto-deployment guard. No production release, purchases or access-audience changes are authorised.

Status vocabulary: **Verified** means checked in this run with evidence below; **Implemented but unverified** means code exists or historical evidence is recorded; **Partial** means gaps remain; **Missing** means no connected implementation. Blocked scenarios retain their implementation status and name their dependency.

Current review: app **6.0.1 / protocol 4**, branch `codex/bang-on-football-studio-v6-review`. The Hub's `BUILD-INFO.json` identifies its exact source commit. The [final nine-step evidence matrix](PRODUCTION_EVIDENCE.md#final-audit--2-november-2026) supersedes the historical checkpoint next-actions below. Implementation is delivered for controlled review; recording sign-off and remote publication remain open.

## Ordered requirements — final review status

| Stage / requirement | Current status | Evidence scope / remaining dependency |
| --- | --- | --- |
| A1 source previews, batch import, organisation, rename, replace/relink | Partial | Synthetic import/rename/held-output paths and reference validation checked; full representative-media/relink rehearsal remains open |
| A2 picture crop/rotation/adjustment/editable timed ink | Partial | Synthetic saved cases and 4K still inspected; complete rendered MP4 consistency unverified |
| A3 transport, original timestamps, ranges, pauses, bounded processing | Partial | Synthetic transport/bounds exercised; representative long/VFR/native timing unverified |
| A4 calibration, identity, review, correction, camera cuts | Partial | Seeded reviewed observations reopen; real detector accuracy/cuts and identity review need representative footage |
| A5 still references, editable possession/movement, camera poses | Partial | Five synthetic cases reopened/modified/presented; actual orbit/zoom pose review remains unverified |
| A6 ordered prepared views and private preparation | Partial | Private recall/processing/export preserve held output; full multi-match ordered rehearsal remains open |
| B1 create/name/duplicate/reopen/resume complete episode | Verified | Browser named episodes, duplication/reopen and paused/private recovery; automated snapshot/reference preservation |
| B2 write ordering, failure/interruption and valid recovery checkpoints | Verified | Atomic ordered saves and simulated failure/interruption/corruption checks pass; browser checkpoints exercised |
| B3 separate drawing clear, saved-moment restore, setup reset, fresh episode | Verified | Scope-labelled controls, undo/checkpoint recovery and browser reset/restore checks |
| B4 complete validated portable import/export | Partial | Manifest/preflight and fresh fake-IndexedDB transfer pass; actual ZIP browser download/fresh-profile import unverified |
| B5 bounded in-app transfer of sources over 200 MB | Partial | Checked 32 MiB volume route and 210,763,793-byte synthetic preflight; complete browser transfer unverified |
| B6 advanced graphics/cohort snapshots retained | Partial | Frozen-resource validation/automated transfer and browser save/recall pass; full downloaded backup round trip unverified |
| C1 filming controls, search/private notes and ownership visibility | Partial | Earlier independent browser sessions verified; integrated protocol-4 acceptance awaits temporary control approval |
| C2 scene/episode/epoch fencing, coalescing and feedback | Verified | Real loopback relay and queued-filter regression pass; post-fix rapid-input browser retest remains separately open |
| C3 independent producer/H1/H2/output recovery | Partial | Emulated handover/producer refresh and restart invalidation checked; integrated reconnect and physical sleep/Wi-Fi remain open |
| C4 touch layouts 1024×768/larger and measured latency | Partial | 1024×768 / 1366×1024 emulation and cloud timing recorded; physical touch/LAN latency unverified |
| D1 provider/competition/season coverage audit | Verified | Existing sources retained; eligible historical release, exact coverage/provenance and current-feed dependency documented |
| D2 neutral events, JSON/CSV validation, coordinates, revisions/provenance | Verified | Import validation, asymmetric both-half transforms, correction/deduplication and missing-data tests pass |
| D3 deep player/team categories, denominators, available trends | Verified | Implemented for supplied coverage with visible denominators/partial fields; unsupplied metrics remain unavailable |
| D4 filterable shot/pass/cross/defensive/touch/carry maps and event detail | Verified | Real located-event maps and browser count reconciliation; limited touches/carries and absent recipients are explicit |
| D5 percentile radars with independent positional reference population | Verified | Independent 514-player historical population, sample/position/minutes/rank tests and frozen five-player browser recall |
| D6 2–5 comparisons, unlimited selected metrics and leaderboards | Verified | Automated 2–5 logic; five-way browser matrices with 51/57 metrics, saved scrolling and complete CSVs |
| D7 current-season Premier League event feed | Missing | No permitted current event provider configured; supply documented feed/export and rights; 2017/18 remains historical |
| E1 linked segment context, data/maps/radars/footage/tactics/private notes | Partial | Frozen context/resources, analyst alignment, saved notes/graphics and automated transfer checked; full show rehearsal open |
| E2 controlling-host map/radar filtering/event inspection | Implemented but unverified | Same ownership protocol extended and regression-tested; post-fix browser acceptance blocked by control authorisation |
| E3 explicit refresh/corrections, response races, immutable held graphics | Verified | Explicit refresh/override removal, background snapshot isolation and held-map checks; no live current feed asserted |
| E4 broadcast typography, 16:9 canvas use, pane/label legibility | Partial | Exact 16:9 managed-browser frame and enlarged panes checked; studio-distance/capture inspection unverified |
| F1 source/requirements/startup/access reconciliation | Verified | Final audit step 1 passed within review scope; no remote publication/deployment |
| F2 complete multi-match episode | Partial | 13-moment synthetic episode prepared; complete multi-match two-host rehearsal unverified |
| F3 media/reconstruction and downloaded MP4 | Partial | Synthetic cases/PNG checked; no encoder in preview browser, representative long/VFR/GPU checks unavailable |
| F4 football data correctness/coverage | Verified | Final audit step 4 passed for declared historical/synthetic coverage; current-feed dependency explicit |
| F5 persistence/real ZIP/fresh-context/long-source transfer | Partial | Automated and manifest/recovery checks pass; real ZIP/fresh-browser/large-source round trip unverified |
| F6 independent hosts and recovery | Partial | Earlier emulation and protocol regression pass; renewed controls blocked and physical checks unavailable |
| F7 programme/hold/follow/blackout/recovery/capture | Partial | Browser programme isolation/recovery checked; downstream capture chain unavailable |
| F8 60-minute rehearsal and performance | Partial | Single cloud interaction timings only; full duration/resource/physical performance unverified |
| F9 regression and fresh-operator handoff | Verified | Final 306 tests / 33 files, TypeScript, production build and matching Hub; operator/evidence/source handoff prepared |

## Historical execution log

- Repository verified on `main`; remote also points to the v5.2 checkpoint; clean working tree at entry; no applicable `AGENTS.md` found in checkout or workspace ancestors.
- Read the v5.2 release guide. Its 261 tests and prior browser checks remain historical evidence, not new-run checks.
- Inspect and exercise Stage A first; fix demonstrated integration faults. Then implement B, C, D, E and the consolidated F audit in order.
- Stage A integration pass completed in the available synthetic/managed-browser environment: five reopened/modified/presented cases, rename/group preservation, baseline regression and affected tests/build. Fixed private recall replacing programme under live follow and export follow restoration. This does not promote the long/VFR/GPU/hardware checks to verified; see evidence scope.
- Next: Stage B atomic/ordered persistence, checkpoints/scoped reset and bounded complete-episode transfer, then C through F. Remaining A native/hardware cases are carried into final acceptance rather than silently counted as passed.
- Keep exact checks and failures in [PRODUCTION_EVIDENCE.md](PRODUCTION_EVIDENCE.md). At any execution limit, commit a continuation checkpoint with exact next actions; do not label remaining stages complete.

- Stage B implementation checkpoint: complete episode library/recovery, atomic ordered saves and bounded SHA-256 volume backups implemented. Targeted tests and large-file browser preflight are recorded in the evidence. B4/B5 remain **Partial** until actual ZIP browser download and fresh-profile transfer pass; B6 snapshot storage/transport foundation exists and needs D/E integration. Directory saving is implemented but unverified. Continue C now; retain these acceptance gaps.

- Stage C core controls/protocol/private notes implemented and exercised with four independent browser tabs; affected tests and build passed. See evidence and HOST_OPERATIONS.md. Physical operation remains unverified; map/radar commands will extend the same protocol in D/E. Continue D data-source foundation and graphics now.


## Studio 6 implementation checkpoint — 2 November 2026

D/E are now implemented on current main's continuation worktree: provider-neutral JSON/CSV validation, coordinate/orientation/revision handling, a checksum-verified CC BY 4.0 historical PL archive, maps/event inspection, covered profiles/logs/leaderboards, independent-cohort percentile radars, five-way player/team comparisons through the existing engine, complete data exports, immutable resource snapshots, producer/host controls and source-revision-aware analyst alignment. Current-season event coverage remains a named provider dependency, not an enabled demonstration.

B6 has been extended: large resources use checked bounded ZIP volumes in backup version 2; old inline resources and legacy small ZIPs remain compatible. Required references/highlights are validated. Match source refresh is explicit, manual overrides are recoverable/removable, and background research no longer changes prepared scores. Named episodes survive fixture changes. Main auto-deployment remains disabled.

Automated regression at this checkpoint: 303 tests / 33 files passed, plus a subsequent relay resource-fence case pending execution. TypeScript and the Studio 6 production build/59.2 MB Hub package passed before the last reference-validation/docs changes. Browser archive import, map filters, moment save and held-output inspection have been exercised; integrated final acceptance is now underway. Do not promote browser downloads, fresh-profile transfer, long/VFR/GPU, physical tablets/capture or the 60-minute rehearsal without the corresponding evidence.

Next actions: complete the integrated nine-step audit, fix demonstrated faults, update the final matrix/evidence, produce the committed matching Hub, and retain exact blockers. No production deployment is authorised.


Continuation branch: `codex/bang-on-football-studio-v6-review`, based on the completed v6 commit `d13bb79` on the current-main lineage. Automatic approval review rejected publishing to remote main. Continue with this separate review branch/draft PR and a matching runnable Hub; do not bypass the rejection or merge. Main's deployment guard remains false, and this review branch also disables Git-triggered deployment. Fast-filter repair is app 6.0.1 / protocol 4; affected checks passed.

## Final next actions

All independent implementation is delivered in the review branch. Final regression is **306 tests / 33 files**, with TypeScript, production build and standalone Hub checks passing. Final source/package identity is carried by the Hub's `BUILD-INFO.json` and the downloadable audit; do not substitute an older preview package. The review remains unpublished because automatic approval review rejected publication. A source-recovery bundle preserves the unpublished commits for an existing clone containing base `2f5dd2bfdb2398ba8e7730f8d0c380fa698cdb29`.

1. Obtain explicit authorisation for only the two temporary protocol-4 preview hosts, then finish the rapid-filter/handover/reconnect browser acceptance. Do not bypass the prior access rejection.
2. Obtain explicit authorisation for the isolated review-branch push/draft PR to the named repository. Do not update remote main, merge, alter audience or deploy production.
3. On the actual show computer/browser, finish real ZIP downloads and a fresh-profile complete restore including the >200 MB source; finish downloaded MP4/representative long/VFR/native decoder/GPU checks. Keep the current browser limitations visible.
4. With physical tablets and the actual TV/OBS/capture chain, rehearse the complete multi-match episode for 60 minutes, including private notes, host handovers, heavy work, sleep/reconnect and exact blackout/restore. Record hardware/network/resource use and interruptions.
5. For current-season PL events, provide a permitted documented feed/export and minutes/reference data. No provider purchase or fabricated coverage is part of this review.

Controlled rehearsal may evaluate the verified producer/historical-data paths. Recording sign-off waits for the open acceptance checks in [PRODUCTION_EVIDENCE.md](PRODUCTION_EVIDENCE.md). These are precise unverified dependencies, not a claim of production readiness.

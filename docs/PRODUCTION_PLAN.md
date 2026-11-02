# Bang On Football Studio production plan

Baseline: `main`, `0e44274b985526168b2d37531eb62304f783dba0` (v5.2). Master prompt received 1 November 2026. Preserve newer commits and the main auto-deployment guard. No production release, purchases or access-audience changes are authorised.

Status vocabulary: **Verified** means checked in this run with evidence below; **Implemented but unverified** means code exists or historical evidence is recorded; **Partial** means gaps remain; **Missing** means no connected implementation. Blocked scenarios retain their implementation status and name their dependency.

## Ordered requirements

| Stage / requirement | Initial status | Dependency / next action |
| --- | --- | --- |
| A1 source previews, batch import, organisation, rename, replace/relink | Implemented but unverified | Exercise actual v5.2 app and protect IDs/held output |
| A2 picture crop/rotation/adjustment/editable timed ink | Implemented but unverified | Reopen and compare preview/programme/export |
| A3 transport, original timestamps, ranges, pauses, bounded processing | Implemented but unverified | Test supported frame/codec paths; label VFR uncertainty |
| A4 calibration, identity, review, correction, camera cuts | Implemented but unverified | Five deliverables with reviewed observations; no inferred unseen actors |
| A5 still references, editable possession/movement, camera poses | Implemented but unverified | Save/reopen/modify/present all five cases |
| A6 ordered prepared views and private preparation | Implemented but unverified | Multi-match episode, order/timing/notes and held-shot checks |
| B1 create/name/duplicate/reopen/resume complete episode | Partial | Existing project/rundown/IndexedDB; improve scope and saved status |
| B2 write ordering, failure/interruption and valid recovery checkpoints | Partial | Serialise/atomically preserve last valid state; test failure paths |
| B3 separate drawing clear, saved-moment restore, setup reset, fresh episode | Partial | Scope-labelled recoverable actions; never mutate another moment |
| B4 complete validated portable import/export | Partial | Validate references/corruption, transactional media import, fresh context |
| B5 bounded in-app transfer of sources over 200 MB | Missing | Segment packaging or streamed/chunked complete transfer without a giant ZIP buffer |
| B6 advanced graphics/cohort snapshots retained | Missing | Extend when D/E is connected; retest transfer |
| C1 filming controls, search/private notes and ownership visibility | Partial | Extend existing HostTablet/Hub/protocol, not a second protocol |
| C2 scene/episode/epoch fencing, coalescing and feedback | Partial | Verify stale/duplicate/delayed/disconnected commands |
| C3 independent producer/H1/H2/output recovery | Implemented but unverified | Emulate sessions and sleep/reconnect/restart; physical Wi-Fi unavailable |
| C4 touch layouts 1024×768/larger and measured latency | Implemented but unverified | Browser viewport checks; label emulation and conditions |
| D1 provider/competition/season coverage audit | Partial | ESPN/FPL totals exist; verify documented event source and permitted usage |
| D2 neutral events, JSON/CSV validation, coordinates, revisions/provenance | Missing | Required foundation for every map; no totals-to-arrows fabrication |
| D3 deep player/team categories, denominators, available trends | Partial | Existing profiles/comparisons retained; enrich only supported fields |
| D4 filterable shot/pass/cross/defensive/touch/carry maps and event detail | Missing | Real located events, orientation, counts, filters and genuine recipients |
| D5 percentile radars with independent positional reference population | Missing | Cohort/minutes/basis/version, missing/ties/direction and snapshots |
| D6 2–5 comparisons, unlimited selected metrics and leaderboards | Implemented but unverified | Preserve and connect categories, rates, matrix, readable graphics |
| D7 current-season Premier League event feed | Missing | No licensed/documented current event feed configured; continue with eligible historical/open source |
| E1 linked segment context, data/maps/radars/footage/tactics/private notes | Partial | Persist graphic state, snapshots, analyst clock alignment |
| E2 controlling-host map/radar filtering/event inspection | Missing | Extend existing command ownership and fences after D |
| E3 explicit refresh/corrections, response races, immutable held graphics | Partial | Pin prepared data; late responses must not cross selected context |
| E4 broadcast typography, 16:9 canvas use, pane/label legibility | Partial | v5.2 comparison leaves space; improve composition and inspect clean output |
| F1 source/requirements/startup/access reconciliation | Missing | Final audit after implementation; code/evidence SHA linkage |
| F2 complete multi-match episode | Missing | Both private notes, maps/radars, five-player/five-team, transitions |
| F3 media/reconstruction and downloaded MP4 | Missing | New-run browser evidence; licensed long/VFR/GPU when available |
| F4 football data correctness/coverage | Missing | Real event count/orientation/cohort and missing-zero reconciliation |
| F5 persistence/real ZIP/fresh-context/long-source transfer | Missing | Stage B route, failures/corruption and advanced snapshots |
| F6 independent hosts and recovery | Missing | Emulated evidence separate from physical tests |
| F7 programme/hold/follow/blackout/recovery/capture | Missing | Receiver acknowledgement does not certify OBS/display chain |
| F8 60-minute rehearsal and performance | Missing | Final prepared episode, timed run, documented environment/resources/interruptions |
| F9 regression and fresh-operator handoff | Missing | Required tests/type/build/Hub package, reviewed preview only |

## Execution log and next actions

- Repository verified on `main`; remote also points to the v5.2 checkpoint; clean working tree at entry; no applicable `AGENTS.md` found in checkout or workspace ancestors.
- Read the v5.2 release guide. Its 261 tests and prior browser checks remain historical evidence, not new-run checks.
- Inspect and exercise Stage A first; fix demonstrated integration faults. Then implement B, C, D, E and the consolidated F audit in order.
- Stage A integration pass completed in the available synthetic/managed-browser environment: five reopened/modified/presented cases, rename/group preservation, baseline regression and affected tests/build. Fixed private recall replacing programme under live follow and export follow restoration. This does not promote the long/VFR/GPU/hardware checks to verified; see evidence scope.
- Next: Stage B atomic/ordered persistence, checkpoints/scoped reset and bounded complete-episode transfer, then C through F. Remaining A native/hardware cases are carried into final acceptance rather than silently counted as passed.
- Keep exact checks and failures in [PRODUCTION_EVIDENCE.md](PRODUCTION_EVIDENCE.md). At any execution limit, commit a continuation checkpoint with exact next actions; do not label remaining stages complete.

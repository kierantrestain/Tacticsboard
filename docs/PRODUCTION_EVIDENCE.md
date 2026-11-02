# Bang On production evidence

This file records only checks performed for the master-prompt run begun 1 November 2026 (Europe/London). Earlier v5.2 evidence is in [MEDIA_ANALYSIS_V5_2.md](MEDIA_ANALYSIS_V5_2.md) and is not counted as new-run verification.

## Source and environment

| Check | Result |
| --- | --- |
| Repository | `https://github.com/kierantrestain/Tacticsboard.git` |
| Working branch / remote at entry | `main` / `0e44274b985526168b2d37531eb62304f783dba0` |
| Checkpoint ancestry | The requested checkpoint is the current remote main; no newer commits observed at initial fetch |
| Working changes at entry | None |
| Applicable AGENTS.md | None found in checkout or workspace ancestors |
| Main auto-deploy guard | Read `vercel.json`; `git.deploymentEnabled.main=false` retained |
| Execution environment | Managed Linux development container; browser emulation available; no physical tablets/studio capture hardware supplied |

## Dependencies and source research

- Opened the two requested Opta Analyst profiles, competition statistics page, official Opta event definitions, radar methodology article and Hudl/StatsBomb open-data repository. These are depth/method references, not a supported free current PL production API.
- Read the open-data README through GitHub. It describes selected leagues for football research/analytics and requires StatsBomb attribution and logo for distributed analysis. Source-specific eligibility and attribution must be carried into any enabled dataset; no paid rights were acquired.
- Current-season PL event coverage, actual studio/Wi-Fi latency, physical touch handling, studio GPU path and OBS/capture remain unverified dependencies.

## Checks in this run

### Stage A integration pass (working changes based on 0e44274)

- New-run baseline: `npm test` passed 261 tests / 28 files. These are new executions, separate from the earlier release guide.
- Reproduced a private-recall fault: enable Follow edits on a source shot, then recall a saved 2D moment. The receiver changed to the tactical board without an explicit take. Fixed recall to hold output before editing; reconstruction preparation and all export paths hold output, and film export no longer silently restores follow afterwards.
- Affected regression run: 13 tests / 3 files passed, including a new private-recall assertion. Full `npm run build` passed, including report checks, pinned-model preparation and 41.7 MB Studio Hub packaging.
- Managed Chrome at `http://terminal.local:4173/`: modified presenter notes, explicitly presented, reloaded and recalled each of the five existing synthetic analyses: freeze picture, annotated clip, three-picture sequence, source-only editable 2D reconstruction and source-versus-3D comparison. All five new note edits survived reload. Follow remained off on recall; the comparison stayed held during source-library changes.
- Renamed the source video and changed its segment, then opened it. The original 0–3 second trim, analysis and source remained linked; held programme still identified the comparison shot. Decoded/approximate frame controls and full-source filmstrip were present. This is a ten-second synthetic source, not a long/VFR or licensed match recording.
- Scope: these browser cases reopen seeded synthetic reviewed observations from the prior test project; they do not newly validate detector accuracy or real player identity. Native VFR stepping, long-source pressure, fresh-profile transfers, actual orbit/zoom pose review and physical studio paths remain outstanding. The consolidated final audit has not been run.

### Provider eligibility finding

- Read the actual `hudl/open-data/LICENSE.pdf` obtained through GitHub's base64 file API. Its 8 September 2023 public-data agreement prohibits commercial exploitation and redistribution of source data, and requires logo attribution for published analysis. The README alone was insufficient. No StatsBomb events are being enabled as the show's default commercial feed and no licence or subscription has been purchased.
- Its competition index lists historical Premier League 2003/04 and 2015/16, not current 2026/27 coverage. Read Metrica's primary sample-data README: anonymised actual games, documented 0–1 coordinates and public attribution requirements. Investigating the CC BY 4.0 Wyscout research release as another eligible historical test source.

## Final audit — 2 November 2026

This is a scoped acceptance result, not a recording certification. **Passed** applies to the stated environment and dataset; **Not verified** means a required part of the step remains open. Earlier checkpoint sections below retain their original chronology. The final executable source is identified by `BUILD-INFO.json` in the matching Hub; the review branch is `codex/bang-on-football-studio-v6-review`.

| Step | Result | Evidence / limitation |
| --- | --- | --- |
| 1 source/requirements | Passed | Requested v5.2 ancestor and newer A–C commits preserved; exact repository/branch checked; current operator commands reconciled; protocol 4 and app 6.0.1 agree; main/review Git deployment guards remain false. No push, PR or deployment completed. |
| 2 complete episode | Not verified | A 13-moment synthetic review episode includes the five media cases, a real historical event map, five-player radar, five-player/five-team comparisons, notes and a large test source. Recall, duplication and selected edits were exercised. A complete multi-match, two-host show with all ordered transitions has not been rehearsed. |
| 3 media/reconstruction | Not verified | Five synthetic saved cases reopened/modified/presented; downloaded 3840×2160 PNG inspected. Current managed browser reports no supported video encoder, so no new downloaded MP4 was played. Representative long/VFR match media, detector accuracy, actual orbit/zoom review and native studio GPU paths remain open. Earlier v5.2 in-app MP4 preview is historical evidence only. |
| 4 football data | Passed | Scoped to declared historical/synthetic coverage: real archive integrity/counts, both-half orientation, missing/zero/outcome distinctions, independent-cohort ranks and 2–5 comparison logic checked. Browser five-way matrices and full CSVs checked. Current-season PL located-event coverage is unavailable and remains a provider dependency. |
| 5 persistence/transfer | Not verified | Ordered writes, interruption/corruption rejection, frozen resources and fresh fake-IndexedDB transfers pass automated checks; browser recall/checkpoint/reset/duplicate and backup manifest preflight exercised. Browser ZIP download timed out; downloaded-volume import into a fresh browser profile and the full >200 MB browser transfer remain unverified. |
| 6 two hosts | Not verified | Earlier independent producer/H1/H2/output emulation, private notes, handover, refresh disarming and landscape layouts passed. Protocol-4 fast-filter fix passes regression; renewed control enabling was blocked by automatic approval review, leaving its post-fix browser test and integrated two-host rehearsal open. Physical touch/Wi-Fi/sleep tests are unavailable. |
| 7 programme/recovery | Not verified | Browser held-output isolation, explicit take, exact 16:9 frame, blackout/restore and recovery inspected; no research/private notes in the clean view. No actual TV/OBS/display/capture chain was supplied, so downstream output is unverified. |
| 8 performance/rehearsal | Not verified | Individual cloud automation measurements: 651 ms transport click-to-observed pause and 344 ms cross-filter selection-to-observed counts. They include automation/cloud overhead and are not physical tablet latency. No uninterrupted 60-minute integrated rehearsal or sustained studio resource measurement completed. |
| 9 regression/handoff | Passed | Final 306 tests across 33 files, TypeScript, production build and Hub packaging passed. Standalone Hub starts as 6.0.1/protocol 4 and serves checksum-valid historical archive bytes. Current operator/recovery instructions and an unpublished source-recovery bundle form the review handoff. Remote publication remains blocked. |

## Readiness

Controlled rehearsal: suitable for supervised evaluation of the verified producer/media/historical-data paths, with a complete backup and the limitations above visible. The integrated dual-host rehearsal must finish after temporary test controls can be enabled. Recording: not ready for sign-off while the required download/transfer, full-duration, host-control, representative-footage and physical capture checks remain open. A build or chart alone does not establish recording readiness.

## Stage B checkpoint — 2 November 2026

Implemented ordered per-episode saves with an atomic previous-valid checkpoint, three explicit producer checkpoints, fallback recovery, scoped draft reset, stable naming, duplicate/resume and accurate pending/failed states. Resuming is paused and private. Large media remains in IndexedDB rather than repeated localStorage/autosave copies. Source calibration/targets are now captured per show moment.

Complete episode backup uses one manifest plus bounded 32 MiB ZIP volumes, SHA-256 checks, original byte/time preservation and immutable resource snapshots. Up to 8 GB per episode/256 sources, still subject to device quota. Import validates all references/volumes, stages chunks, then atomically publishes media and resources. Interrupted operations retain the existing episode. Expired isolated import staging is reclaimed after 24 hours. Existing JSON and <=200 MB ZIP routes remain compatible. No giant ZIP-limit increase.

Checks actually run:
- Targeted media/persistence run: **35 tests / 5 files passed** before final hardening. Then **17 tests / 3 persistence files passed**, including synchronous clone failure rollback after hardening.
- TypeScript and full production build/Studio Hub package passed before final clone/staging hardening; final regression must cover the later changes.
- Fake IndexedDB fresh-context volume round trip retained source bytes, IDs remapped consistently, source timing, timed ink and immutable data snapshots. Corrupt/missing/mismatched volumes, conflicting resources and interrupted writes rejected without replacing the valid episode.
- A 201 MiB + 3 byte test source produced seven bounded chunks; maximum source read was 32 MiB. This is a storage test, not long match-footage evidence.
- Managed Chrome UI imported and decoded a valid padded **210,763,793-byte**, 10-second synthetic MP4. The existing comparison stayed held. Complete backup preflight/hash succeeded and offered 11 volumes for five referenced sources. This verifies large file size, **not** representative long/VFR footage.
- Actual browser manifest download succeeded (JSON). First 32 MiB ZIP volume was prepared, but `waitForEvent(download)` and the supported link-download operation both timed out. **Actual browser ZIP download/fresh-profile browser transfer remain unverified**, as do directory-picker saving and physical transfer. Do not substitute the unit round trip for these checks.

Next: two-host controls/recovery, then data foundation/graphics and integrated acceptance. Stage A hardware/native cases remain outstanding. No production deployment performed.

## Stage C implementation and emulated checks — 2 November 2026

Extended the existing Hub/command queue/HostTablet (no second protocol): separate role-private notes, independent searchable moment inspection with explicit preview recall, comparison view switching, Freeze & draw, loop, explicit Take/Hold/Live follow/Blackout/Restore, version identification and pending/applied/rejected acknowledgements. Enabling host control no longer enables TV follow. Emergency commands bypass preparation busy checks. Shared command context now includes episode, scene, view, source and selected cue; version/expiry/epoch/sequence fences are checked at the relay and current context again at the producer. Refresh/loss/episode changes disarm ownership; sleep clears queued gestures and releases ownership when connected.

- **27 tests / 5 affected files passed**, including new real loopback HTTP/SSE relay tests for per-role note filtering (including reconnect), ownership/context/version/time/dedup fences, applied acknowledgement, producer replacement, episode changes and Hub restart invalidation. TypeScript passed.
- Full production build and Hub packaging passed: 2301 modules, 41.7 MB / 196 packaged files. Shared relay protocol is included in the Hub.
- Managed Chrome/Vite, four independent producer/Host 1/Host 2/output tabs on the same cloud browser: paired both roles; enabled host controls without TV follow; requested Host 1 ownership; recalled the annotated source privately, looped/played/froze it; comparison remained held. Host 2 privately inspected another moment; handover to Host 2 disabled Host 1 shared controls.
- Entered distinct H1/H2/producer notes. Accessibility inspection verified each tablet contained its own note and neither the other host's nor producer's private text. Shared script remained available separately.
- Producer refresh left both hosts connected but controls disarmed/producer-owned and follow off. Episode resumed paused at the saved source position. Held comparison remained selected. This is browser receipt evidence, not a studio capture-chain check.
- One automation click-to-paused-visible measurement: **651 ms** (includes automation/cloud-preview overhead; single sample, not physical LAN latency). No claim of physical Wi-Fi performance.
- A temporary, excluded iframe harness gave the actual host document **1024×768** and **1366×1024** CSS viewports. Both main elements had scroll width/height equal to client width/height (no page overflow). Inspected 1024×768 screenshot: filming controls, searchable scrollable rundown and private notes fit. Physical touch accuracy, sleep/wake and device performance remain unverified.

Operator instructions: `docs/HOST_OPERATIONS.md`. Final integrated data controls/rehearsal/recovery audit remains pending, as do physical devices and capture chain.


## Studio 6 data/integration checkpoint — 2 November 2026

- Recovered the interrupted run at main `2f5dd2b`, preserving the three untracked event-model files and all A–C commits. A fresh `git fetch origin main` confirmed that head; the requested v5.2 checkpoint is an ancestor. No applicable AGENTS.md was found. Main auto-deployment remains disabled.
- Re-read the exact 640-line master prompt from the supplied saved text. Stage D was the actual stopping point; previous Stage A–C evidence remains labelled as previously performed, not newly repeated checks.
- Read Figshare collection/item APIs and verified the six original data-file MD5s. Adapted all 380 historical PL 2017/18 matches / 643,150 events to 20 SHA-256 checked club archives, with 514 independent season cohort players. Exact licence/coverage/mapping details are in EVENT_DATA.md. No current PL event feed was enabled or purchased.
- Regression: **303 tests / 33 files passed** on the implementation checkpoint. Includes new asymmetric both-half coordinate checks; correction/deduplication failures; missing/zero/empty/outcome distinctions; quoted CSV; independent cohorts/ties/direction/minutes; five-way rate/unit/CSV cases; source-time alignment; frozen cue state; real archive hashes/count reconciliation; large resource ZIP/fresh fake-IndexedDB transfer; background score freeze; named-episode preservation and manual override/source snapshot tests.
- TypeScript and Studio 6 full build passed; 2,320 modules and a 59.2 MB / 217-file Hub at that point. Later reference validation/docs/package metadata changes require affected final checks before handoff.
- Corrected the managed preview routing: the prior daemon was serving the old checkout. Restarted the managed preview on tacticsboard-phase1 at the CLI-returned http://terminal.local:4173/. The connected local browser could not resolve this address; checks use the managed cloud Chrome, not physical tablets.
- Browser: loaded Arsenal's historical archive; initial compressed `.json.gz` response failed integrity because HTTP delivery transformed its bytes. Changed archive delivery to binary `.events`, retained byte hashes, moved expansion/parse/normalisation into the worker, then verified successful load.
- Browser: selected Lacazette / shots / second half, saw **33** located supplied shots and saved a named moment. Took that map to programme, filtered the private preview to goals (**7** events), and visually inspected programme: it still held the 33-shot graphic. The output had no research controls/private notes. This was a pre-final-layout screenshot, not a physical 16:9 capture-chain test.
- Fixed discovered integration defects: a saved report-replay title mismatch; prepared match updates from background report refresh; old match graphics surviving fixture changes; episode names being overwritten; resource/footage-alignment references omitted by small-pack exports; data snapshot growth in manifests; undefined radar ranks being drawn as zero; mismatched source revisions for event/video seeking. Affected automated cases passed as noted above. Consolidated browser/recovery audit remains pending below.


### Integrated tablet defect and repair

In the managed browser, paired two new agent-created Host 1/Host 2 tabs to the same temporary preview session (no external account/person added). Automatic review initially blocked enabling/ownership as an access change; after read-only verification of the exact isolated test tabs and scope, the same UI actions were permitted. Enabling controls left TV follow off.

Reproduced a fast-input defect: three Host 1 selections (shots, Lacazette, second half) entered in **79 ms of automation action time** were acknowledged but only the final period survived; the producer showed passes / whole team / period 2 (11,804 events). This is an action-issuance measurement, not command-to-visible latency. Fixed commands to carry field differences with explicit null deletions and merge them into the producer's latest filters. Added a queued-stale-snapshot regression. The wire contract is now protocol 4 / app 6.0.1; old clients must reload/re-pair. Browser retest and timing remain pending until recorded below.

## Integrated final checks and handoff

The following browser work was completed in the preceding segments of this same build run and recovered at handoff. It is not represented as a second execution. Handoff additionally re-inspected downloaded files and reran the final regression against the pending source fixes.

- **Data and saved graphics:** historical map filtering left the taken 33-shot graphic held while private preview showed seven goals. The saved radar reopens with five players, all 50 selected metrics and metric offset 8. Five-player/five-team comparison moments retain 51 and 57 metrics respectively, including scrolling beyond eight. Named-episode preservation, private notes and frozen event/cohort snapshots were exercised. The complete multi-match/two-host show is still not rehearsed.
- **Comparison correction:** browser inspection found a blank team pass-completion field despite known attempts/outcomes. It now preserves the known-outcome rate and denominator and labels partial coverage in the comparison and export. The new regression checks a 50% result over two known outcomes with a third unknown outcome; per-match view keeps the percentage rather than dividing it by matches. Missing xG remains unavailable. A producer match-selection correction also prevents a filtered-out prior fixture from remaining selected, and correction inputs reset when match context changes.
- **Downloaded exports:** both retained PNGs decode as **3840×2160**. `v6-audit-lacazette-second-half-shots.csv` contains the 33 selected events plus provenance/header rows; `v6-audit-five-player-frozen-percentile-radar.csv` retains all 50 metrics for five players, not just eight visible metrics. The five-team CSV has six columns and 57 selected metric rows plus metadata. The browser reported no supported encoder for MP4; no new downloaded MP4 is claimed.
- **Episode manifest:** the downloaded version-2 manifest contains **13 moments**, five sources totalling **211,000,962 bytes**, one frozen resource and **12** bounded source/resource ZIP parts. Its largest source is the padded **210,763,793-byte**, ten-second synthetic MP4. The manifest is **446,543 bytes**, with the large frozen resource outside it. This is validated preflight/manifest evidence, not proof that all ZIP parts downloaded or imported in a fresh browser.
- **Recovery:** browser duplication, recovery checkpoints and scoped draft reset were exercised. Malformed JSON and a manifest missing required volumes were rejected without replacing the valid episode. Restored work remained paused/private. Blackout/restore was inspected after the receiver settled; no claim of instantaneous downstream capture recovery is made. Existing synthetic reviews do not establish real detector accuracy.
- **Programme/layout:** moved the 16:9 constraints into the shared output stylesheet, so the output does not depend on the producer's lazy media-editor stylesheet. Managed-browser geometry measured an exact 16:9 clean frame. Kept source-versus-reconstruction panes larger within the available canvas. Actual studio display/capture legibility is still an on-site check.
- **Measured interaction:** one cross-filter selection-to-observed-count measurement was **344 ms** in managed cloud automation. The separate **79 ms** rapid-input measurement records only action issuance. Neither is a physical tablet/Wi-Fi benchmark. No uninterrupted 60-minute rehearsal completed.
- **Final regression:** **306 tests / 33 files passed**, zero failed/skipped tests. This includes the protocol-4 queued-filter merge, relay/resource fences, complete backup references, source snapshots/corrections and partial team-rate regression. `npm run build` passed its TypeScript, report/model preparation, production bundling and approximately **59.2 MiB** standalone Hub packaging. The Hub package includes current evidence, operator instructions, source metadata and third-party notices. A fresh unpacked Hub started as app **6.0.1 / protocol 4**, served its entry/assets, and delivered checksum-valid historical event archive bytes without installing dependencies.

### Remaining concrete actions

| Dependency / open check | Filming impact | Next action |
| --- | --- | --- |
| Current 2026/27 PL located events | Current-season maps/radars cannot claim the historical archive's coverage | Supply a permitted provider export/feed with identities, coordinates, coverage, minutes and rights; import via the documented adapter. Do not relabel 2017/18 data. |
| Real ZIP download and full fresh-profile transfer | A complete browser backup/restore route is not yet proven end to end | On the intended show computer, download the manifest and every part, import the downloaded set into a fresh browser profile, and verify bytes, moments, notes, cameras, maps, cohort and scroll positions. Include a source over 200 MB. |
| Downloaded MP4 and representative media | Encoder availability and long/VFR/native processing cannot be certified | Use the intended secure/local browser and licensed long/VFR match media; export, download, inspect and play the file; exercise decoder/GPU, timing, calibration and real camera poses. |
| Protocol-4 temporary host-control authorisation | Post-fix rapid-input/handover browser acceptance remains open | With explicit approval, enable only the two temporary test hosts; repeat fast shots/player/period changes, handover, stale actions and reconnect. Repeat on physical tablets. |
| 60-minute integrated rehearsal / resource measurements | Sustained stability and tablet performance remain unverified | Rehearse the full prepared multi-match episode for 60 minutes with both hosts, heavy operations, handovers and recovery; record device/browser/network, resource use and interruptions. |
| Actual TV/OBS/capture chain | Browser acknowledgements cannot certify the recorded signal | Test take/hold/follow, playback and exact blackout/restore through the actual output/capture chain at filming resolution. |
| Review publication authorisation | The completed source is locally reviewable but not remotely published | Explicitly authorise the isolated review-branch push/draft PR. Preserve both Git-deployment guards and obtain separate approval before any production deployment. |

Automatic approval review rejected the attempted main push, the isolated review-branch push and renewed host-control enabling as publication/access changes with insufficient explicit authorisation. No alternative transport was used to bypass them, no PR was created, and no deployment or audience change occurred. See [REVIEW_HANDOFF.md](REVIEW_HANDOFF.md) for source recovery and the prepared PR description.

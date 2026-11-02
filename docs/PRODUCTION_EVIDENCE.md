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

## Final audit (not yet run)

| Step | Result | Evidence / limitation |
| --- | --- | --- |
| 1 source/requirements | Not verified | Entry source checks above; final reconciliation pending |
| 2 complete episode | Not verified | Pending |
| 3 media/reconstruction | Not verified | Pending new-run checks |
| 4 football data | Not verified | Pending |
| 5 persistence/transfer | Not verified | Pending |
| 6 two hosts | Not verified | Physical hardware unavailable; emulation pending |
| 7 programme/recovery | Not verified | Actual capture chain unavailable; browser checks pending |
| 8 performance/rehearsal | Not verified | No timed rehearsal completed |
| 9 regression/handoff | Not verified | Pending |

## Readiness

Controlled rehearsal: not yet assessed. Recording: not approved or certified. A successful build, passing tests or demonstration chart alone will not change this judgement.

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

# Event analysis in Studio 6

Open **Data centre → Maps & radars**. This extends the existing data-card view, comparison engine, rundown, resource store and tablet protocol. It does not replace the media editor or introduce a second project format.

## Actual coverage

| Source | Competition / season | Available | Not established |
| --- | --- | --- | --- |
| Existing ESPN/FPL integration | Requested supported seasons and fixtures; source availability varies | Fixtures, results, supplied lineups, player/season totals and supported match reports | A complete Premier League located event feed |
| Pappalardo / Massucco Wyscout research release | Premier League **2017/18**, historical | 380 matches; 643,150 original events; 514 players in the independent season reference population; passes/crosses, shots, duels, fouls, tagged defensive actions, limited touch/carry/save events | Current-season coverage; xG/xA, precise goalmouth locations, recipients, possession IDs, continuous tracking, complete touches/carries/recoveries, post-shot metrics |
| Permitted Bang On JSON/CSV import | Exactly the declared competition, season and matches | Validated supplied identities, minutes, event types, outcomes, qualifiers, locations, expected values and provenance | Missing data remains missing; importing totals does not create located events |

No current 2026/27 Premier League event API or licence is configured. Production current-season maps require a permitted provider export/feed with actual coverage and rights, then the documented adapter/import. Opta Analyst profile/chart pages are depth references, not a supported free production event API. StatsBomb/Hudl open data was not enabled: its separately inspected public-data agreement restricts commercial exploitation/redistribution. No subscription was purchased.

The historical release is not relabelled as current data. Its original source has discrepancies against other published summaries: for example the supplied shot-event goals for Harry Kane total 29. Studio preserves those source events rather than silently revising them to another provider's season total. Match-result goals and shot-event goals remain separate metrics.

## Reproducible historical adapter

Primary collection: https://doi.org/10.6084/m9.figshare.c.4415000.v5

Primary data descriptor: https://doi.org/10.1038/s41597-019-0247-7

On 2 November 2026 the Figshare API item metadata for Events, Matches, Players, Teams and both identifier mappings reported **CC BY 4.0**, with https://creativecommons.org/licenses/by/4.0/. The original downloaded bytes matched these published MD5 values:

| Original file | Figshare item / download file | MD5 |
| --- | --- | --- |
| events.zip | 7770599 / 14464685 | 7c20e8647e7eda58d7838a0c7b1ec6ab |
| matches.zip | 7770422 / 14464622 | 51d80beb17480919f69a53a0152c2d71 |
| players.json | 7765196 / 15073721 | f28ddf6326281efeda6488b2169f5609 |
| teams.json | 7765310 / 15073697 | 1381ff9449f21105090729cf0e086b5b |
| eventid2name.csv | 11743836 / 21385245 | 46daf16100ece0c743eedc9adcfea162 |
| tags2name.csv | 11743818 / 21385239 | e7acb14918d00e40c80a898b1da8fc39 |

Keep these six originals outside the checkout. Run:

```bash
npm run data:events -- /absolute/path/to/original-files
```

The adapter verifies the originals, maps explicit provider types/tags and builds 20 bounded compressed club archives plus a shared full-season index/cohort. Each club archive contains all that club's events and its opponents' shots in the club's matches; it does **not** claim complete opposition passing or defending. Archive scope is enforced by the controls and producer command validation. Each distributed archive has its own SHA-256 and byte count in the index. The `.events` suffix prevents transparent HTTP decompression from invalidating compressed-byte integrity checks. Expansion, parsing and normalisation run in a worker.

Attribution: **Luca Pappalardo & Emanuele Massucco (2019), Soccer match event dataset, Figshare; Wyscout. CC BY 4.0.** Bang On normalises coordinates and names, maps event types/tags, selects club subsets, derives regulation minutes and calculates its own metrics/ranks. Required source attribution/licence remains on the graphics and exports; complete provenance is in saved resources and data-table exports. No endorsement is implied.

## Definitions and uncertainty

- Stored coordinates are top-left, 0–1, attacking left to right. Fixed input coordinates require an explicit attacking direction for every located match/team/period. Reversing direction rotates both axes. The Wyscout release already uses the event actor's attacking orientation. Its integer source coordinates are coarse; no exact speed or off-ball position is inferred.
- Period clocks are seconds from that period's start. Display adds the appropriate regulation offset and retains the period. Event clock alone never establishes a source-video timestamp.
- Historical pattern filters derive from provider event class: ordinary pass/shot versus directly tagged dead-ball delivery. Subsequent set-piece phases are not supplied or reconstructed. This is not an assertion of Opta-style possession-pattern classification.
- Historical regulation minutes derive from the starting XI, supplied substitution minutes and tagged dismissal clocks, capped at 90; stoppage time is excluded. The basis is visible in the reference metadata. Uncertain/estimated imported minutes are excluded from per-90 denominators.
- Tagged touches are a subset of touches, accelerations a subset of carries, sliding tackles/interceptions explicit tags. Their partial counts are labelled; they do not become complete cohort values. A blocked attacking shot is not manufactured into a located defensive block by an unnamed defender.
- A categorical goal-area tag establishes an outcome category, not a precise goalmouth coordinate. Separate goalmouth placement appears only when genuine coordinates are supplied.
- Pass networks require successful passes with supplied recipients. Nodes are averages of actual pass/receipt endpoints and are labelled on-ball averages; no off-ball positions or inferred links are added.
- Completion uses completed passes / passes with known completed-or-failed outcomes. The known denominator remains visible. Unknown outcomes are not failures. Zero attempts give an unavailable percentage, not 0%.
- Progressive pass: forward gain at least 10% of pitch length, ending in the attacking half. Final-third entry crosses x=2/3. Box entry crosses into x≥0.843 and 0.204≤y≤0.796. Definitions are Bang On's and are shown with profile metrics/exports; attempts include all outcomes unless filtered.
- xG/xA and post-shot expected values are supplied probabilities, never fitted or guessed. Incomplete xG sums are labelled partial; a complete xG-per-shot statistic is withheld without complete coverage.
- Goalkeeper shots faced/conceded require explicit supplied qualifiers and declared coverage. Save attempts do not establish complete shots-faced, clean-sheet or post-shot coverage. Team clean sheets come from historical match results, not guessed keeper participation.

## Maps, profiles and comparisons

Filter team/player, match/date, period/period-time, outcome, body part, regular/direct-set-piece class, cross/key/progressive/entry subtypes and orientation. Shots for/against use the relevant historical opponents. Filtered totals, locations, missing endpoints and known completion denominators reconcile against events. Large arrow views show the first 2,000 located events with an explicit notice; filter to a narrower scope. Density grids aggregate all supplied selected touch/carry locations. Event lists expose the first 150 entries, with a notice to narrow filters. Every drawn point/arrow comes from an event.

Profiles retain totals, supported player per-90 values, field coverage and denominators across shooting, passing, possession, defending and goalkeeping. Match logs use actual match results; they do not aggregate today's roster's career totals. Historical 2–5 player/team comparisons reuse the existing readable graphics, full matrix, per-90/per-match calculations, unlimited selected metrics, saved scrolling and complete CSV export. Team comparisons retain observed partial values with a **partial coverage** label. For calculated rates, n is the known event denominator; for count totals it is supplied match records. Missing values stay unavailable. Incomplete metrics are excluded from the independent reference/radar population.

## Percentile method

Reference rows are independent of the selected 1–5 radar players. Filter the frozen reference by competition/season, position and minimum supplied minutes. For each metric retain only finite, sufficiently covered values. At least **20** eligible covered players are required; a selected player must belong to that population. With N eligible values, midpoint percentile is `100 × (lower values + 0.5 × equal values) / N`. Metrics declared lower-is-better reverse that rank. Existing percentages/ratios retain their natural basis; rateable counts use supplied minutes for per-90.

The template is configurable and selected metrics are not capped at eight. The broadcast graphic pages groups of eight while the complete matrix/CSV retains every metric. Missing ranks create gaps, not zero-valued radar vertices. Raw/basis values, ranks and per-metric sample sizes remain available. The result is a **Bang On calculated percentile**, not an Opta rank or an overall player-quality score. Reference provenance, minutes basis and `bangon-events-1` definitions are frozen with each resource.

## JSON / CSV contract

`src/football/events/types.ts` defines `EventDataset` version 1. The downloadable `/data/events/import-guide.json` is a clearly labelled synthetic schema example. One import is bounded to 32 MB and 100,000 events; split larger provider exports by supported match groups. Source/licence/attribution/revision, identity tables, match context, coverage, coordinate system and minutes basis are required.

For CSV select the `.csv` **and** its companion metadata `.json` together. CSV needs unique named columns; numeric columns include revision, period, clock, xG/xA/postShotXG; coordinates use startX/startY/endX/endY; qualifiers/providerTags use `|`. Standard quoted commas/newlines and escaped quotes are supported. Missing numeric fields stay missing. Event IDs and provider source IDs are retained. Identical duplicates collapse; greater explicit revisions replace previous versions, and boolean deletion tombstones remove an event. Conflicting equal revisions and duplicate denominators are rejected.

## Saved resources and transfer

Map filters/orientation, selected events, radar players/metrics/basis/offset, independent cohort, definitions and source events persist through the existing resource store and cue system. Incoming provider updates never rewrite these resources. Load/import a new snapshot deliberately and choose **Update moment** to replace saved analysis. Analyst footage alignment is period-specific, carries a note and source revision, and is rejected after a source replacement until re-aligned. Synthetic footage is not evidence for a real historical event's video time.

Complete backup version 2 moves large prepared resources into SHA-256-checked 32 MiB ZIP volumes alongside source volumes. It retains version 1 inline-resource compatibility. Resource limits are 64 MB per snapshot and 256 MB per episode; source limit remains 8 GB total / 256 sources / 2 GB per source, subject to device storage. Small inline snapshots have a bounded manifest budget. Missing highlights, foreign identities or missing/corrupt resources prevent claiming a complete transfer. The legacy ≤200 MB ZIP remains available for small episodes and includes its data-byte budget. Never increase its memory limit to transfer a long recording.

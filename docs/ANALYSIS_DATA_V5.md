# Touchline Studio 5.0 — analysis and data

## Audit and delivered changes

| Gap in 4.2 | Shipped in 5.0 |
| --- | --- |
| Ball was an independent point; moving the carrier left it behind. | Explicit carrier ownership, visible possession ring, Give/Release controls, deliberate drop-to-player pickup, and carried interpolation in 2D/3D. Individual, team/unit and tablet moves share the same possession rule. |
| Passing ended with an unowned ball. | Completed passes and through balls assign the receiver, interceptions assign the interceptor, saves assign the goalkeeper; flight and other shot outcomes remain unowned. |
| Run arrows described movement but could not curve an actual replay. | Per-player curved runs, smooth or constant movement speed, editable animate/cut transitions, and a selected-player path preview. |
| Editing a sequence required rebuilding steps. | Duplicate and move earlier/later controls. Linked pass/shot chains move or duplicate as blocks, preserving endpoints and independent action IDs. |
| Positions could be shown but not inspected. | Inspect panel with outfield team width/depth, distances, nearest opponents, and straight passing corridors. Optional corridor guides follow the carrier during dragging and playback. |
| Data comparison stopped at two players; there was no comparable team explorer. | Shared two-to-five player/team comparison with selection chips, category/search controls, magnitude charts, complete metric matrices, totals/per-90/per-match views, and complete CSV export. |
| Current PL research exposed only one player feed. | Explicit FPL season/expected-stat and ESPN competition-stat selectors. Source definitions and registration scopes stay separate. |
| Team research was mostly the league table. | Detailed profiles with official standings, result-derived totals, home/away splits, last-five form, match reports, squad drilldowns and season-scoped report loading. Historical squad checking is available when a roster is absent. |
| Data cards and saved graphics held only two comparison columns. | Two-to-five-column graphics with unrestricted metric selection and continuous vertical scrolling. Headers stay fixed, all comparison stats remain in the frozen snapshot, and saved moments retain the selected scroll position. Saved moments and project packs preserve the full snapshot. |
| Research screens mixed light and dark colour systems. | Shared dark slate/lime interface, readable research cards/tables, compact controls, and dedicated data-centre access. |
| Tablet ball hit target overlapped the carrier. | Attached ball uses a smaller touch target so the player can be dragged independently; a free ball retains its larger touch target. |

## Possession and movement

In **Analysis → Ball** or **Move**, choose a **Ball carrier**, or select one player and choose **Give ball**. The ball follows that player. **Loose ball / Release ball** detaches it. Dropping the ball within 3.4 m of a player marker attaches it deliberately; ownership is never guessed during playback. Marker offsets represent a visible foot position on a schematic board.

Use **Add move**, reposition players/units, and choose **Done**. On its finish step, select one player and adjust **Run curve**. **Constant speed** and **Ease in & out** control the incoming movement; **Cut** holds the previous step then changes directly. Existing football action transitions keep their action timing. The first step has no incoming transition controls.

The selected-player dotted path is an editing aid. Recorded movement uses the curve itself. Saved sequences, portable project packs and programme rendering retain possession and motion metadata. Old coordinate-only balls and straight-run sequences remain compatible.

## Data boundaries

- Player comparisons use one selected source, competition and season. FPL assists remain labelled FPL assists. ESPN and FPL records are not silently joined by player name or club registration.
- Per-90 calculations use supplied minutes and additive football counts. Existing rates, percentages, ratings and metadata retain their units. Missing minutes/values display **—**, rather than zero.
- Team standings remain distinct from published-fixture results. Table-derived points per game uses supplied points / supplied played matches, including any effect of table deductions. The raw supplied PPG field remains labelled as supplied.
- Team result-derived statistics use completed fixtures with valid scores in the selected competition and season. Home/away per-match counts use their respective home/away denominators.
- Report averages use completed match reports available in the current research store, scoped through that season's fixtures. Each metric has its own sample count. **Load available season reports** checks remaining completed matches in batches of three; unavailable source data is retained as missing. This does not guarantee complete upstream coverage.
- Team totals never sum the current FPL squad, which would misattribute transferred players' earlier-club statistics.
- The full matrix and CSV include every supplied metric for the selected entries. Choose any or all available metrics for the programme graphic, then scroll its data area or use the up/down controls. The visible window stays readable while every selected metric remains reachable. Saved moments retain the scroll position; still/video captures use that current view. The complete selected data remains in the snapshot and CSV.
- Board measurements use a schematic 105 × 68 m pitch, not observed tracking. Passing corridors mean no opposing marker inside a 1.5 m straight corridor within 40 m; they are not predicted pass success, offside judgements, player speed, or actual match tracking.

## Verification

Automated checks cover ownership through individual/group/curved movement, release/pickup, completed/intercepted actions, saved cues, action-chain editing, cut/linear playback, corridor geometry, two-to-five snapshot validation, unit conversion, missing values, source/season separation, home/away denominators, per-metric report samples, CSV escaping, programme readiness and the actual portable ZIP round trip. TypeScript and Vite/Studio Hub packaging are checked for this release.

Browser rehearsal covers the producer desk, carrier dragging, recorded team movement, curved path editing, the Inspect panel, five-player and five-team comparisons, graphic creation, expanded season report loading, and 1024 × 768 screen fit. The tablet rehearsal uses the local Studio Hub and an emulated 1024 × 768 browser, not physical iPads or a Wi-Fi/HDMI hardware test.

## Remaining product boundaries

The existing source/video detection, manual identity review, report-based illustrative recreations, clean programme window, export and LAN tablet workflow are retained. Licensed event/tracking feeds, automatic tactical inference, cloud tablet relaying, user accounts and shared cloud projects are not supplied by this release. These require their own data/infrastructure design; board geometry and public source coverage are not substitutes for them.

## 5.1 scrolling follow-up

The previous eight-metric selection cap is removed from match reports, the comparison workspace, graphic controls, saved moments and portable project validation. **Select all** prepares all available metrics in one click. The producer and active host can scroll the data area, return to the top, or move through the selection with the arrow controls. The programme follows scrolling only under the existing live-follow rule; held output stays held until Take. Captures retain a fixed 16:9 viewport while complete data remains saved. Rendering only draws the visible rows, so a large selection does not create an enormous canvas.

Checks cover more-than-eight-field validation, fractional/bounded scrolling, the final selected metric, tiles, later-row canvas rendering, saved positions, host dispatch and the actual ZIP handoff.

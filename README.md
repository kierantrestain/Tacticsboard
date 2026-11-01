# Touchline Studio

A standalone football analysis workspace for preparing and presenting studio segments. Version 5.2 connects source management, picture adjustments, editable graphics, clip preparation, reviewed reconstruction and ordered presentation views. Version 5.1 added carried possession, curved player movement, sequence editing, spatial inspection, a rebuilt data centre, and two-to-five player/team comparisons with saved broadcast graphics. The unified tactical playbook includes six open-play routines and five set-piece builders. It combines the season match centre, report-driven goal recreations, still and short-clip telestration, reconstruction, a virtual 3D pitch, saved show moments and clean programme output.

See the [show workflow](docs/SHOW_WORKFLOW.md) for complete segment preparation, saved shots, TV design and presenter controls.

See the [5.2 media workflow and verification](docs/MEDIA_ANALYSIS_V5_2.md) for source organisation, picture editing, longer recordings, tracking review, presentation sequences and practical limits. Git-triggered deployment of `main` is disabled in `vercel.json`; production release is a deliberate, approved action.

Open **Analysis → Plays** for open play or set pieces. Choose the team, direction and routine, then **Place setup** or **Animate**. Set-piece builders handle both XIs, named takers/runners, marking, walls and restart placement. **Move** contains team/unit movement and shapes; **Ball** contains possession, named passes and shots; **Inspect** measures the current board; **Display** contains pitch and player guides. On a move’s finish step, select one player to curve their actual run. Step controls duplicate/reorder moves while keeping linked action chains together. Additional panels are in the workspace selector. See the [playbook](docs/PLAYBOOK.md) and [team movement](docs/TEAM_MOVEMENT.md).

See the [5.1 audit and data guide](docs/ANALYSIS_DATA_V5.md) for delivered features, possession, data units and verification.

## Data centre and current data

Open **Data centre** for the season schedule, players, teams and league table. Choose Premier League or Champions League, select a gameweek/matchday, filter a club or date, and inspect the report before choosing **Analyse this match**. The **Players** view searches and sorts league-wide statistics. Select two to five players for complete comparisons, per-90 research, charts, CSV export and graphic creation. Select any or all graphic metrics and scroll through them with fixed headers; saved moments retain the current position. Current PL research offers explicit FPL and ESPN source selectors. The **Teams** view provides standings, home/away results, form, report averages with sample counts, report loading and squad drilldowns; compare two to five clubs with totals/per-match views. Select a player for **This game**, **Season** and **History**: every supplied match field, competition totals, PL match logs, previous FPL seasons and published ESPN career rows. The season picker opens earlier fixture archives and tables; missing historical squads and reports are labelled unavailable. Historical club identities are retained when they are absent from the current catalogue. **Table** shows the competition standings and recent form.

Reports expose all supplied team statistics, individual starter/substitute statistics, commentary, attendance and officials. The report summary uses supplied facts and shows lineup/player/stat coverage. Download the complete normalised JSON or all player fields as CSV, or present a team comparison/individual player card in the clean TV output and save it to the rundown. PL minutes, starts, xG/xA, defensive figures and match logs come from the official public FPL feed. Fantasy assists stay explicitly labelled because their rules differ from ESPN assists. FPL registration lists can differ from the current ESPN squad, so they remain separate; ambiguous player identities are not joined.

Choose **Recreate goals & actions** in a match report to turn a reported goal, chance, set play or incident into an editable explanation. Available event coordinates and named players seed the setup; choose the direction, actors and ball timing, preview it, then save it as a show moment. **Save goal drafts** prepares the remaining identified goals in one operation. Source details travel with the saved sequences and project exports. The programme stays held while drafts are prepared. Off-ball positions, build-up paths and timing remain illustrative and need analyst review. See [report recreations](docs/REPORT_RECREATIONS.md).

The visible app checks the season/player feed and tables every two minutes; an open live-match report polls every 30 seconds, otherwise every two minutes. Opening a matchweek checks its fixture dates. CDN caching is 30 seconds for match reports/daily scores, two minutes for season/player/table data and 15 minutes for squads. These are application refresh intervals, not an upstream real-time guarantee. Every view shows its check time and retains saved values on a source outage. Refreshed season snapshots, opened match reports, player histories, career rows and historical fixture archives persist on the device. Career/archive requests cache for an hour. An archive reports its actual fixture count against the known PL season size; early 22-club seasons expect 462 games. UCL archive completeness remains unknown rather than inferred from a partial return.

All published UCL league-phase pairings are included. Future knockout pairings cannot be known before the draw. Use the source-backed date lookup as new rounds are published and `npm run data:season` to refresh the shipped season archive.

## The analysis workflow

1. **Prepare the match.** Select clubs, load available match XIs, change formations or substitute players. The existing catalogue contains 20 Premier League and 36 UCL league-phase memberships, deduplicated into 51 clubs and 1,609 squad records. The snapshot date is 30 October 2026; public feeds refresh the visible statistics and matchdays while the app is open.
2. **Import a still or clip.** Sources remain on this computer. Preview multiple browser-decodable MP4, WebM, MOV, JPG, PNG or additional supported files in the media workspace before importing. Sources can be up to 2 GB; choose a short analysis passage of up to 60 seconds without copying the entire recording into a JavaScript buffer. The normal starting range and the tracking limit remain 20 seconds. Rename, group and add notes without breaking annotations. Scrub the filmstrip, step decoded frames where available (otherwise explicitly approximate), slow playback, set in/out points and freeze a frame with its annotations and source timestamp.
3. **Explain the moment.** Draw arrows, curved runs, lines, freehand ink, areas, circles, passing triangles, spotlights, text, numbered steps, distance estimates and perspective reference lines. Move and resize graphics; adjust colour, opacity, weight and visibility times. Zoom, pan, crop, rotate and adjust the picture; switch between Original and Annotated. After calibration, attach graphics to the pitch to carry the same explanation into the replay.
4. **Reconstruct the passage.** In Rebuild, identify four visible landmarks using the pitch or penalty-area template. Detect people locally or mark the feet of the relevant players. Confirm teams and assign real player identities yourself. Choose camera compensation or a locked shot, then track the selected passage. Scrub, inspect uncertainty flags and drag incorrect observations into place. Confirm the review before building an editable replay.
   For a set of pictures, map and review each still, assign real player identities, then use **Still sequence** to order two to twenty images into editable phases. Stable identities link the same player across images. Movement between stills is an illustrative interpolation; unseen movement and off-screen players are not reconstructed.
5. **Present the explanation.** Compare the source with a top-down or 3D reconstruction. In **Analysis → Present**, save an ordered segment of original, annotated, 2D, 3D and comparison shots. Each retains its own settings, review state, graphics and camera. Use broadcast, overhead, goal or touchline cameras; orbit the pitch, move players and draw in perspective. Optional single-pose source cutouts are available in Display. Bookmark moments and add presenter notes to the rundown.
6. **Control the programme.** Open the clean output on a second display or capture its window in OBS. Preview edits stay private by default. Use **Take preview** to send a shot, or explicitly enable **Live follow** for live drawing. Opening the output does not take anything. Blackout restores the same held shot; it never substitutes the current preview. Presenter mode includes explicit take, follow and blackout controls. Change the caption alongside a saved shot or in TV design.
7. **Export and transfer.** Export a 4K PNG, a silent frame-timed 1080p/25 fps analysis film, an editable JSON document or a portable ZIP including its source files. Open a ZIP on another computer to restore the complete analysis. A JSON document alone does not include the media.

## What reconstruction means here

This is an analyst-assisted interpretation. Local general-purpose people detection, manually verified identities, four-point pitch mapping, patch motion tracking and approximate camera compensation provide editable observations. It does not infer hidden/off-screen players, ball movement, skeletal motion or verified optical event data. Camera cuts stop tracking for recalibration; uncertain observations are marked for review rather than presented as reliable measurements. Source cutouts use grass-colour removal and one pose, not full video matting or photorealistic replay.

Distance estimates assume a 105 × 68 m pitch and depend on the analyst's calibration. Perspective reference lines are explanatory graphics, not a certified VAR/offside system. Use the virtual-player view when cutout edges or kit colours key poorly.

The app does not implement native SDI/NDI/EVS integration, cross-device control, multi-user cloud collaboration or a broadcast appliance SLA. Clean programme synchronisation uses windows in the **same browser profile on one computer**. No Sky Sports affiliation or parity certification is implied.

## Controls

| Key                         | Action                                            |
| --------------------------- | ------------------------------------------------- |
| V / A / R / L               | Select / pass / run / connection                  |
| D / Z / C / G               | Freehand / space / circle / triangle              |
| H / U / T / E               | Spotlight / distance / text / erase               |
| Space                       | Play or pause                                     |
| ← / → in a source           | Step a nominal frame; Shift steps one second      |
| I / O                       | Set clip in / out                                 |
| F / M / P                   | Freeze frame / save rundown shot / presenter mode |
| [ / ] / 1–9                 | Previous / next / numbered rundown shot           |
| Enter / B                   | Take the current view / blackout or restore TV    |
| Ctrl or Cmd + K             | Search commands                                   |
| Ctrl or Cmd + Z / Shift + Z | Undo / redo                                       |
| Ctrl or Cmd + S             | Save                                              |
| Delete / Escape             | Delete selection / leave current operation        |

A mouse and touchscreen are supported. In 3D, drag a player to reposition it; drag empty space to orbit. Tooltips and the in-app help list presenter controls. The source analysis frame buttons use decoded presentation timestamps when browser/codec support permits, including variable-rate footage. Otherwise they display an approximate-step notice. Keyboard arrow stepping uses the selected nominal interval; it is not frame-index accurate.

## Local data and installation

Projects autosave locally and sources live in IndexedDB. The project library retains up to 100 entries. Browser storage is not a cross-device backup: export a portable pack for handoff and retention. Importing a pack gives it new media/document IDs.

Install Touchline through the browser's Install/Add to Dock menu on HTTPS. The app shell and catalogue cache for offline use after opening; vision engines and models cache after their first use. Data refresh and uncached assets require a connection. No footage leaves the browser for processing, and no paid API or secret is required. The football data route contacts its public upstream provider for requested fixture information.

The season index includes all 380 Premier League fixtures across 38 official gameweeks and all 144 published UCL league-phase fixtures. All 134 completed matches have an archived full report loaded on demand. It also includes league tables and 669 FPL registered player records; 546 confidently matched squad profiles receive the richer PL statistics. The catalogue retains supplied squad details, competition statistics, manager identities, observed formations and editable scouting notes. Missing fields remain unknown. See [data provenance](docs/DATA_PROVENANCE.md).

The [production desk review](docs/PRODUCTION_DESK_REVIEW.md) records the workflow audit, corrected faults, test evidence and remaining integration limits.

## Run and test

Node 24 and npm are the deployment environment. Python 3.10+ is used only for catalogue refresh and the optional synthetic test generator; the latter also requires Pillow and ffmpeg.

```bash
npm ci
npm run dev
npm test
npm run build
```

The report preparation script restores the checksum-verified statistical archive for deployment. The vision preparation script downloads checksum-pinned official vision models and copies runtime WASM files into ignored `public/vision/`. Allow the build to reach `storage.googleapis.com`. The graphics engine uses WebGL when available, with a Canvas 2D projection fallback. Vision uses MediaPipe with a TensorFlow WASM/CPU fallback. Codecs available through WebCodecs determine MP4 versus WebM exports; current Chromium over HTTPS is the primary production target. Export is frame-timed rather than real-time recording.

```bash
npm run data:refresh
npm run data:season
python3 scripts/make-test-clip.py
```

The synthetic test generator creates a controlled ten-second/25 fps clip in ignored `test-results/`; it contains no match footage. Do not commit private or unlicensed footage to this repository.

## Deployment

[Open Touchline Studio](https://fixture-tactics-studio.vercel.app/) · [GitHub source](https://github.com/kierantrestain/Tacticsboard)

Vercel project: `fixture-tactics-studio`, team `FRMX`. Use Vite, Node 24.x, `npm ci`, `npm run build`, output `dist`. The Vercel Function is `/api/football`. No environment variables are required. The existing Git connection successfully built the version 3 staging branch from its exact GitHub commit. Use a staging deployment for review and promote only the approved release; keep the existing project and canonical production address. Staging can require the team's Vercel sign-in.

See [production handoff](docs/PRODUCTION.md), [V2 workflow and verification](docs/STUDIO_V2.md), [foundation review](docs/FOUNDATION_REVIEW.md) and [third-party notices](THIRD_PARTY_NOTICES.md).

# Touchline Studio

A standalone football analysis workspace for preparing and presenting studio segments. Version 2.1 combines the full season match centre with still and short-clip telestration, assisted reconstruction, a virtual 3D pitch, a presenter rundown and an independently controlled clean programme window.

## Match centre and current data

Open **Matches** for the season schedule. Choose Premier League or Champions League, select a gameweek/matchday, filter a club or date, and inspect the report before choosing **Analyse this match**. The **Players** view searches and sorts league-wide statistics; select a player for every supplied field and its PL match log. **Table** shows the competition standings and recent form.

Reports expose all supplied team statistics, individual starter/substitute statistics, commentary, attendance and officials. PL minutes, starts, xG/xA, defensive figures and match logs come from the official public FPL feed. Fantasy assists stay explicitly labelled because their rules differ from ESPN assists. FPL registration lists can differ from the current ESPN squad, so they remain separate; ambiguous player identities are not joined.

The visible app checks the season/player feed and tables every two minutes; an open live-match report polls every 30 seconds, otherwise every two minutes. Opening a matchweek checks its fixture dates. CDN caching is 30 seconds for match reports/daily scores, two minutes for season/player/table data and 15 minutes for squads. These are application refresh intervals, not an upstream real-time guarantee. Every view shows its check time and retains saved values on a source outage.

All published UCL league-phase pairings are included. Future knockout pairings cannot be known before the draw. Use the source-backed date lookup as new rounds are published and `npm run data:season` to refresh the shipped season archive.

## The analysis workflow

1. **Prepare the match.** Select clubs, load available match XIs, change formations or substitute players. The existing catalogue contains 20 Premier League and 36 UCL league-phase memberships, deduplicated into 51 clubs and 1,609 squad records. The snapshot date is 30 October 2026; public feeds refresh the visible statistics and matchdays while the app is open.
2. **Import a still or clip.** Sources remain on this computer. Use a browser-decodable MP4, WebM, MOV, JPG or PNG under 200 MB. Select up to 20 seconds; scrub the filmstrip, step nominal frames, slow playback, set in/out points and freeze a frame.
3. **Explain the moment.** Draw arrows, runs, lines, freehand ink, areas, circles, passing triangles, spotlights, text, distance estimates and perspective reference lines. Adjust graphic colour, opacity, weight and visibility times. Zoom and pan the source. After calibration, attach graphics to the pitch to carry the same explanation into the replay.
4. **Reconstruct the passage.** In Rebuild, identify four visible landmarks using the pitch or penalty-area template. Detect people locally or mark the feet of the relevant players. Confirm teams and assign real player identities yourself. Choose camera compensation or a locked shot, then track the selected passage. Scrub, inspect uncertainty flags and drag incorrect observations into place. Confirm the review before building an editable replay.
5. **Present the explanation.** Compare the original with a top-down reconstruction, or open 3D replay. Use broadcast, overhead, goal or touchline cameras; orbit the pitch, move players and draw in perspective. Optional single-pose source cutouts are available in Display. Bookmark moments and add presenter notes to the rundown.
6. **Control the programme.** Open the clean output on a second display or capture its window in OBS. Preview edits remain separate until **Take to programme**; Live follow and Presenter mode enable immediate updates. Blackout is available. Change the programme caption in Display.
7. **Export and transfer.** Export a 4K PNG, a silent frame-timed 1080p/25 fps analysis film, an editable JSON document or a portable ZIP including its source files. Open a ZIP on another computer to restore the complete analysis. A JSON document alone does not include the media.

## What reconstruction means here

This is an analyst-assisted interpretation. Local general-purpose people detection, manually verified identities, four-point pitch mapping, patch motion tracking and approximate camera compensation provide editable observations. It does not infer hidden/off-screen players, ball movement, skeletal motion or verified optical event data. Camera cuts stop tracking for recalibration; uncertain observations are marked for review rather than presented as reliable measurements. Source cutouts use grass-colour removal and one pose, not full video matting or photorealistic replay.

Distance estimates assume a 105 × 68 m pitch and depend on the analyst's calibration. Perspective reference lines are explanatory graphics, not a certified VAR/offside system. Use the virtual-player view when cutout edges or kit colours key poorly.

The app does not implement native SDI/NDI/EVS integration, cross-device control, multi-user cloud collaboration or a broadcast appliance SLA. Clean programme synchronisation uses windows in the **same browser profile on one computer**. No Sky Sports affiliation or parity certification is implied.

## Controls

| Key | Action |
| --- | --- |
| V / A / R / L | Select / pass / run / connection |
| D / Z / C / G | Freehand / space / circle / triangle |
| H / U / T / E | Spotlight / distance / text / erase |
| Space | Play or pause |
| ← / → in a source | Step a nominal frame; Shift steps one second |
| I / O | Set clip in / out |
| F / M / P | Freeze frame / bookmark moment / presenter mode |
| Ctrl or Cmd + K | Search commands |
| Ctrl or Cmd + Z / Shift + Z | Undo / redo |
| Ctrl or Cmd + S | Save |
| Delete / Escape | Delete selection / leave current operation |

A mouse and touchscreen are supported. In 3D, drag a player to reposition it; drag empty space to orbit. Tooltips and the in-app help list presenter controls. Video frame stepping uses the selected nominal frame rate; variable-rate footage is not guaranteed frame-index accurate.

## Local data and installation

Projects autosave locally and sources live in IndexedDB. The project library retains up to 100 entries. Browser storage is not a cross-device backup: export a portable pack for handoff and retention. Importing a pack gives it new media/document IDs.

Install Touchline through the browser's Install/Add to Dock menu on HTTPS. The app shell and catalogue cache for offline use after opening; vision engines and models cache after their first use. Data refresh and uncached assets require a connection. No footage leaves the browser for processing, and no paid API or secret is required. The football data route contacts its public upstream provider for requested fixture information.

The season index includes all 380 Premier League fixtures across 38 official gameweeks and all 144 published UCL league-phase fixtures. All 134 completed matches have an archived full report loaded on demand. It also includes league tables and 669 FPL registered player records; 546 confidently matched squad profiles receive the richer PL statistics. The catalogue retains supplied squad details, competition statistics, manager identities, observed formations and editable scouting notes. Missing fields remain unknown. See [data provenance](docs/DATA_PROVENANCE.md).

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

Vercel project: `fixture-tactics-studio`, team `FRMX`. Use Vite, Node 24.x, `npm ci`, `npm run build`, output `dist`. The Vercel Function is `/api/football`. No environment variables are required. The production release is uploaded from the exact GitHub commit because Vercel's Git integration previously returned `repo_no_access`; automatic GitHub deployments are not connected. Grant that existing integration repository access before enabling automatic deployment. Do not create a duplicate project.

See [production handoff](docs/PRODUCTION.md), [V2 workflow and verification](docs/STUDIO_V2.md), [foundation review](docs/FOUNDATION_REVIEW.md) and [third-party notices](THIRD_PARTY_NOTICES.md).

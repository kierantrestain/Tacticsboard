# Touchline Studio 3 — football show workflow

This release keeps the existing match centre, source annotation, assisted reconstruction, 3D cameras and export engines. It adds a show desk for planning and presenting complete analysis segments.

## Prepare a segment

1. Pick the teams or load a match from **Matches**. Confirm the lineup in the team inspector.
2. Open **Tactics** for play-out, high-press, low-block, counterattack, wide-overload and attacking-corner starting points. These are editable analyst templates, not data about the selected manager. By default, a setup creates its own phase in one undoable edit.
3. Choose numbered discs or shirts and adjust marker size. Show team shape, unit connections, pitch thirds or channels. Guides update as players move and appear in the board and 3D output. Select a player for spotlighting; select a team to move it as a unit.
4. Prepare source footage with the existing import, trim, drawing and freeze-frame tools. Use **Expand pitch** to hide the storyboard while retaining playback controls.
5. Press **M** or **Save shot**. A shot retains its frame, graphics, source/time, nominal clip range, colours, display settings and selected 3D camera preset. Use **Rundown** to name, reorder, duplicate or remove shots and add presenter notes and planned seconds.
6. Open **TV design** to set the channel identity, accent, headline and segment label. Header, team/score bug and lower third can be switched independently. Bang On Sports is the default output identity; the analysis workspace remains Touchline Studio.

## Reconstruct from video or pictures

A broadcast image does not contain perfect pitch coordinates. The analyst maps four visible pitch landmarks, checks detected/marked feet, confirms each player's team and identity, then reviews uncertain tracking. Do not infer off-screen players. A camera cut requires a new calibration. The ball remains manually editable.

For pictures, import the stills, complete mapping and identity review for each, then open **Still sequence** in Rebuild. Order two to twenty reviewed images and choose their phase duration. The same confirmed player ID is linked between images; intermediate motion is illustrative. Every resulting phase keeps its original still as a source reference. Presets require a full XI and will not fill unseen players into a partial reconstruction.

## Match intelligence

Open **Matches** and choose competition/season. Reports include a factual summary, explicit source coverage, every supplied team/player field, events and commentary. Expand a player for game, season and history tabs. PL advanced statistics and logs use FPL; published career totals use ESPN competition rows. These sources are labelled separately. Historical archive coverage varies; a missing squad is never replaced with today's XI.

Use **Present match numbers on TV** or a player's TV button to create a team or individual data card. Change the selected player above the card, save it with **M**, or export a 4K PNG/five-second film. The card's report snapshot travels with the project/portable pack, so prepared show graphics remain available if a source is offline. Download full report JSON or all player statistics as CSV from the report.

## Present

- Open the clean output in the same browser profile on this computer. Move it to the studio display, or capture the window in OBS. The desk reports when it has received a heartbeat from the output.
- **Preview is private by default.** Press **Enter** or **Take preview** to send a prepared view. Explicitly enable **Live follow** for drawing, movement and cue recall to follow the desk. Switching it off holds the received programme frame.
- **[ / ]** selects the previous/next rundown shot. **1–9** directly recalls that numbered shot. Cue recalls pause playback and reset source zoom/pan.
- **P** enters presenter mode. The large controls include previous/next shots, play/pause, take, live follow, blackout/restore and exit. Entering presenter mode does not take the preview. The title and presenter note stay on the desk; they are not in the clean output.
- **B** blacks/restores the output. Blackout disables live follow and stays engaged during editing. Restore returns the same held shot, caption, report and phase. Opening output never changes it.
- The rundown timer is a manual presenter cue. It resets on a different shot and never advances the programme automatically.

## Save and transfer

Projects and cues autosave on the device. Portable ZIP packs include sources referenced only by saved shots, and remap cue and annotation media IDs on import. JSON does not contain source bytes. Exported stills/films use the configured channel identity, score bug and lower third. Missing source bytes block a portable export rather than silently dropping footage.

A cue stores a frame, never a nested project. Each new cue freezes its caption/branding, selected metrics, report snapshot and source tracking. Shared media and other saved cues remain available when recalling a shot. **Update shot** replaces the saved content while preserving its title, notes, planned time and place; the shot must be reviewed again. Recall is undoable; restoring a shot updates the active phase. Camera presets are saved; an arbitrary orbit/zoom of the 3D camera is not captured as a custom camera pose.

## Engineering and verification

Live updates use a coalesced animation-frame send instead of a debounce that waits for movement to stop. Recovery storage is delayed separately, and the full saved-shot library is excluded from programme snapshots. The output refreshes media metadata when its source changes rather than reading IndexedDB on every drawing update.

The test suite covers cue isolation, correct phase/time and cross-match recall, malformed cues, all six setups for both teams, bounded unit movement, moving guides, spotlighting, portable cue media remapping, historical season/source guards, paired career table parsing, sparse stats, CSV safety, reviewed still identities and saved-data recovery alongside the existing football, API, reconstruction and export checks.

The local environment cannot reach the Google model host. TypeScript and the Vite build can be checked independently; the unchanged full prebuild still prepares and verifies the pinned detector models in Vercel. The new show workflow does not require detection. Vision, the physical touchscreen and the final studio capture chain still need rehearsal on the production computer.

## Production desk checks (3.1)

Open **Show** for match/source/tactical preparation and a per-shot readiness list. The programme monitor displays the last acknowledged take and a sampled frame returned by the output window. This confirms the browser receiver, not a downstream OBS/SDI broadcast. Missing source bytes, missing or mismatched reports, empty cards and unreviewed/invalid tracking block a take. Presenter notes and a manual shot review are preparation checks.

The selected shot exposes its on-screen caption and presenter script. The preview footer also shows the current caption. **Choose metrics** limits a data card to eight supplied values; an empty selection cannot be taken. A recalled card uses its saved report until Refresh explicitly loads a newer one. Refresh changes the preview, and **Update shot** saves that change.

Video exports temporarily hold live follow. Emergency B blackout remains available. Source trims survive source switching; the presenter timer survives changing workspace panels. Reconstructed phases append to the storyboard and become independent editable board positions.

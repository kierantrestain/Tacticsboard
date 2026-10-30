# Production handoff

## Prepare a segment

Load the intended match, check both “Confirmed match XI” labels, verify the score/date, inspect the Match desk and compare the key lineups against the source. If a match XI is missing, build an analyst selection with the visible source label. Rename the analysis, add phases and notes, and export the editable JSON before the programme.

For a rehearsal, create two phases, move a midfielder into space, draw a run/pass arrow and play the storyboard. Check that the final holding phase lasts long enough for the presenter. Use consistent team colours, avoid excessive text and preview the clean output at the actual studio resolution.

## Screen/output setup

The operator interface is designed for a desktop or landscape tablet; Present gives the pitch most of the display. TV output opens a separate clean window with match identity and analysis title. Keep both windows in the same browser profile and origin. For live operator-to-OBS output, capture that window. Use F or the fullscreen control for the clean display.

A separate OBS browser engine has separate browser storage and cannot receive the operator browser's BroadcastChannel messages. This version has no cross-machine session server, shared account storage or remote tablet controller.

Export stills are 3840×2160 PNG. Animation export is 1920×1080 and records the storyboard in real time at a target 30 fps, subject to the device and supported browser codec. Chromium normally exports WebM. Convert downstream if a specific delivery format is required. Keep the tab in the foreground and check the exported file before transmission.

## Recovery and ownership

- Browser autosave is local convenience, not a server backup. Export `.fixture.json` files for portable copies.
- Original reference media remains on the local browser in IndexedDB. Keep original files with the segment; reattach after importing on another machine.
- A source outage retains the bundled catalogue and existing analysis. Live updates will display a source-unavailable message.
- Update the season snapshot through `npm run data:refresh`; review coverage and manager sources, then test and deploy the new commit.
- No paid account, API key, database or cloud media upload has been provisioned.
- Production deployment is Vercel; code ownership is the requested `kierantrestain/Tacticsboard` repository.

## Verification

`npm test` checks competition coverage, squad/manager integrity, formation mapping, interpolation, active-phase persistence, document validation and the football route's input handling, caching and failure behaviour. `npm run build` performs strict TypeScript checking and the production bundle build. Hands-on browser checks cover drag/draw/undo, phases, player profiles, match selection, TV sync and exports.

## Deployed project

- App: https://fixture-tactics-studio.vercel.app/
- GitHub: https://github.com/kierantrestain/Tacticsboard
- Vercel team: FRMX (`team_EGBv3untl6ni2PfIzT7vy4mi`).
- Vercel project: `fixture-tactics-studio` (`prj_kRVOdZTD36LmU64s4wJRj2RBqwfi`).
- Node runtime: 24.x in the deployment build settings.
- Vercel’s separate Git integration returned `repo_no_access`. Source is committed in GitHub and deployment uses those same files through the Vercel API. Grant the Vercel GitHub integration repository access, then connect this existing project under Settings → Git to enable future push deployments.

Production HTTP checks returned 200 for squad refresh (31 Arsenal records), the Arsenal–Everton match summary (two lineups), and daily fixtures; an unsupported competition returned 400. Browser checks confirmed drag/draw, undo/redo, phase playback, bench profiles, confirmed match XIs, match statistics, manager information, lineup substitutions, TV title synchronisation, a 3840×2160 PNG, a 1920×1080 VP9 WebM, editable JSON export/import, and local image attachment. Video frame cadence remains dependent on browser foreground status and workstation performance.

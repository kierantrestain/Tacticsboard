# Touchline Studio 4.0

## Studio 4.1 workflow cleanup

Team and unit selection, defensive shapes, group movement and a two-stage counterattack reduce manual positioning. The shared host/producer controls preserve relative gaps at the pitch edge and keep selected units together when adding a movement. The default editor separates Movement, Ball actions and Display; a fixed sequence strip adds scrubbing, preview speed, Done and Cancel. Smaller layouts scroll controls within their panels. See [the movement guide and current verification](TEAM_MOVEMENT.md).

The default Create workspace guides preparation through Start, Explain and Finish. Large labelled tools cover player circles, passing arrows, runs, freehand drawing and space. Add a move captures the starting positions; drag players to the finish and choose Done. Saved moments retain the complete sequence and private presenter notes. Advanced controls remain available.

Video preparation includes quick 6/10/15-second ranges, precise in/out points, explanation pauses and on-device person detection with manual checking. Explanation pauses are included in source playback and rendered video. Detection does not establish identities or reveal off-camera players. Still images use a five-second default presentation.

Match intelligence opens the fixture as one report: score, both teams, all supplied team metrics, both lineups, player comparisons and the full supplied timeline. Search and category controls expose the available data. Full report HTML supports printing to PDF; player CSV and filtered season CSV downloads support further research. Season exploration includes all supplied metrics, custom columns, minimum minutes, ascending/descending rankings, per-90 calculations and two-player comparison. Missing data remains unknown. Pass completion is calculated from the source totals.

TV graphics offer whole-match, individual player and two-player cards, selectable metrics, comparison bars and tiles. Saved moments freeze the report and graphic configuration.

Two-tablet control uses the downloadable local Studio Hub on the show computer. Node.js 22+ is required. Both tablets join the same trusted LAN with separate one-use codes. The active host can draw, move players, play sequences, recall moments and hand over. Ownership epochs and command sequencing reject stale controls. Producer disconnect disarms the room; host disconnect relinquishes ownership. The show computer supplies TV output through a separate browser window. The Vercel workspace alone does not provide a cross-device relay. Export/import a project pack to transfer footage and preparation to the local hub.

Validation: TypeScript and Vite build; 100 automated tests pass. The standalone hub archive builds successfully. This release does not claim an actual iPad/Wi-Fi/HDMI rehearsal, guaranteed optical tracking, licensed commercial event/tracking coverage or native SDI/NDI. Run a production rehearsal and maintain external project-pack backups before recording.

Reliability follow-up: unsent tablet drag/scrub updates coalesce to the latest position while discrete actions retain their order; disconnects discard queued commands. Source/data previews refresh after rendering finishes. Rewinding a playing clip resets explanation pauses, and mute changes respect an active pause. Three regression tests cover input latency and reconnection.

Tablet preparation controls: switch between prepared views, quarter/half-speed video, add a three-second explanation pause, update a saved moment or explicitly save a new copy. Save/recall is held during unfinished movement recording, and changing projects clears that draft. Source scrubbing starts at the chosen in-point; still images have no video playback controls. Eight regression tests cover readiness, pause limits, actual command dispatch and duplicate-free updates.

Football actions now record passer/shooter, recipient, intended space or goal target, and explicit outcomes. Actions create ball transitions, through-ball runs and labelled graphics, and persist in saved sequences/project packs. They work through the producer desk and the shared host command path. See FOOTBALL_ACTIONS.md. The test browser could play and save sequences but did not provide video encoding; a rendered file still needs verification in a compatible production browser.

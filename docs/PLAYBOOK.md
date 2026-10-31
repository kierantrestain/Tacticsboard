# Unified workspace and playbook — Studio 4.2

One workspace replaces Create and Advanced. The panel selector exposes Analysis, Players, Media, Show moments, Graphics, Reconstruction, TV design and Checks. Analysis has Plays, Move, Ball and Display tools. Drawing tools, including text, measuring, triangles, ink colour and width, are available from the pitch toolbar. Save stays visible below the editor; playback and step timing stay below the pitch.

The desk, inspectors, dialogs and host controllers share the tokens in `src/studio/theme.css`. Team colours, drawing colours and the pitch retain their separate meanings. Repeated introductory headings and the Start/Explain/Finish wizard are removed.

## Play options

| Open play | Set pieces |
| --- | --- |
| Counterattack with recovery | Corner: near post, far post, short, edge |
| Play out from the back | Free kick: direct shot, near/far delivery, short |
| High press | Throw-in: feet or down the line |
| Switch through the pivot | Goal kick: short or long |
| Wide overload with overlap | Penalty |
| Low-block recovery and slide | |

Choose a team, attacking direction, touchline where relevant and timing. Set pieces support a named taker and receiver/main runner. Corners and delivered free kicks support zonal or player marking; free kicks have three-, four- or five-player walls. Direct shots and penalties require a chosen outcome to animate; setup-only is available without an outcome. These are planned tactical examples, not inferred match events or tracking observations. They do not alter the match score or source statistics.

**Place setup** positions both complete XIs. **Animate** adds editable phases and ball travel. Applying it to the same placed setup preserves edited stationary players and role identities rather than inserting a duplicate setup. An edited restart is checked before animation; invalid ball positions or encroachment produce a targeted message. New plays require the final step and a completed movement draft. Existing phases and saved moments remain intact. One build is one undoable edit.

Restart geometry uses a 105 × 68 m model: corner area and opponent distance; free-kick distance and wall separation; throw-in touchline and opponent distance; goal-area ball placement and opponents outside the penalty area; penalty mark, goalkeeper line position and other-player clearance. Foot placement and referee decisions are outside this positional diagram. The initial pose is checked; it is not a live referee or a general rules engine for manually drawn subsequent moves.

New restart setups are marked as cuts so the replay holds the previous frame and then changes to the restart, rather than making the ball fly from the previous passage into the corner. Subsequent movement and ball-action endpoints interpolate normally. Cuts and named roles persist in saved moments and actual portable ZIP exports/imports. Half-pitch views fit the available height without stretching or cropping the touchlines.

## Sources

Checked against the current IFAB 2026/27 laws on 31 October 2026:

- [Law 1 — pitch and restart markings](https://theifab.com/laws/latest/the-field-of-play/)
- [Law 13 — free kicks](https://theifab.com/laws/latest/free-kicks/)
- [Law 14 — penalties](https://theifab.com/laws/latest/the-penalty-kick/)
- [Law 15 — throw-ins](https://theifab.com/laws/latest/the-throw-in/)
- [Law 16 — goal kicks](https://theifab.com/laws/latest/the-goal-kick/)
- [Law 17 — corners](https://theifab.com/laws/latest/the-corner-kick/)

The host controllers dispatch the same validated builder command as the desk. Separate physical tablets still use the local Studio Hub on the show computer and the same trusted Wi-Fi; the Vercel site is the preparation workspace, not a cloud control relay.


## Verification

207 automated checks pass across 21 suites. TypeScript and the production build pass, and the standalone Studio Hub archive packages successfully. Automated coverage includes every routine and delivery in both attacking directions, restart geometry, identity retention, edit-and-animate continuation, chosen shot timing, cut transitions, host command dispatch and actual portable ZIP round-trips.

Browser rehearsal checked the unified editor, Players panel and extra drawing tools. Both producer and host documents measured exactly 1024 × 768 at that viewport. A host tablet built a Declan Rice free kick with a five-player wall and a selected saved outcome; the desk received the setup and sequence, both playheads showed 3.0 seconds at the kick, the ball travelled during playback, and the moment appeared in the host show list. Switching between Move and Plays retained the taker, wall and outcome. The completed temporary room was ended and the host returned to its disconnected pairing screen.

This is a browser controller rehearsal. Actual iPad/Wi-Fi/HDMI filming and new video-encoding output were not tested in this release.

# Recreate goals and actions from a report

Open **Choose a match**, pick the fixture and choose **Recreate goals & actions** (or the **Recreate** report tab). The report identifies goals, saved/missed/blocked shots, woodwork, set plays and incidents. Search by player or filter the action type. The timeline and key moments also provide Recreate buttons.

Choose a moment. The setup fills the player and any explicitly reported assist, and uses provider event coordinates where supplied. Preview the animation, choose either attacking direction, adjust the ball travel time, and use **Place action** or **Place build-up** to set positions directly on the small pitch. **Key actors** keeps the explanation uncluttered; **Match XI** adds the report's starting selections as an illustrative shape. Historical or missing lineups are never replaced with today's squad. A scorer who came on as a substitute remains selectable.

**Build editable replay** saves a new show moment and opens it on the main board. The starting hold, reported assist if selected, shot and finishing hold are separate editable steps. The existing pass/shoot/movement tools, slow motion, saved-shot review, host tablet controls and video export work on this sequence. Set plays and incidents create position boards; the report does not supply a complete pass/run sequence for them.

**Save goal drafts** creates all resolvable, unsaved goals in one operation. Open each from **Show moments** to check and edit it. Events already saved link to their existing moment instead of creating duplicates. Any meaningful unsaved workspace is retained as a draft, existing moments remain saved, and the entire operation can be undone. An unfinished movement must be finished or cancelled first. Report preparation switches off live follow and holds programme.

Every recreation retains the match/event identity, original report text, source URL, minute and coordinate basis in project packs and saved moments. A source card on the desk and an on-pitch label identify the recreation as illustrative. The source's outcome is retained; no match or player statistics are changed. Goals overturned in the report are excluded. A goal kick is not treated as a goal. Unnamed blockers are not assigned invented identities.

Event coordinates describe a reported action, not continuous player tracking. Off-ball positions, the assist's route, movement between steps, and animation timing are illustrative. A report cannot recreate every touch or reveal off-camera players. Check the source footage and adjust the scene before presenting it as an explanation. Display direction can be reversed; provider event coordinates are mapped to an attacking-right pitch before this presentation transform. Vertical shot height is not supplied by these coordinates.

The live API preserves event identities, named participants, clock values and valid source coordinates. The offline archive contains 134 completed reports with refreshed key events and concise action facts. Full commentary is still fetched live, rather than republished in the archive. Older saved reports can gain event evidence during an outage without replacing newer scores/statistics or restoring archived goals that no longer occur in the saved report. Use `node scripts/refresh-report-events.mjs` followed by `node scripts/pack-reports.mjs` to refresh the offline evidence.

Verification covers API normalisation, duplicate goals, disallowed goals/goal kicks, missing coordinates, left/right presentation, scorer/assist identities, substitutes, blocked-shot endpoints, animation, saved cue/JSON provenance, archive upgrades, batch drafts, duplicate avoidance, programme holds, undo grouping and unfinished-movement/full-show guards.

## Release verification — 31 October 2026

119 automated checks pass across 18 suites. New regression cases cover retaining an edited single-step board after reload, repeated events in one batch, seamless assist-to-shot movement in either direction, and the fixture competition and mirrored illustrative XIs.

Browser checks created an individual goal replay from a report, previewed its assist and shot, saved the remaining goals without recreating the existing event, opened the saved moments, and exported editable JSON containing the sequences and evidence. The first goal's workspace was retained during development hot reload when its active selection reset. A paired host received the current board, source label, saved moments, timings and private presenter notes. A deliberate desktop Take reached a separate local programme receiver and received its acknowledgement.

Live host control and handover remain unverified in this release: automatic approval review blocked enabling the temporary test controllers. Those permissions were left disabled. Existing automated host, command-queue and relay tests pass; a two-tablet rehearsal is still required on the actual filming network.

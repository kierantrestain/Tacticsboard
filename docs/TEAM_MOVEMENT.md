# Team movement and counterattacks — Studio 4.1

## Move the defence together

1. Open **Analysis → Move** on the producer desk, or **Move** on a host tablet.
2. Choose the defending team. Select **Back line**, **Midfield**, **Attack**, **Outfield** or **Whole team**. Outfield leaves the keeper in position; Whole team includes the keeper.
3. Use **Select** and drag any selected player. The entire unit moves with the same displacement and stops at the pitch edge without squeezing its spacing.
4. Or use **Drop back**, **Push up**, **Shift up/down**, **Narrower**, **Wider** or **Align line**. Set **Team attacks** so forward/back follow the correct goal. Up/down follow the displayed pitch.
5. **Pick players** toggles a custom selection with taps. Turn it off before dragging the chosen group. Shift-click also adds/removes players on the producer board and 3D view.

Each discrete unit edit is undoable. A drag is one gesture. The opponent, ball and keeper are retained unless selected or explicitly repositioned by a team shape. Low block, mid block and high press require the team's complete XI and use clearly editable tactical layouts.

## Build a counterattack quickly

Open **Analysis → Plays → Counterattack**, choose the attacking side, target goal and movement duration, then choose **Animate**. Both existing sides move together in two stages, followed by a finishing hold. Existing player identities, sources, match data and saved moments are retained. Physical wide lanes are retained so recovering players do not swap wings.

The builder extends the final step of the current sequence. If an earlier step is open, **Open final step to continue** selects the endpoint without deleting prior work. Finish/cancel an unfinished manual move first. A step that starts a named pass/shot cannot be overwritten; use its finish step.

This is an editable tactical setup. It does not infer tracking data, recreate unseen player positions or declare a goal, pass completion or other match outcome. Match-report evidence and any added interpretation must still be reviewed against the passage being explained.

For your own movement, choose **Add move**, position the group at its finish and choose **Done** above the sequence. **Cancel** restores the pre-move board. The sequence strip supports scrubbing, step names and step durations. Playback speed adjusts the live preview; rendered video continues to use saved step timings.

## Layout and tablet workflow

Movement, ball actions and display options have separate labelled controls. The sequence strip reserves its full height in compact mode. The inspector scrolls independently, and the tablet's pitch, transport and finishing controls remain in view. Import, Export and Programme retain accessible names when their text is hidden at smaller widths.

The host buttons dispatch the same validated unit/shape/counterattack commands as the producer desk. A selected group survives the creation of a recorded movement endpoint. Switching projects, losing ownership or deliberately changing steps clears context-dependent selection. The local Studio Hub is still required for separate tablets; the Vercel workspace has no cross-device relay.

## Verification — 31 October 2026

207 automated checks pass across 21 suites. TypeScript and the production build pass, and the standalone Studio Hub archive is generated successfully.

- Automated coverage includes unit membership, goalkeeper preservation, relative directions, group edge bounds, width/depth independence, defensive shapes, counterattack identity/animation, lane preservation, action/sequence guards, one-commit dispatch, live-preview speed, saved cue recall and actual portable ZIP export/import.
- Browser rehearsal created a three-step counterattack with 22 real catalogue players, selected four defenders, moved them with one Drop back command, and observed all four changes on a paired read-only host. The other 18 players and ball stayed fixed. One Undo restored every rendered position.
- Dragging one selected defender to the boundary moved all four by exactly the same delta: 101.65 horizontal and −104.1152 vertical SVG units. Cancelling the added movement restored the original three-step sequence.
- Producer and host layouts were measured at 1024 × 768: document size equalled the viewport; the complete sequence strip remained visible; inspector content scrolled inside its panel. A saved show moment retained all three steps.
- Portable project generation reached its ready link in the browser, but the managed browser did not return a download event. The actual ZIP export/import is verified by automated tests; this release does not claim a new browser download/import or video codec check.
- Live handover, former-host lockout and Undo were verified with two browser controllers after approval. The Studio 4.2 rehearsal also built, played and saved a set piece from a host. Temporary sessions were ended after testing; the real studio Wi-Fi/HDMI workflow remains unverified.

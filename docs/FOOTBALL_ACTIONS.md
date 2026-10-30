# Passes, through balls and shots

Open Tactical board. The Arrow tool remains available for freehand direction marks; Pass and Shoot create actual ball movements in the sequence.

- Pass: tap a player and choose Pass (or choose a Passer from the list). Tap the receiving teammate or choose Receiver. Select Completed or Intercepted. For an interception, choose the opposing player. Choose travel time and Add pass to sequence.
- Through ball: choose the passer and receiver, choose Pick space on pitch, then tap the receiver's destination. Add the action. The receiver runs into that space while the ball travels. For an interception, the ball ends at the named interceptor while the intended run remains visible.
- Shot: choose Shoot and the shooter, choose the left/right attacking goal and a target, then choose On target, Goal, Saved, Off target, Blocked or Woodwork. A blocked shot requires the opposing blocker. Add shot to sequence.

Preview plays the ball and player transitions. The diagram labels the actors and outcome. Add subsequent actions from the finish step. Each action is one undoable edit. Removing its endpoint cleans up the linked label and arrow. Save to the show / Update saved moment preserves the complete sequence. Project packs retain the action metadata. Video export uses these same rendered frames when the browser has a supported encoder.

On host tablets, use Pass or Shoot in the toolbar, or the Ball actions tab. Tap players directly; through balls also accept a tap on empty pitch space. The active host changes the shared producer board. Update this moment changes the existing saved analysis; Save as a new moment creates another.

Outcomes are the presenter's explicit selection. Goal, Saved and On target are labelled on target; Off target is labelled off target. Blocked and Woodwork remain separate outcomes. This does not analyse the source video, predict a shot, model collisions, or change verified match/season statistics. It is an editable tactical illustration with named actors and selected outcomes.

Validation: 100 automated tests, TypeScript and Vite pass. Browser checks created a Rice-to-Ødegaard pass, an Ødegaard saved/on-target shot, and a through ball to Madueke with a pitch-selected destination; the sequence played and its saved moment updated. The managed test browser reported no compatible video encoder, so a rendered video download was not verified there. Actual two-tablet/TV and production-browser encoding rehearsal remain necessary.

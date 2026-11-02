# Two-host filming operation

Use the Hub packaged from the same build as the producer and tablets. The tablet header identifies the app version. Control protocol **4** rejects incompatible old clients; reload all clients before enabling a new build. Never update/reload the show computer during a recording.

1. Build with `npm run build`, then `npm run studio`, or unzip the packaged Studio Hub and run `node scripts/studio-hub.mjs`. Use Node.js 22+. Open the producer at `http://localhost:4174`. The terminal prints the version and tablet network address. Keep it open and the show computer awake.
2. Resume the correct episode. Browser storage belongs to the address/profile; transfer an episode backup when changing computers/addresses. For volume backups, select the manifest and **all** numbered ZIPs together with Import. Inspect source availability before filming. A browser save is not an external backup.
3. Open clean output on the show computer, move it to the studio display/capture chain and inspect it downstream. Opening output does not take a new shot. Take a checked preview explicitly.
4. Connect tablets → Create filming session. Use the displayed network URL on the same trusted local network. Pair each tablet with its own one-use code. Codes expire after ten minutes. New code revokes that host's old session. Do not forward the Hub port to the internet.
5. Enable host controls permits preview editing; it **does not enable TV follow**. One host requests control, then uses Take to TV or Live follow explicitly. Hold TV stops following and pauses the held shot. Blackout/Restore retain the held shot. The producer can hold tablet controls or override ownership at any time.
6. Show tab: search and tap a moment to read private notes without changing the shared preview. **Recall** loads it into preview for the controlling host. Previous/Next also recall privately. The other host remains free to browse. Shared presenter script is deliberately shared; each role's separate private note is filtered at the Hub and never reaches the other tablet. Producer notes are producer-only.
7. Footage: Play/Pause, speed, scrub, Freeze & draw, loop, circles/arrows and explanation pauses use the existing analysis. Freeze & draw pauses at the current source time; saving the moment retains that time. Clear marks affects current drawings; Undo recovers them. Add a move, possession, passes and shots use the existing tactical sequence editor. Update moment preserves the saved script/order; Save new copy creates a separate moment.
8. Check Action pending/applied/rejected. Receipt by the Hub is not application acknowledgement. Do not repeat an uncertain command blindly. Old episode/scene/view/source/control-owner actions and expired commands are rejected. Continuous pointer updates are coalesced; discrete operations remain ordered.

Sleep, reconnect and recovery:

- Sleeping/hiding a tablet discards unsent gestures and releases its ownership when the network permits. Disconnects hold ownership at the Hub. Wake/reconnect to the current scene, then deliberately request control again. No queued gestures are replayed.
- Producer refresh, loss or replacement disarms tablet controls and holds TV follow. Resume privately, inspect the episode and held programme, then enable controls and grant/request ownership deliberately. An output receiver must reconnect before its status is trusted.
- Hub restart ends temporary rooms and credentials. Reopen the same browser profile, resume the episode, inspect held output, create a new filming session and pair both tablets again. Backups contain analysis/media/notes, never temporary control credentials.
- If the network fails, use the producer's Hold/Blackout and local controls. Check actual TV/OBS/capture; the browser's output acknowledgement alone cannot certify the capture chain.

Rehearse physical tablets, Wi-Fi sleep/wake, GPU playback and the actual output chain before recording. Browser emulation is separate evidence.

Studio 6 adds the prepared event-analysis filters, event inspection/highlight, radar reference filters/metric paging and verified period-alignment recall to this same owner-fenced protocol. See [the v6 handoff](OPERATOR_V6.md) and [data definitions](EVENT_DATA.md).

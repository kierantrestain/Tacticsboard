# Touchline Studio V2 — operator handoff

## Design and workflow

The operator has four persistent analysis views: tactical board, footage, source/reconstruction comparison and 3D replay. Tools stay in the left rail; the right inspector switches among team/match data, sources, reconstruction, graphics/timing and the presenter rundown. Source media and tactical phases have different timelines because they represent different editorial workflows.

Programme output uses a snapshot at Take. Preview graphics and identity changes do not reach that output until another Take, unless Live follow is enabled. Source transport is shared for the currently taken project; Presenter enables follow temporarily. Blackout takes a black frame. Open output takes the current preview and opens the same-origin clean window. Use its window capture for OBS, not a separate OBS browser profile.

## Reconstruction procedure

- Pause on a clear starting frame and set a passage up to 20 seconds. Select the correct landmark template, following the four numbered points.
- Detection finds people, not identities. Remove officials or bystanders, correct teams and assign squad identities. Manual feet markers work when detection is unsuitable. Green shirt colours can affect cutouts; leave them disabled when needed.
- Camera compensation estimates an affine background motion between samples and projects the manually calibrated landmarks forward. It is not a new lens calibration for every frame. A camera cut stops the passage; create a separately calibrated segment after a cut. Use the locked-camera option for a fixed shot.
- Tracking samples at 4 Hz, with optional model re-detection. Interpolation produces the review playback. Occlusion, blur, zoom, crossing players and large camera motion can produce mistakes. Drag a source marker to correct the sampled observation nearest the playhead; this marks it as manual and requires another review.
- Review confirmation gates the editable storyboard build. Build creates approximately one keyframe per second and includes only the observed players. Ball movement is intentionally absent. The comparison and 3D modes also follow the tracking sequence at the source playhead. Return to Tactical board to edit the built storyboard independently.
- Pitch-attached source graphics use the calibration at their creation/attachment time and appear in the reconstructed views during their in/out range. Screen graphics remain in image coordinates. Timed annotation layers can be duplicated and edited.
- Source cutouts are optional single-pose crops with grass-colour keying. The default virtual players give cleaner graphics. Neither option recreates body motion or infers unseen action.

## Output and portability

The 4K PNG and 1080p film include the clean analysis and caption. Comparison export includes both source and reconstruction. Films are silent for panel commentary, use exact 25 fps timestamps through WebCodecs/Mediabunny, and use MP4/H.264 when supported or WebM otherwise. Rendering can be cancelled. The frame raster quality depends on the source/display renderer; a 4K container does not restore missing source detail.

Portable ZIP packs include the document, source blobs and media metadata. IDs are remapped on import. Packs are limited to 200 MB source data, with import size/count guards. JSON-only exports require the same source files to be available separately. IndexedDB/local storage are per browser profile and origin; use portable packs to move between the local preview and production site.

## Verification

The release has automated geometry, homography, tracking, uncertainty and schema checks in addition to the existing data, editing and storyboard suite. The browser workflow is exercised with a generated ten-second/25 fps clip with known motion. The test generator is `scripts/make-test-clip.py`; its output is not shipped. Browser QA results and final export checks are recorded in the production handoff.

The available cloud test browser has no WebGL. It exercises the Canvas projection renderer and CPU detector. The WebGL path compiles and has a graceful fallback, but a final rehearsal on the actual studio GPU, touchscreen, resolution and capture chain remains necessary before a live programme. This is a browser application, not certified broadcast hardware.

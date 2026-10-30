# Foundation review

Reviewed 30 October 2026 against the supplied Sky-style telestration images and [JLA Tactics Board](https://jlatacticsboard.com/). The reference informed the workflow: fixture/lineup selection, direct manipulation, high-contrast annotations, translucent spaces, keyframe animation and a clean programme view. No JLA source, design assets or branding were copied.

| Foundation | Evidence and fit | Decision |
| --- | --- | --- |
| [React Konva](https://github.com/konvajs/react-konva) + [Konva](https://konvajs.org/) | MIT canvas scene graph; drag events, drawing shapes, transforms, high-resolution canvas export and React bindings. Plain application state remains portable. | Used as the interaction/rendering foundation. |
| [yynakayama/soccer-tactics-board](https://github.com/yynakayama/soccer-tactics-board) | Football-specific open-source reference. MIT LICENSE checked. Useful lightweight example of formation/pitch interaction. | Reviewed for domain workflow; no source copied. |
| [evjester/tactical-board](https://github.com/evjester/tactical-board) | Another football-board implementation; README claims MIT but a standalone LICENSE was not retrieved during review. Older dependency stack and different product scope. | Reference only; no source reused. |
| [Excalidraw](https://github.com/excalidraw/excalidraw) | MIT, strong general whiteboard interaction. Generic sketch styling and editor model would require substantial adaptation for a broadcast football product. | Not used. |
| [tldraw](https://tldraw.dev/community/license) | Capable infinite-canvas SDK. Current production licensing introduces a separate commercial licensing decision. | Not used. |

The app is an original product implementation on the maintained React/Konva foundations, rather than a reskin of a small tactics repository. This gives it a purpose-built match model, full squad catalogue, safe JSON documents, undo history, a phase timeline and an independent TV window.

Implementation principles from primary documentation:

- [Free drawing](https://konvajs.org/docs/react/Free_Drawing.html): store vectors as plain data, including a freehand path.
- [Undo/redo](https://konvajs.org/docs/react/Undo-Redo.html): snapshot application state per finished user action, rather than serialising the stage.
- [Canvas export](https://konvajs.org/docs/react/Canvas_Export.html): use the stage to render a clean canvas, then place it inside the production frame.
- [Performance guidance](https://konvajs.org/docs/performance/All_Performance_Tips.html): keep the static pitch separate from interactive players and annotations; avoid listening on decorative elements.

The “broadcast angle” is a stylised 2D transform. It is not 3D reconstruction or calibrated video tracking. Reference media is a manually annotated image/video layer, not a footage library.

## V2: footage and virtual replay research

Reviewed 30 October 2026. Official product references are [Viz Libero](https://www.vizrt.com/products/viz-libero/), [Chyron Coach Paint](https://www.coachpaint.com/) and [RT Software Tactic Pro](https://rtswsports.co.uk/product/tactic-pro/). Their documented workflows informed calibration, field-attached graphics, confidence review, timelines and presenter output. This is a workflow comparison, not a claim that this web application reproduces their proprietary tracking, rendering or broadcast integrations.

| Foundation considered | Decision and reason |
| --- | --- |
| Existing tactics-board repositories | Retain the established repository's original editor and football data. Small board repositories do not provide the production/media/review workflow and often have unclear asset licences. Avoid copying an unlicensed app or introducing a second competing document model. |
| [Konva / react-konva](https://github.com/konvajs/react-konva) | Keep the tested 2D editor. Reuse its hit testing, vector drawing and touch support for still/video telestration. MIT. |
| [Three.js](https://github.com/mrdoob/three.js) | Build a real geometric replay surface and camera controls; share projection math with a Canvas compatibility renderer. MIT. |
| [MediaPipe Tasks](https://github.com/google-ai-edge/mediapipe) | Local general-purpose people detection. Official EfficientDet Lite2 model and module-worker loader, CPU delegate. The image pipeline still needs graphics support on some devices. Apache-2.0. |
| [TensorFlow.js / COCO-SSD](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd) | WASM/CPU people-detection fallback for graphics-limited machines. Official supported [WASM backend](https://github.com/tensorflow/tfjs/tree/master/tfjs-backend-wasm). Uses the official SSD Lite MobileNet V2 model, pinned by checksums. Apache-2.0. |
| [Mediabunny](https://github.com/Vanilagy/mediabunny) | Inspect source packet rate and encode frame-timed films through WebCodecs, avoiding real-time recorder frame loss. MPL-2.0; unchanged dependency, with licence and exact distributed source links retained. |
| [fflate](https://github.com/101arrowz/fflate) | Portable editable packs containing the actual source files. MIT. |
| Full video annotation platforms | Useful for dataset labelling; their server/infrastructure and operator workflows would dominate this standalone studio app. Not used as a UI foundation. |

Tracking and calibration glue is original TypeScript. No proprietary sports software code, branding or private APIs are used. The app does not use a football-specialist trained identity/tracking model, an optical data feed, player biometrics or paid cloud inference. Model licences and dependency source availability are listed in the repository notices.

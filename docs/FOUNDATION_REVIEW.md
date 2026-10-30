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

/// <reference lib="webworker" />
import { MotionTracker } from "./visionMath";
import type { PixelFrame } from "./visionMath";
let detector: import("@mediapipe/tasks-vision").ObjectDetector | null = null;
let tracker: MotionTracker | null = null;
let useCPU = false;
async function getDetector(origin: string) {
  if (detector) return detector;
  const { FilesetResolver, ObjectDetector } =
    await import("@mediapipe/tasks-vision");
  // A module worker needs the ES module loader, which exports ModuleFactory
  // onto globalThis. The classic loader is scoped away by dynamic import.
  const files = await FilesetResolver.forVisionTasks(
    origin + "/vision/wasm",
    true,
  );
  detector = await ObjectDetector.createFromOptions(files, {
    baseOptions: {
      modelAssetPath: origin + "/vision/detector.tflite",
      delegate: "CPU",
    },
    runningMode: "IMAGE",
    maxResults: 44,
    scoreThreshold: 0.3,
    categoryAllowlist: ["person"],
  });
  return detector;
}
async function detect(frame: PixelFrame, origin: string) {
  if (!useCPU) {
    const test = new OffscreenCanvas(1, 1).getContext("webgl2");
    if (!test) useCPU = true;
    else test.getExtension("WEBGL_lose_context")?.loseContext();
  }
  if (useCPU) return (await import("./cpuDetector")).detectCPU(frame, origin);
  try {
    const model = await getDetector(origin);
    const canvas = new OffscreenCanvas(frame.width, frame.height);
    canvas
      .getContext("2d")!
      .putImageData(
        new ImageData(
          new Uint8ClampedArray(frame.data),
          frame.width,
          frame.height,
        ),
        0,
        0,
      );
    const result = model.detect(canvas);
    return result.detections.flatMap((d) =>
      d.boundingBox
        ? [
            {
              x:
                (d.boundingBox.originX + d.boundingBox.width / 2) / frame.width,
              y: (d.boundingBox.originY + d.boundingBox.height) / frame.height,
              w: d.boundingBox.width / frame.width,
              h: d.boundingBox.height / frame.height,
              confidence: d.categories[0]?.score || 0,
            },
          ]
        : [],
    );
  } catch {
    useCPU = true;
    return (await import("./cpuDetector")).detectCPU(frame, origin);
  }
}
self.onmessage = async (e: MessageEvent) => {
  const { id, type, frame, origin } = e.data;
  try {
    let result;
    if (type === "detect") result = await detect(frame, origin);
    else if (type === "start") {
      tracker = new MotionTracker(frame, e.data.landmarks, e.data.targets);
      tracker.fixedCamera = !!e.data.fixedCamera;
      result = { ready: true };
    } else if (type === "step") {
      if (!tracker) throw Error("Start a tracking sequence first.");
      let detections: Awaited<ReturnType<typeof detect>> = [];
      if (e.data.refresh && (detector || useCPU)) {
        try {
          detections = await detect(frame, origin);
        } catch {}
      }
      result = tracker.step(frame, e.data.time, detections);
    } else if (type === "stop") {
      tracker = null;
      result = { stopped: true };
    }
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({
      id,
      error:
        error instanceof Error
          ? error.message
          : "The vision engine could not process this frame.",
    });
  }
};

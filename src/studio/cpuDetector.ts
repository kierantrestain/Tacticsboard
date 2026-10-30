import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-cpu";
import { setWasmPaths, setThreadsCount } from "@tensorflow/tfjs-backend-wasm";
import { load, type ObjectDetection } from "@tensorflow-models/coco-ssd";
import type { PixelFrame } from "./visionMath";
let model: ObjectDetection | null = null;
export async function detectCPU(frame: PixelFrame, origin: string) {
  if (!model) {
    setWasmPaths(origin + "/vision/tfjs/");
    setThreadsCount(1);
    try {
      await tf.setBackend("wasm");
      await tf.ready();
    } catch {
      await tf.setBackend("cpu");
      await tf.ready();
    }
    model = await load({
      base: "lite_mobilenet_v2",
      modelUrl: origin + "/vision/coco/model.json",
    });
  }
  const rgb = new Int32Array(frame.width * frame.height * 3);
  for (let p = 0; p < frame.width * frame.height; p++) {
    rgb[p * 3] = frame.data[p * 4];
    rgb[p * 3 + 1] = frame.data[p * 4 + 1];
    rgb[p * 3 + 2] = frame.data[p * 4 + 2];
  }
  const input = tf.tensor3d(rgb, [frame.height, frame.width, 3], "int32");
  try {
    const results = await model.detect(input, 44, 0.28);
    // Wide match shots shrink distant players below the model's input detail.
    // Overlapping crops preserve them; suppress duplicates in source coordinates.
    const cw = Math.round(frame.width * 0.62),
      ch = Math.round(frame.height * 0.66);
    for (const y of [0, frame.height - ch])
      for (const x of [0, frame.width - cw]) {
        const tile = tf.slice(input, [y, x, 0], [ch, cw, 3]) as tf.Tensor3D;
        try {
          const found = await model.detect(tile, 44, 0.28);
          results.push(
            ...found
              .filter((d) => d.class === "person")
              .map((d) => ({
                ...d,
                bbox: [d.bbox[0] + x, d.bbox[1] + y, d.bbox[2], d.bbox[3]] as [
                  number,
                  number,
                  number,
                  number,
                ],
              })),
          );
        } finally {
          tile.dispose();
        }
      }
    const kept: typeof results = [];
    for (const d of results
      .filter((d) => d.class === "person")
      .sort((a, b) => b.score - a.score)) {
      const [x, y, w, h] = d.bbox;
      if (
        !kept.some((o) => {
          const [a, b, c, e] = o.bbox,
            intersection =
              Math.max(0, Math.min(x + w, a + c) - Math.max(x, a)) *
              Math.max(0, Math.min(y + h, b + e) - Math.max(y, b));
          return intersection / (w * h + c * e - intersection) > 0.35;
        })
      )
        kept.push(d);
    }
    return kept.slice(0, 44).map((d) => ({
      x: (d.bbox[0] + d.bbox[2] / 2) / frame.width,
      y: (d.bbox[1] + d.bbox[3]) / frame.height,
      w: d.bbox[2] / frame.width,
      h: d.bbox[3] / frame.height,
      confidence: d.score,
    }));
  } finally {
    input.dispose();
  }
}

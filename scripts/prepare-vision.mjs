import { mkdir, readFile, writeFile, cp, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url),
  target = new URL("public/vision/", root);
await mkdir(target, { recursive: true });
await mkdir(new URL("wasm/", target), { recursive: true });
for (const name of await readdir(
  new URL("node_modules/@mediapipe/tasks-vision/wasm/", root),
))
  await cp(
    new URL(`node_modules/@mediapipe/tasks-vision/wasm/${name}`, root),
    new URL(`wasm/${name}`, target),
  );
const url =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float16/1/efficientdet_lite2.tflite";
const checksum =
  "5d4ebec1029bc9907aeadb9e7b4ac9cb1da6a19d01ad375210a9ae18ba173302";
const path = new URL("detector.tflite", target);
let existing;
try {
  existing = await readFile(path);
} catch {}
if (
  !existing ||
  createHash("sha256").update(existing).digest("hex") !== checksum
) {
  console.log("Preparing pinned on-device player detector…");
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok)
    throw Error("The official vision model could not be downloaded.");
  const model = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(model).digest("hex") !== checksum)
    throw Error("Vision model checksum mismatch.");
  await writeFile(path, model);
}
for (const [name, file] of [
  ["mediabunny", "LICENSE"],
  ["three", "LICENSE"],
  ["fflate", "LICENSE"],
  ["@mediapipe/tasks-vision", "LICENSE"],
]) {
  try {
    await cp(
      new URL(`node_modules/${name}/${file}`, root),
      new URL(
        `public/licenses/${name.replaceAll("/", "-").replace("@", "")}.txt`,
        root,
      ),
    );
  } catch {}
}
// The TensorFlow WASM fallback works on machines without WebGL.
const tfTarget = new URL("tfjs/", target);
await mkdir(tfTarget, { recursive: true });
for (const name of await readdir(
  new URL("node_modules/@tensorflow/tfjs-backend-wasm/dist/", root),
))
  if (name.endsWith(".wasm"))
    await cp(
      new URL(`node_modules/@tensorflow/tfjs-backend-wasm/dist/${name}`, root),
      new URL(name, tfTarget),
    );
const coco = JSON.parse(
  await readFile(new URL("scripts/coco-model.json", root), "utf8"),
);
await mkdir(new URL("coco/", target), { recursive: true });
for (const entry of coco.files) {
  const out = new URL(`coco/${entry.file}`, target);
  let data;
  try {
    data = await readFile(out);
  } catch {}
  if (
    !data ||
    createHash("sha256").update(data).digest("hex") !== entry.sha256
  ) {
    const res = await fetch(coco.url + entry.file, {
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) throw Error("CPU vision model download failed.");
    data = Buffer.from(await res.arrayBuffer());
    if (createHash("sha256").update(data).digest("hex") !== entry.sha256)
      throw Error("CPU vision model checksum mismatch.");
    await writeFile(out, data);
  }
}

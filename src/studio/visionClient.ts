import type { PixelFrame } from "./visionMath";
let worker: Worker | null = null;
let seq = 0;
const pending = new Map<
  number,
  { resolve: (v: any) => void; reject: (e: Error) => void }
>();
export function vision(
  type: string,
  payload: Record<string, unknown> = {},
): Promise<any> {
  if (!worker) {
    worker = new Worker(new URL("./vision.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      e.data.error ? p.reject(Error(e.data.error)) : p.resolve(e.data.result);
    };
    worker.onerror = () => {
      for (const p of pending.values())
        p.reject(
          Error(
            "The local vision engine could not start. Manual player marking is available.",
          ),
        );
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker!.postMessage({ id, type, origin: location.origin, ...payload });
  });
}
export function cancelVision() {
  worker?.terminate();
  worker = null;
  for (const p of pending.values()) p.reject(Error("Analysis cancelled"));
  pending.clear();
}
export function pixels(source: HTMLCanvasElement, maxWidth = 640): PixelFrame {
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(maxWidth, source.width);
  canvas.height = Math.round((canvas.width * source.height) / source.width);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: image.width, height: image.height, data: image.data };
}

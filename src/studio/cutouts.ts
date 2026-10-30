import type { TrackedTarget } from "./types";
/** Local grass-key extraction, intended for reviewed analysis cutouts, not broadcast matting. */
export function playerCutout(
  source: HTMLCanvasElement,
  target: TrackedTarget,
): string | undefined {
  const box = target.box || { w: 0.025, h: 0.07 },
    left = Math.max(0, (target.image.x - box.w * 0.7) * source.width),
    top = Math.max(0, (target.image.y - box.h * 1.08) * source.height),
    width = Math.min(source.width - left, box.w * 1.4 * source.width),
    height = Math.min(source.height - top, box.h * 1.12 * source.height);
  if (width < 3 || height < 6) return;
  const c = document.createElement("canvas");
  c.height = 180;
  c.width = Math.max(20, Math.round((180 * width) / height));
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, left, top, width, height, 0, 0, c.width, c.height);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  let kept = 0;
  for (let i = 0; i < data.data.length; i += 4) {
    const r = data.data[i],
      g = data.data[i + 1],
      b = data.data[i + 2];
    const green = g - Math.max(r, b);
    if (green > 12 && g > r * 1.08 && g > b * 1.06)
      data.data[i + 3] = Math.max(0, 255 - (green - 12) * 12);
    if (data.data[i + 3] > 100) kept++;
  }
  if (kept / (c.width * c.height) < 0.1) return;
  ctx.putImageData(data, 0, 0);
  return c.toDataURL("image/png");
}

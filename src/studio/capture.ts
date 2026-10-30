let previewCapture: (() => HTMLCanvasElement | null) | null = null;
export function registerPreviewCapture(
  capture: () => HTMLCanvasElement | null,
) {
  previewCapture = capture;
  return () => {
    if (previewCapture === capture) previewCapture = null;
  };
}
export function thumbnail(
  canvas: HTMLCanvasElement | null,
): string | undefined {
  if (!canvas || !canvas.width || !canvas.height) return;
  try {
    const small = document.createElement("canvas");
    small.width = 480;
    small.height = 270;
    const c = small.getContext("2d")!;
    c.fillStyle = "#0b111c";
    c.fillRect(0, 0, 480, 270);
    const scale = Math.min(480 / canvas.width, 270 / canvas.height);
    const w = canvas.width * scale,
      h = canvas.height * scale;
    c.drawImage(canvas, (480 - w) / 2, (270 - h) / 2, w, h);
    return small.toDataURL("image/jpeg", 0.72);
  } catch {
    return;
  }
}
export const captureThumbnail = () => thumbnail(previewCapture?.() || null);

/** Native-aspect preview for accurately placing tablet marks on footage. */
export function captureHostPreview(): { image: string; aspect: number } | undefined {
  const raw=previewCapture?.();if(!raw?.width||!raw.height)return;
  try {const small=document.createElement('canvas'),scale=Math.min(640/raw.width,480/raw.height);small.width=Math.round(raw.width*scale);small.height=Math.round(raw.height*scale);small.getContext('2d')!.drawImage(raw,0,0,small.width,small.height);return {image:small.toDataURL('image/jpeg',.76),aspect:raw.width/raw.height};}catch{return;}
}

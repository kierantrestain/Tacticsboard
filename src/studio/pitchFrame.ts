export function pitchFrame(view: 'full' | 'left' | 'right') {
  return { x: view === 'right' ? 550 : 0, y: 0, width: view === 'full' ? 1200 : 650, height: 760 };
}
export function fitPitch(width: number, height: number, view: 'full' | 'left' | 'right') {
  const frame = pitchFrame(view), scale = Math.max(0, Math.min(width / frame.width, height / frame.height));
  return { ...frame, scale, width: Math.floor(frame.width * scale), height: Math.floor(frame.height * scale) };
}

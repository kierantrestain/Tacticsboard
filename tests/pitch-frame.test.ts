import { describe, expect, it } from 'vitest';
import { fitPitch, pitchFrame } from '../src/studio/pitchFrame';

describe('fitting full and half pitches', () => {
  for (const view of ['full','left','right'] as const) for (const [width,height] of [[750,470],[560,340],[900,500]]) {
    it(`${view} fits ${width} × ${height} without stretching or cropping the touchlines`, () => {
      const frame = pitchFrame(view), fitted = fitPitch(width,height,view);
      expect(fitted.width).toBeLessThanOrEqual(width);expect(fitted.height).toBeLessThanOrEqual(height);
      expect(Math.abs(fitted.width/frame.width-fitted.height/frame.height)).toBeLessThan(.003);
      expect(48*fitted.scale).toBeGreaterThanOrEqual(0);expect(712*fitted.scale).toBeLessThanOrEqual(fitted.height);
      const goal=view==='right'?1135:view==='left'?65:600;
      expect((goal-frame.x)*fitted.scale).toBeGreaterThanOrEqual(0);expect((goal-frame.x)*fitted.scale).toBeLessThanOrEqual(fitted.width);
    });
  }
});

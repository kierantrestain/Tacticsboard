import { afterEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  current: null as any,
  previous: null as any,
  samples: [] as any[],
  disposed: vi.fn(),
  returned: vi.fn(),
  canDecode: true,
}));
vi.mock("mediabunny", () => ({
  ALL_FORMATS: [],
  BlobSource: class {},
  Input: class {
    getPrimaryVideoTrack = async () => ({
      canDecode: async () => fixture.canDecode,
    });
    dispose = fixture.disposed;
  },
  VideoSampleSink: class {
    getSample = async (time: number) =>
      time < fixture.current.timestamp ? fixture.previous : fixture.current;
    async *samples() {
      try {
        for (const sample of fixture.samples) yield sample;
      } finally {
        fixture.returned();
      }
    }
  },
}));
import { openFrameReader } from "../src/studio/frameReader";
const sample = (timestamp: number) => ({
  timestamp,
  displayWidth: 1280,
  displayHeight: 720,
  close: vi.fn(),
  draw: vi.fn(),
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  fixture.canDecode = true;
});
it("advances to the next distinct decoded presentation timestamp and releases overlapping samples", async () => {
  const canvas = { getContext: () => ({}) };
  vi.stubGlobal("document", { createElement: () => canvas });
  fixture.current = sample(1);
  const overlap = sample(1),
    next = sample(1.073);
  fixture.samples = [overlap, next, sample(1.097)];
  const reader = await openFrameReader(new Blob());
  expect(await reader.step(1, 1)).toEqual({ canvas, time: 1.073 });
  expect(fixture.current.close).toHaveBeenCalledOnce();
  expect(overlap.close).toHaveBeenCalledOnce();
  expect(next.close).toHaveBeenCalledOnce();
  expect(next.draw).toHaveBeenCalledOnce();
  expect(fixture.returned).toHaveBeenCalledOnce();
  reader.close();
  expect(fixture.disposed).toHaveBeenCalledOnce();
});
it("steps back by source timestamps rather than an assumed frame interval", async () => {
  vi.stubGlobal("document", {
    createElement: () => ({ getContext: () => ({}) }),
  });
  fixture.current = sample(1.073);
  fixture.previous = sample(1);
  const reader = await openFrameReader(new Blob());
  expect((await reader.step(1.073, -1))?.time).toBe(1);
  expect(fixture.previous.close).toHaveBeenCalledOnce();
  reader.close();
});
it("closes unsupported decoders and closes the iterator at the final frame", async () => {
  fixture.canDecode = false;
  await expect(openFrameReader(new Blob())).rejects.toThrow(
    "Decoded frame access",
  );
  expect(fixture.disposed).toHaveBeenCalledOnce();
  fixture.canDecode = true;
  fixture.current = sample(2);
  fixture.samples = [sample(2)];
  const reader = await openFrameReader(new Blob());
  expect(await reader.step(2, 1)).toBeNull();
  expect(fixture.samples[0].close).toHaveBeenCalledOnce();
  expect(fixture.returned).toHaveBeenCalledOnce();
  reader.close();
});

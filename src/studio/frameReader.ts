/** Bounded decoding: hold one decoded frame and release every sample/decoder. */
export async function openFrameReader(blob: Blob) {
  const { Input, BlobSource, ALL_FORMATS, VideoSampleSink } =
    await import("mediabunny");
  const input = new Input({
    source: new BlobSource(blob),
    formats: ALL_FORMATS,
  });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode()))
      throw Error("Decoded frame access is unavailable for this codec.");
    const sink = new VideoSampleSink(track);
    return {
      close: () => input.dispose(),
      async step(time: number, direction: number) {
        const current = await sink.getSample(Math.max(0, time) + 0.000001);
        if (!current) return null;
        const pts = current.timestamp;
        current.close();
        let sample;
        if (direction < 0)
          sample = await sink.getSample(Math.max(0, pts - 0.000001));
        else {
          const frames = sink.samples(pts + 0.00001);
          try {
            // The sink may yield the frame spanning the range start first.
            // Advance by presentation timestamps, including variable-rate media.
            for await (const candidate of frames) {
              if (candidate.timestamp > pts + 0.000001) {
                sample = candidate;
                break;
              }
              candidate.close();
            }
          } finally {
            await frames.return(undefined);
          }
        }
        if (!sample) return null;
        try {
          const canvas = document.createElement("canvas");
          canvas.width = sample.displayWidth;
          canvas.height = sample.displayHeight;
          sample.draw(
            canvas.getContext("2d")!,
            0,
            0,
            canvas.width,
            canvas.height,
          );
          return { canvas, time: sample.timestamp };
        } finally {
          sample.close();
        }
      },
    };
  } catch (e) {
    input.dispose();
    throw e;
  }
}

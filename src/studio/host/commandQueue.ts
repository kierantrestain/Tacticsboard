/** Keep discrete actions ordered while replacing unsent pointer updates with the latest position. */
export class HostCommandQueue {
  private pending: { run: () => Promise<void>; key?: string }[] = [];
  private running: Promise<void> | null = null;
  enqueue(run: () => Promise<void>, key?: string) {
    const last = this.pending.at(-1);
    if (key && last?.key === key) this.pending[this.pending.length - 1] = { run, key };
    else this.pending.push({ run, key });
    if (!this.running) this.running = this.drain();
  }
  private async drain() {
    try {
      while (this.pending.length) {
        const item = this.pending.shift()!;
        try { await item.run(); } catch { /* The caller reports request failures; keep the queue usable. */ }
      }
    } finally { this.running = null; }
  }
  clear() { this.pending = []; }
  async idle() { while (this.running) await this.running; }
}

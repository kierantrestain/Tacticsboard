import type { RoomSession } from './protocol';
export async function studioRequest(path: string, session?: RoomSession | null, data?: unknown, signal?: AbortSignal) {
  const response = await fetch(`/api/studio/${path}${session ? '?room=' + encodeURIComponent(session.room) : ''}`, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { ...(session ? { Authorization: `Bearer ${session.token}` } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: data === undefined ? undefined : JSON.stringify(data), signal,
  });
  const result = await response.json().catch(() => ({ error: 'Open the local Studio Hub to connect the tablets.' }));
  if (!response.ok) throw new Error(result.error || 'Studio connection unavailable.');
  return result;
}
/** Streaming fetch keeps credentials out of URLs/history and refreshes presence on reconnect. */
export function connectRoom(session: RoomSession, onEvent: (type: string, value: any) => void, onConnection: (status: 'connecting' | 'connected' | 'offline' | 'ended') => void) {
  let closed = false, timer: ReturnType<typeof setTimeout>, controller: AbortController;
  const run = async () => {
    controller = new AbortController(); onConnection('connecting');
    let watchdog: ReturnType<typeof setTimeout>;
    const alive = () => { clearTimeout(watchdog); watchdog = setTimeout(() => controller.abort(), 6500); };
    try {
      const response = await fetch(`/api/studio/events?room=${encodeURIComponent(session.room)}`, { headers: { Authorization: `Bearer ${session.token}` }, signal: controller.signal });
      if ([401, 403].includes(response.status)) { closed = true; onConnection('ended'); return; }
      if (!response.ok || !response.body) throw Error('Connection unavailable');
      onConnection('connected'); alive();
      const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
      while (!closed) {
        const chunk = await reader.read(); if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        let end; while ((end = buffer.indexOf('\n\n')) !== -1) {
          const event = buffer.slice(0, end); buffer = buffer.slice(end + 2); alive();
          const type = event.match(/^event: (.+)$/m)?.[1], data = event.match(/^data: (.+)$/m)?.[1];
          if (type && data) {
            if (type === 'ended' || type === 'replaced') { closed = true; onConnection('ended'); }
            onEvent(type, JSON.parse(data));
          }
        }
        if (buffer.length > 3_000_000) throw Error('Stream overflow');
      }
    } catch { /* Connection status remains visible; stale controls are disabled. */ }
    finally { clearTimeout(watchdog!); controller.abort(); }
    if (!closed) { onConnection('offline'); timer = setTimeout(run, 1200); }
  };
  void run();
  return () => { closed = true; clearTimeout(timer); controller?.abort(); };
}

import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { networkInterfaces } from 'node:os';

const ROLES = ['producer', 'host1', 'host2'];
const token = () => randomBytes(24).toString('base64url');
const equal = (a, b) => typeof a === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const loopback = (ip) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
const json = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
const failure = (status, message) => Object.assign(new Error(message), { status });
async function body(req, limit = 2_000_000) {
  let data = '', bytes = 0;
  for await (const part of req) { bytes += part.length; if (bytes > limit) throw failure(413, 'Message too large.'); data += part; }
  try { return JSON.parse(data); } catch { throw failure(400, 'Invalid message.'); }
}
export function studioOrigins(port) {
  try { return Object.values(networkInterfaces()).flat().filter((n) => n && n.family === 'IPv4' && !n.internal).map((n) => `http://${n.address}:${port}`); } catch { return []; }
}
/** Ephemeral, capability-scoped LAN relay. The producer remains the only editor. */
export function createStudioRooms({ port = 4174, trustedProxy = false, now = Date.now } = {}) {
  const rooms = new Map(), attempts = new Map();
  const event = (res, type, data) => {
    if (res.destroyed || res.writableEnded) return;
    // A slow/sleeping tablet reconnects to the latest state; never buffer an entire show.
    if (res.writableLength > 2_500_000) { res.end(); return; }
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const presence = (room) => ({ owner: room.owner, epoch: room.epoch, requested: room.requested, connected: Object.fromEntries(ROLES.map(r => [r, room.clients.has(r)])), armed: room.armed });
  const broadcast = (room, type, value, except) => { for (const [role, res] of room.clients) if (role !== except) event(res, type, value); };
  const announce = room => broadcast(room, 'presence', presence(room));
  const handover = (room, owner) => { room.owner = owner; room.epoch++; room.requested = null; announce(room); };
  const close = room => { broadcast(room, 'ended', {}); for (const res of room.clients.values()) res.end(); rooms.delete(room.id); };
  const sweep = setInterval(() => {
    for (const room of rooms.values()) {
      if (now() - room.touched > 12 * 60 * 60 * 1000) { close(room); continue; }
      for (const res of room.clients.values()) event(res, 'heartbeat', { time: now() });
    }
    for (const [ip, rate] of attempts) if (now() - rate.since > 60_000) attempts.delete(ip);
  }, 2000);
  sweep.unref?.();
  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/studio/')) return false;
    try {
      // Do not enable CORS. Reject cross-origin commands, including hostile LAN pages.
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) throw failure(403, 'Open the studio on this device first.');
      const canProduce = trustedProxy || loopback(req.socket.remoteAddress);
      if (url.pathname === '/api/studio/status' && req.method === 'GET') {
        json(res, 200, { enabled: true, version: 1, canProduce, origins: studioOrigins(port) }); return true;
      }
      if (url.pathname === '/api/studio/rooms' && req.method === 'POST') {
        if (!canProduce) throw failure(403, 'Start the session on the studio computer at localhost.');
        if (rooms.size >= 4) throw failure(409, 'End an existing studio session first.');
        const room = { id: token().slice(0, 16), tokens: Object.fromEntries(ROLES.map(r => [r, token()])), codes: {}, clients: new Map(), owner: null, epoch: 0, requested: null, armed: false, state: null, revision: 0, sequences: {}, touched: now() };
        for (const role of ['host1', 'host2']) {
          let code; do { code = String(randomInt(100000, 1000000)); } while ([...rooms.values()].some(r => Object.values(r.codes).includes(code)) || Object.values(room.codes).includes(code));
          room.codes[role] = code;
        }
        room.codeExpires = now() + 10 * 60_000;
        rooms.set(room.id, room);
        json(res, 201, { room: room.id, token: room.tokens.producer, codes: room.codes, expiresAt: room.codeExpires, origins: studioOrigins(port) }); return true;
      }
      if (url.pathname === '/api/studio/join' && req.method === 'POST') {
        const ip = req.socket.remoteAddress || 'unknown';
        let rate = attempts.get(ip); if (!rate || now() - rate.since > 60_000) { rate = { since: now(), count: 0 }; attempts.set(ip, rate); }
        if (++rate.count > 8) throw failure(429, 'Too many attempts. Wait a minute before trying again.');
        const input = await body(req, 2000);
        for (const room of rooms.values()) for (const role of ['host1', 'host2']) {
          if (room.codes[role] && equal(String(input.code || ''), room.codes[role]) && now() < room.codeExpires) {
            delete room.codes[role]; // One-use pairing; the role token handles reconnects.
            json(res, 200, { room: room.id, role, token: room.tokens[role] }); return true;
          }
        }
        throw failure(403, 'That code has expired or was already used. Ask the producer for a new code.');
      }
      const room = rooms.get(url.searchParams.get('room'));
      const credential = (req.headers.authorization || '').replace(/^Bearer /, '');
      const role = room && ROLES.find(r => equal(credential, room.tokens[r]));
      if (!room || !role) throw failure(401, 'The session ended. Pair with the studio again.');
      room.touched = now();
      if (url.pathname === '/api/studio/events' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.flushHeaders?.();
        const previous = room.clients.get(role);
        room.clients.set(role, res);
        if (previous) { event(previous, 'replaced', {}); previous.end(); }
        event(res, 'welcome', { seq: room.sequences[role] || 0 });
        event(res, 'presence', presence(room));
        if (room.state && role !== 'producer') event(res, 'state', { revision: room.revision, state: room.state });
        announce(room);
        res.on('close', () => {
          if (room.clients.get(role) !== res) return;
          room.clients.delete(role);
          if (role === 'producer') { room.armed = false; handover(room, null); }
          else if (room.owner === role) handover(room, null);
          else announce(room);
        });
        return true;
      }
      if (req.method !== 'POST') throw failure(405, 'Use a studio control to send this request.');
      const input = await body(req);
      if (url.pathname === '/api/studio/state') {
        if (role !== 'producer') throw failure(403, 'Only the producer publishes the show.');
        if (!input.state || typeof input.state !== 'object') throw failure(400, 'Missing show state.');
        room.state = input.state; room.revision++;
        broadcast(room, 'state', { revision: room.revision, state: room.state }, 'producer');
      } else if (url.pathname === '/api/studio/feedback') {
        if (role !== 'producer' || !['host1', 'host2'].includes(input.to)) throw failure(403, 'Only the producer can acknowledge host actions.');
        const target = room.clients.get(input.to); if (target) event(target, 'feedback', { message: String(input.message || '').slice(0, 240) });
      } else if (url.pathname === '/api/studio/control') {
        if (input.action === 'end' && role === 'producer') { close(room); json(res, 200, { ok: true }); return true; }
        if (input.action === 'pair' && role === 'producer' && ['host1', 'host2'].includes(input.role)) {
          const target = input.role;
          if (room.owner === target) handover(room, null);
          const old = room.clients.get(target); if (old) { event(old, 'ended', {}); old.end(); room.clients.delete(target); }
          room.tokens[target] = token(); room.sequences[target] = 0;
          let code; do { code = String(randomInt(100000, 1000000)); } while ([...rooms.values()].some(r => Object.values(r.codes).includes(code)));
          room.codes[target] = code; room.codeExpires = now() + 10 * 60_000;
          announce(room); json(res, 200, { code: room.codes[target], expiresAt: room.codeExpires }); return true;
        }
        if (input.action === 'arm' && role === 'producer') { room.armed = !!input.enabled; if (!room.armed) handover(room, null); else announce(room); }
        else if (input.action === 'request' && role !== 'producer') {
          if (!room.armed || !room.clients.has('producer')) throw failure(409, 'The producer has held tablet controls.');
          if (!room.owner) handover(room, role); else if (room.owner !== role) { room.requested = role; announce(room); }
        } else if (input.action === 'grant' && (role === 'producer' || room.owner === role)) {
          const target = ['host1', 'host2'].includes(input.to) ? input.to : null;
          if (target && (!room.armed || !room.clients.has(target))) throw failure(409, 'That host is not connected and enabled.');
          handover(room, target);
        } else if (!(input.action === 'arm' && role === 'producer')) throw failure(403, 'This control belongs to the producer or the active host.');
      } else if (url.pathname === '/api/studio/command') {
        if (role === 'producer' || !room.armed || room.owner !== role || !room.clients.has('producer')) throw failure(409, 'You do not have control. Request a handover.');
        if (input.epoch !== room.epoch) throw failure(409, 'Control has changed. Try again after the screen updates.');
        if (!Number.isSafeInteger(input.seq) || input.seq < 1) throw failure(400, 'Invalid command sequence.');
        if (input.seq <= (room.sequences[role] || 0)) { json(res, 200, { duplicate: true }); return true; }
        if (!input.command || typeof input.command !== 'object' || typeof input.command.type !== 'string') throw failure(400, 'Missing command.');
        if (JSON.stringify(input.command).length > 50_000) throw failure(413, 'Drawing too large.');
        room.sequences[role] = input.seq;
        event(room.clients.get('producer'), 'command', { ...input, role });
      } else throw failure(404, 'Unknown studio control.');
      json(res, 200, { ok: true });
    } catch (error) { if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'The studio connection could not complete that action.' }); else res.end(); }
    return true;
  }
  return { handle, close: () => { clearInterval(sweep); for (const room of rooms.values()) close(room); } };
}

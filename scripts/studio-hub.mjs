import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import { resolve, extname, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStudioRooms, studioOrigins } from '../server/studio-room.mjs';

const appVersion = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const portArgument = process.argv.indexOf('--port');
const port = Number(process.env.TOUCHLINE_PORT || process.env.PORT || (portArgument >= 0 ? process.argv[portArgument + 1] : 4174));
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Choose a port between 1 and 65535.');
if (!existsSync(resolve(root, 'index.html'))) { console.error('Build the studio first: npm run build'); process.exit(1); }
const rooms = createStudioRooms({ port });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.zip': 'application/zip' };
let football;
try { football = (await import('../api/football.js')).default; } catch { /* Downloaded standalone hub can run the bundled match library offline. */ }
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (await rooms.handle(req, res)) return;
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/football' && football) { await football(req, res); return; }
  if (url.pathname.startsWith('/api/')) { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Online feed unavailable. Bundled match reports remain available.' })); return; }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  let file;
  try { file = resolve(root, '.' + decodeURIComponent(url.pathname)); } catch { res.writeHead(400); res.end(); return; }
  if (!file.startsWith(root + sep) && file !== root) { res.writeHead(403); res.end(); return; }
  let info = await stat(file).catch(() => null);
  if (!info?.isFile()) { if (extname(url.pathname)) { res.writeHead(404); res.end(); return; } file = resolve(root, 'index.html'); info = await stat(file); }
  res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': 'no-cache' });
  if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
});
server.requestTimeout = 15_000;
server.listen(port, '0.0.0.0', () => {
  console.log(`\nTouchline Studio v${appVersion} · filming hub · control protocol 2\nOpen the producer desk: http://localhost:${port}\nTablet address: ${studioOrigins(port).map(o => o + '/?host=1').join('\nTablet address: ') || 'Connect this computer to your studio Wi-Fi'}\nKeep this window open while filming. Ctrl+C ends tablet connections.\n`);
});
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `Port ${port} is in use. Close the existing hub, or set TOUCHLINE_PORT.` : e.message); process.exitCode = 1; rooms.close(); });
process.on('SIGINT', () => { rooms.close(); server.close(); });

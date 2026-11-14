import { resolveMark } from './mark-anchors.js';
import { cameraBounds, fullPitchBounds as FULL, getPitchStyle, halfPitchBounds as HALF } from './camera.js';
import { matchLayerArtwork } from './match-layer.js';
const FIELD = { left: 25, right: 975, top: 24, bottom: 601 };
const SVG = 'http://www.w3.org/2000/svg';
const renderedBoards = new WeakMap();
let nextBoardId = 0;
let turfGrain;

// Generate the same seamless tile once. Embedding it keeps exported images self-contained.
function grassTexture() {
  if (turfGrain) return turfGrain;
  const size = 144;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(size, size);
  let randomState = 68;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const shade = (random() - .5) * 43;
      const index = (y * size + x) * 4;
      const tone = shade < 0 ? 0 : 255;
      pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = tone;
      pixels.data[index + 3] = Math.abs(shade) * 2;
    }
  }
  context.putImageData(pixels, 0, 0);
  turfGrain = canvas.toDataURL('image/png');
  return turfGrain;
}

function escapeMarkup(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function safeColor(value, fallback = '#f2f7e6') {
  if (/^#[\da-f]{6}$/i.test(value)) return value;
  if (/^#[\da-f]{3}$/i.test(value)) return '#' + [...value.slice(1)].map((digit) => digit.repeat(2)).join('');
  return fallback;
}

function pointString(point) {
  return `${Number(point.x)} ${Number(point.y)}`;
}

function turfMarkup(id,style) {
  const stripe = 950 / 18;
  const bands = Array.from({ length: 18 }, (_, index) =>
    `<rect x="${25 + index * stripe}" y="24" width="${stripe + .12}" height="577"
      fill="${index % 2 ? style.light : style.dark}"/>`).join('');
  return `<g clip-path="url(#${id}-field)">
    ${style.stripes ? bands : `<rect x="25" y="24" width="950" height="577" fill="${style.light}"/>`}
    ${style.stripes ? `<rect x="25" y="24" width="950" height="577" fill="url(#${id}-mow)"/>` : ''}
  </g>`;
}

function goal(left, id) {
  const side = left ? 1 : -1;
  const origin = left ? 25 : 975;
  return `<g transform="translate(${origin} 312.5) scale(${side} 1)">
    <path d="M -2 -33 -20 -28 -20 34 -2 38Z" fill="#152c11" opacity=".24"/>
    <path d="M 0 -31 -16 -33 -16 33 0 31Z" fill="#dbeccf" opacity=".16"/>
    <path d="M 0 -31 -16 -33 -16 33 0 31Z" fill="url(#${id}-net)" stroke="#eaf2e1" stroke-width="1.2" stroke-opacity=".63"/>
    <path d="M 0 -31 -6 -31.5 -6 31.5 0 31" fill="none" stroke="#f2f7ec" stroke-width="1.6"/>
    <path d="M 0 -31 V 31" fill="none" stroke="#f7f8f2" stroke-width="2.15"/>
    <circle cy="-31" r="1.45" fill="#fff"/><circle cy="31" r="1.45" fill="#fff"/>
  </g>`;
}

function centerStamp() {
  return `<g transform="translate(500 312.5)" fill="#e1eaca" opacity=".11" pointer-events="none">
    <circle r="72"/>
    <g fill="none" stroke="#224b18" stroke-width="4.4" stroke-linejoin="round">
      <rect x="-38" y="-25" width="76" height="50" rx="3"/>
      <path d="M 0 -25 V25 M -38 -13 H-23 V13 H-38 M 38 -13 H23 V13 H38"/>
      <circle r="11.5"/>
    </g>
  </g>`;
}

function guides(mode) {
  const horizontal = mode === 'lanes' ? 5 : mode === 'zones' ? 3 : 1;
  const vertical = mode === 'thirds' ? 3 : mode === 'zones' ? 6 : 1;
  const lines = [];
  for (let row = 1; row < horizontal; row += 1) lines.push(`M 25 ${24 + row * 577 / horizontal} H 975`);
  for (let column = 1; column < vertical; column += 1) lines.push(`M ${25 + column * 950 / vertical} 24 V 601`);
  return `<path d="${lines.join(' ')}" stroke="#dfefa4" stroke-opacity=".66"
    stroke-width="1.5" stroke-dasharray="6 8" fill="none"/>`;
}

function fieldMarkup(id, grid, guideMode, style) {
  return `
    <defs>
      <pattern id="${id}-mow" width="106" height="96.2" x="25" y="24" patternUnits="userSpaceOnUse">
        <rect width="106" height="48.1" fill="${style.shine}" fill-opacity=".016"/>
        <rect y="48.1" width="106" height="48.1" fill="${style.shade}" fill-opacity=".037"/>
      </pattern>
      <pattern id="${id}-grass" width="108" height="108" patternUnits="userSpaceOnUse">
        <image width="108" height="108" href="${grassTexture()}"/>
      </pattern>
      <pattern id="${id}-net" width="4" height="4" patternTransform="rotate(12)" patternUnits="userSpaceOnUse">
        <path d="M 0 0 H 4 M 0 0 V 4" fill="none" stroke="#ecf2e6" stroke-width=".7" stroke-opacity=".64"/>
      </pattern>
      <radialGradient id="${id}-light" cx=".51" cy=".48" r=".68">
        <stop offset="0" stop-color="#c2e69e" stop-opacity=".065"/>
        <stop offset=".56" stop-color="#263814" stop-opacity="0"/>
        <stop offset="1" stop-color="#102d08" stop-opacity=".16"/>
      </radialGradient>
      <radialGradient id="${id}-shadow">
        <stop offset="0" stop-color="#071b0c" stop-opacity=".62"/>
        <stop offset=".5" stop-color="#071b0c" stop-opacity=".38"/>
        <stop offset="1" stop-color="#071b0c" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="${id}-gloss" cx=".38" cy=".25" r=".81">
        <stop offset="0" stop-color="#fff" stop-opacity=".25"/>
        <stop offset=".44" stop-color="#fff" stop-opacity=".03"/>
        <stop offset=".68" stop-color="#000" stop-opacity=".13"/>
        <stop offset="1" stop-color="#000" stop-opacity=".42"/>
      </radialGradient>
      <linearGradient id="${id}-band" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".02"/>
        <stop offset=".84" stop-color="#fff" stop-opacity=".12"/>
        <stop offset="1" stop-color="#fff" stop-opacity=".37"/>
      </linearGradient>
      <clipPath id="${id}-field"><rect x="25" y="24" width="950" height="577"/></clipPath>
    </defs>
    <rect width="1000" height="625" fill="${style.base}"/>
    ${turfMarkup(id,style)}
    <rect width="1000" height="625" fill="url(#${id}-grass)" opacity="${style.stripes ? '.58' : '.22'}"/>
    <rect width="1000" height="625" fill="url(#${id}-light)"/>
    ${centerStamp()}
    ${goal(true, id)}${goal(false, id)}
    ${grid ? guides(guideMode) : ''}
    <path d="M 25 25 H975 V601 H25Z" fill="none" stroke="#173815" stroke-opacity=".18" stroke-width="3.6"/>
    <g fill="none" stroke="${style.white}" stroke-opacity=".94" stroke-width="1.65">
      <rect x="25" y="24" width="950" height="577"/>
      <path d="M 500 24 V 601
        M 25 141 H 175 V 484 H 25 M 25 234 H 75 V 391 H 25
        M 975 141 H 825 V 484 H 975 M 975 234 H 925 V 391 H 975
        M 175 244.6 A 83 83 0 0 1 175 380.4
        M 825 244.6 A 83 83 0 0 0 825 380.4
        M 35 24 A 10 10 0 0 1 25 34 M 965 24 A 10 10 0 0 0 975 34
        M 35 601 A 10 10 0 0 0 25 591 M 965 601 A 10 10 0 0 1 975 591"/>
      <circle cx="500" cy="312.5" r="79"/>
    </g>
    <g fill="#f2f6ea">
      <circle cx="500" cy="312.5" r="2.8"/>
      <circle cx="127" cy="312.5" r="2.55"/>
      <circle cx="873" cy="312.5" r="2.55"/>
    </g>`;
}

function penPath(points) {
  if (points.length < 3) return `M ${points.map(pointString).join(' L ')}`;
  const steps = points.slice(1, -1).map((point, index) => {
    const next = points[index + 2];
    return `Q ${pointString(point)} ${(point.x + next.x) / 2} ${(point.y + next.y) / 2}`;
  });
  return `M ${pointString(points[0])} ${steps.join(' ')} L ${pointString(points.at(-1))}`;
}

const arrowTools = new Set(['arrow', 'run', 'dribble', 'lob', 'shot']);

function arrowPath(type, points) {
  const from = points[0];
  const end = points.at(-1);
  const body = `M ${points.map(pointString).join(' L ')}`;
  const dx = end.x - from.x;
  const dy = end.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 3) return { body, tail: from };
  if (type === 'lob') {
    const curve = Math.min(85, distance * .29);
    const control = { x: (from.x + end.x) / 2 + curve * dy / distance,
      y: (from.y + end.y) / 2 - curve * dx / distance };
    return { body: `M ${pointString(from)} Q ${pointString(control)} ${pointString(end)}`, tail: control };
  }
  if (type === 'dribble') {
    const segments = Math.max(1, Math.round(distance / 30));
    const amplitude = Math.min(8, distance / 8);
    const stepX = dx / segments;
    const stepY = dy / segments;
    const offsetX = dy / distance * amplitude;
    const offsetY = -dx / distance * amplitude;
    let d = `M ${pointString(from)}`;
    let tail;
    for (let index = 0; index < segments; index += 1) {
      const x = from.x + stepX * index;
      const y = from.y + stepY * index;
      tail = { x: x + stepX * .72 - offsetX, y: y + stepY * .72 - offsetY };
      d += ` C ${x + stepX * .25 + offsetX} ${y + stepY * .25 + offsetY} ${pointString(tail)} ${x + stepX} ${y + stepY}`;
    }
    return { body: d, tail };
  }
  return { body, tail: points.at(-2) };
}

function arrowArtwork(mark, color) {
  const { body, tail } = arrowPath(mark.type, mark.points);
  const end = mark.points.at(-1);
  const length = Math.hypot(end.x - tail.x, end.y - tail.y);
  if (length < 3) return '';
  const size = Math.min(25, length * .6);
  const angle = Math.atan2(end.y - tail.y, end.x - tail.x);
  const a = { x: end.x - size * Math.cos(angle - .48), y: end.y - size * Math.sin(angle - .48) };
  const b = { x: end.x - size * Math.cos(angle + .48), y: end.y - size * Math.sin(angle + .48) };
  const head = `M ${pointString(a)} L ${pointString(end)} L ${pointString(b)}`;
  const dash = mark.type === 'run' ? 'stroke-dasharray="15 10"' : '';
  const width = mark.type === 'shot' ? 8 : 6.5;
  const track = mark.type === 'shot' ? `<path d="${body}" stroke="#142c20" stroke-width="1.5" stroke-opacity=".68"/>` : '';
  return `<g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="${body}" stroke="transparent" stroke-width="21" pointer-events="stroke"/>
    <path d="${body}" stroke="#142818" stroke-opacity=".63" stroke-width="${width + 3}" ${dash}/>
    <path d="${head}" stroke="#142818" stroke-opacity=".63" stroke-width="${width + 3}"/>
    <path d="${body}" stroke="${color}" stroke-width="${width}" ${dash}/>
    ${track}
    <path d="${head}" stroke="${color}" stroke-width="${width}"/>
  </g>`;
}

function markArtwork(mark) {
  const { type, points } = mark;
  if (!points?.length) return '';
  const from = points[0];
  const to = points.at(-1);
  const color = safeColor(mark.color);
  const x = Number(from.x);
  const y = Number(from.y);
  const endX = Number(to.x);
  const endY = Number(to.y);
  const dx = endX - x;
  const dy = endY - y;
  const distance = Math.hypot(dx, dy);
  const bounds = `x="${Math.min(x,endX)}" y="${Math.min(y,endY)}" width="${Math.abs(dx)}" height="${Math.abs(dy)}"`;
  const stroke = `stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
  if (type === 'rectangle' || type === 'oval') {
    const shape = type === 'rectangle' ? `<rect ${bounds}` :
      `<ellipse cx="${x + dx / 2}" cy="${y + dy / 2}" rx="${Math.abs(dx) / 2}" ry="${Math.abs(dy) / 2}"`;
    return `${shape} fill="${color}" fill-opacity=".05" ${stroke}/>`;
  }
  if (type === 'target') {
    return `<g transform="translate(${x} ${y})" fill="none" ${stroke}>
      <circle r="15" fill="#16291c" fill-opacity=".35"/><circle r="6"/><path d="M-22 0h6m32 0h6M0 -22v6m0 32v6"/></g>`;
  }
  if (type === 'cross') return `<path d="M${x - 11} ${y - 11}l22 22m0 -22-22 22" ${stroke}/>`;
  if (type === 'number') {
    return `<circle cx="${x}" cy="${y}" r="14" fill="${color}" stroke="#193521" stroke-width="2"/>
      <text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" fill="#111f17" font-family="Arial,sans-serif" font-size="15" font-weight="800">${escapeMarkup(mark.text || '1')}</text>`;
  }
  if (type === 'vision' && distance > 1) {
    const theta = Math.atan2(dy,dx);
    const radius = Math.min(distance,320);
    const a = {x:x + radius * Math.cos(theta - .47),y:y + radius * Math.sin(theta - .47)};
    const z = {x:x + radius * Math.cos(theta + .47),y:y + radius * Math.sin(theta + .47)};
    return `<path d="M${x} ${y} L${pointString(a)} A${radius} ${radius} 0 0 1 ${pointString(z)}Z"
      fill="${color}" fill-opacity=".20" ${stroke} stroke-opacity=".65"/>`;
  }
  if (type === 'measure' && distance > 1) {
    const metres = Math.hypot(dx * (105 / 950),dy * (68 / 577)).toFixed(1);
    const tickX = 8 * dy / distance, tickY = 8 * -dx / distance;
    return `<path d="M${x} ${y}L${endX} ${endY} M${x-tickX} ${y-tickY}l${2*tickX} ${2*tickY}
      M${endX-tickX} ${endY-tickY}l${2*tickX} ${2*tickY}" fill="none" ${stroke}/>
      <text x="${x + dx / 2}" y="${y + dy / 2 - 13}" text-anchor="middle" fill="${color}" stroke="#18321d" stroke-width="5" paint-order="stroke" font-family="Arial,sans-serif" font-size="17" font-weight="800">${metres} m</text>`;
  }
  if ((type === 'path' || type === 'space') && points.length >= 2) {
    const trace = penPath(points) + (type === 'space' ? ' Z' : '');
    return `<path d="${trace}" fill="none" stroke="transparent" stroke-width="18" pointer-events="stroke"/>
      <path d="${trace}" fill="${type === 'space' ? color : 'none'}" fill-opacity=".18" ${stroke} stroke-dasharray="9 5"/>`;
  }
  if (type === 'zone') {
    const x = Math.min(from.x, to.x);
    const y = Math.min(from.y, to.y);
    const width = Math.abs(from.x - to.x);
    const height = Math.abs(from.y - to.y);
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8"
      fill="${color}" fill-opacity=".16" stroke="${color}" stroke-width="2.5"
      stroke-dasharray="8 7" stroke-opacity=".76"/>`;
  }
  if (type === 'highlight') {
    const radius = points.length === 1 ? 66 : Math.max(15, Math.hypot(to.x - from.x, to.y - from.y));
    return `<circle cx="${Number(from.x)}" cy="${Number(from.y)}" r="${radius}" fill="${color}"
      fill-opacity=".25" stroke="${color}" stroke-width="3" stroke-opacity=".62"/>`;
  }
  if (type === 'text') {
    return `<text x="${Number(from.x)}" y="${Number(from.y)}" font-family="Arial, sans-serif" font-size="19"
      font-weight="bold" fill="${color}" stroke="#153f2c" stroke-width="3"
      paint-order="stroke">${escapeMarkup(mark.text)}</text>`;
  }
  if (type === 'cone') {
    return `<g transform="translate(${pointString(from)})">
      <ellipse rx="10" ry="4" cy="6" fill="#092219" fill-opacity=".52"/>
      <path d="M -8 5 -2 -9 Q 0 -11 2 -9 L 8 5 Z" fill="${color}"
        stroke="#15392b" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="M -3.5 -3 H 3.5" stroke="#fff" stroke-opacity=".75" stroke-width="1.4"/>
    </g>`;
  }
  if (points.length < 2) return '';
  if (arrowTools.has(type)) return arrowArtwork(mark, color);
  const d = type === 'pen' ? penPath(points) : `M ${points.map(pointString).join(' L ')}`;
  return `<path d="${d}" fill="none" stroke="transparent" stroke-width="18" pointer-events="stroke"/>
    <path d="${d}" fill="none" stroke="#15392b" stroke-opacity=".40" stroke-width="6.7"
      stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="4.1"
      stroke-linecap="round" stroke-linejoin="round"/>`;
}

function markMarkup(mark, selected) {
  return `<g data-mark="${escapeMarkup(mark.id)}"${selected === mark.id ? ' data-selected-mark=""' : ''}>${markArtwork(mark)}</g>`;
}

const underlayTools = new Set(['zone', 'highlight', 'vision', 'space']);

function playerMarkup(player, options, id) {
  const home = player.team === 'home';
  const goalkeeper = player.footballRole ? player.footballRole === 'GK' : player.id === `${player.team}-1`;
  const side = home ? 'home' : 'away';
  const color = goalkeeper ? safeColor(options[side + 'Keeper'],home ? '#14d8e8' : '#ca40da')
    : safeColor(options[side + 'Color'],home ? '#253c84' : '#202020');
  const band = goalkeeper && home && !options.homeKeeper ? '#132d7d' :
    safeColor(options[side + 'Trim'],home ? '#d12a2d' : '#e1e1e1');
  const numberColor = safeColor(options[side + (goalkeeper ? 'KeeperNumber' : 'Number')],'#ffffff');
  const rim = goalkeeper && home && !options.homeKeeper ? '#0bdced' : '#fcfcf8';
  const edges = goalkeeper && home ? 24 : 27;
  const outline = options.markerStyle === 'outline';
  const striped = !options.markerStyle || options.markerStyle === 'kit';
  const bandShape = `M -${edges - 1.8} 9 A ${edges} ${edges} 0 0 0 ${edges - 1.8} 9 Z`;
  const label = options.labels && player.name ? `<text y="-37" dominant-baseline="middle"
    stroke="#142912" stroke-width="3" stroke-linejoin="round" paint-order="stroke"
    font-size="12" letter-spacing=".65" font-weight="800" fill="#f8faee" pointer-events="none">${escapeMarkup(String(player.name).toUpperCase())}</text>` : '';
  const selection = options.selected === player.id ? `<circle data-selection="" r="35" fill="none"
    stroke="#f5ffdb" stroke-width="1.7" stroke-dasharray="3.4 2.5"/>` : '';
  const teamName = home ? options.homeName ?? 'Home' : options.awayName ?? 'Away';
  const name = `${teamName} ${player.number ?? ''} ${player.name ?? ''}`.trim();
  return `<g class="pitch-player" data-piece="${escapeMarkup(player.id)}" role="button" tabindex="0"
    aria-label="${escapeMarkup(name)}" transform="translate(${pointString(player)})"
    font-family="Arial, sans-serif" text-anchor="middle">
    <circle r="31" fill="transparent"/>
    <ellipse pointer-events="none" cx="4.2" cy="6.2" rx="35.7" ry="36.7" fill="url(#${id}-shadow)" transform="rotate(-25 4.2 6.2)"/>
    <circle r="${edges + 1.4}" fill="${outline ? '#132c22' : color}" fill-opacity="${outline ? '.65' : '1'}"/>
    ${outline ? `<circle r="${edges - 3}" fill="none" stroke="${color}" stroke-width="5"/>` : `<circle r="${edges + .2}" fill="url(#${id}-gloss)"/>`}
    ${striped ? `<path d="${bandShape}" fill="${band}"/><path d="${bandShape}" fill="url(#${id}-band)"/>` : ''}
    <circle r="${edges - 3.1}" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="1.6"/>
    <circle r="${edges + .7}" fill="none" stroke="${rim}" stroke-width="3"/>
    ${selection}
    <text y="1" dominant-baseline="middle" font-size="13.8" font-weight="800"
      fill="${numberColor}" stroke="${numberColor === '#ffffff' ? '#111' : '#ffffff'}" stroke-width="1.5" paint-order="stroke" pointer-events="none">${escapeMarkup(player.number || '–')}</text>
    ${label}
  </g>`;
}

function ballMarkup(ball, selected, id) {
  if (!ball) return '';
  const selection = selected ? `<circle data-selection="" r="17" fill="none"
    stroke="#f5ffdb" stroke-width="1.7" stroke-dasharray="3.4 2.5"/>` : '';
  return `<g class="pitch-player" transform="translate(${pointString(ball)})" data-piece="ball"
    role="button" aria-label="Ball" tabindex="0">
    <circle r="17" fill="transparent"/>
    <ellipse data-ball-shadow cx="2" cy="4" rx="16" ry="15" fill="url(#${id}-shadow)"/>
    <g data-ball-body>
    <circle r="12.7" fill="#f5f5ef" stroke="#101e16" stroke-width=".85"/>
    <path d="M 0 -3.9 3.8 -.9 2.6 4 -2.6 4 -3.8 -.9 Z
      M -2.6 -12.3 2.2 -12.4 5.1 -9.2 2.2 -7 -2.5 -7.2 -5 -9.5Z
      M 11.4 -5.3 12.2 .9 9.8 3.6 6.2 1.3 7.1 -3.2Z
      M 9.6 8 5 11.6 1.3 12.5 1.4 8.4 5.1 6Z
      M -9.6 8 -5 11.6 -1.3 12.5 -1.4 8.4 -5.1 6Z
      M -11.4 -5.3 -12.2 .9 -9.8 3.6 -6.2 1.3 -7.1 -3.2Z"
      fill="#19221b" stroke="#19221b" stroke-width=".4"/>
    <path d="M 0 -3.9 0 -7 M 3.8 -.9 6.8 -1.7 M -3.8 -.9 -6.8 -1.7 M 2.6 4 4.1 6.7 M -2.6 4 -4.1 6.7"
      fill="none" stroke="#666a60" stroke-width=".55"/>
    <circle r="12.3" fill="url(#${id}-gloss)"/>
    ${selection}
    </g>
  </g>`;
}

export function renderBoard(container, scene, options = {}) {
  let rendered = renderedBoards.get(container);
  const view = options.view === 'half' ? HALF : FULL;
  const grid = Boolean(options.grid);
  const guideMode = options.guideMode ?? 'zones';
  const style = getPitchStyle(options.pitchStyle);
  if (!rendered || rendered.view !== view || rendered.style !== style || rendered.grid !== grid || (grid && rendered.guideMode !== guideMode) || rendered.svg.parentNode !== container) {
    const id = rendered?.id ?? `pitch-${++nextBoardId}`;
    const { x, y, width, height } = view;
    container.innerHTML = `<svg xmlns="${SVG}" viewBox="${x} ${y} ${width} ${height}"
      width="${width}" height="${height}" style="display:block;width:100%;height:auto;max-height:100%;touch-action:none;user-select:none;"
      role="group" aria-label="Football pitch">
      <style>
        .pitch-player { cursor: grab; outline: none; }
        .pitch-player:active { cursor: grabbing; }
        .pitch-player:focus-visible { outline: 2px solid #effccf; }
        [data-selected-mark] { filter:drop-shadow(0 0 5px #f1ffcd); }
      </style>
      ${fieldMarkup(id, grid, guideMode, style)}
      <g data-match-layer="" clip-path="url(#${id}-field)"></g>
      <g data-board-marks="" clip-path="url(#${id}-field)"></g>
      <g data-board-pieces=""></g>
      <g data-drawing-preview="" pointer-events="none" clip-path="url(#${id}-field)"></g>
    </svg>`;
    const svg = container.querySelector('svg');
    rendered = { id, view, style, grid, guideMode, svg, marksNode: svg.querySelector('[data-board-marks]'), mapNode:svg.querySelector('[data-match-layer]'),
      piecesNode: svg.querySelector('[data-board-pieces]') };
    renderedBoards.set(container, rendered);
  }
  rendered.snap = Boolean(options.snap);
  const frame = cameraBounds(scene.camera,view);
  const crop = `${frame.x} ${frame.y} ${frame.width} ${frame.height}`;
  if (crop !== rendered.crop) {
    rendered.svg.setAttribute('viewBox',crop);
    rendered.crop = crop;
  }
  if (rendered.matchLayer !== scene.matchLayer) {
    rendered.mapNode.innerHTML = matchLayerArtwork(scene.matchLayer,rendered.id);
    rendered.matchLayer = scene.matchLayer;
  }
  const players = (scene.players ?? [])
    .filter(player => !player.benched && (player.team === 'away' ? options.away !== false : options.home !== false));
  const playerPositions = new Map(players.map(player => [player.id,player]));
  const marks = (scene.marks ?? []).map(mark => resolveMark(mark,playerPositions));
  const zones = marks.filter(mark => underlayTools.has(mark.type)).map(mark => markMarkup(mark,options.selectedMark)).join('');
  const drawings = marks.filter(mark => !underlayTools.has(mark.type)).map(mark => markMarkup(mark,options.selectedMark)).join('');
  const trails = options.trails ?? [];
  const paths = trails.map(trail => `<g pointer-events="none" fill="none" stroke="${safeColor(trail.color)}" opacity=".55">
      <path d="M ${pointString(trail.from)} L ${pointString(trail.to)}" stroke-width="3" stroke-dasharray="7 6"/>
      <circle cx="${Number(trail.to.x)}" cy="${Number(trail.to.y)}" r="19" stroke-width="2" stroke-dasharray="4 4"/>
    </g>`).join('');
  const marksMarkup = paths + zones + drawings;
  if (marksMarkup !== rendered.marksMarkup) {
    rendered.marksNode.innerHTML = marksMarkup;
    rendered.marksMarkup = marksMarkup;
  }
  const appearance = JSON.stringify([options.homeColor, options.awayColor,options.homeTrim,options.awayTrim,
    options.homeNumber,options.awayNumber,options.homeKeeper,options.awayKeeper,options.homeKeeperNumber,options.awayKeeperNumber,
    options.labels,options.markerStyle,options.homeName,options.awayName,options.selected,Boolean(scene.ball),
    players.map(({id, team, name, number, footballRole}) => [id, team, name, number, footballRole])]);
  if (rendered.appearance !== appearance) {
    rendered.piecesNode.innerHTML = players.map(player => playerMarkup(player, options, rendered.id)).join('') +
      ballMarkup(scene.ball, options.selected === 'ball', rendered.id);
    rendered.positions = new Map([...rendered.piecesNode.children].map(piece => [piece.dataset.piece, piece]));
    rendered.ballBody = rendered.piecesNode.querySelector('[data-ball-body]');
    rendered.ballShadow = rendered.piecesNode.querySelector('[data-ball-shadow]');
    rendered.appearance = appearance;
  }
  for (const player of players) movePiece(rendered.positions.get(player.id), player);
  if (scene.ball) {
    movePiece(rendered.positions.get('ball'), scene.ball);
    const lift = Number.isFinite(scene.ball.lift) ? Math.max(0, Math.min(40, scene.ball.lift)) : 0;
    rendered.ballBody.setAttribute('transform', `translate(0 ${-lift}) scale(${1 + lift / 210})`);
    rendered.ballShadow.setAttribute('opacity', String(1 - lift / 60));
    rendered.ballShadow.setAttribute('transform', `translate(${lift * .22} ${lift * .11})`);
  }
}

function movePiece(node, point) {
  if (!node) return;
  const transform = `translate(${pointString(point)})`;
  if (node.getAttribute('transform') !== transform) node.setAttribute('transform', transform);
}

function clamp(value, lower, upper) {
  return Math.max(lower, Math.min(upper, value));
}

function pitchLimits(svg, y, allowNet) {
  const insideGoal = allowNet && Math.abs(y - 312.5) <= 31;
  return [Math.max(svg.viewBox.baseVal.x, insideGoal ? 10 : FIELD.left),insideGoal ? 990 : FIELD.right];
}

function pitchPoint(container, event, allowNet = false) {
  const svg = container.querySelector('svg');
  const matrix = svg?.getScreenCTM();
  if (!matrix) return null;
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  const [left,right] = pitchLimits(svg,point.y,allowNet);
  return {
    x: clamp(point.x,left,right),
    y: clamp(point.y, FIELD.top, FIELD.bottom),
  };
}

function piecePoint(element) {
  const transform = element.transform.baseVal.getItem(0).matrix;
  return { x: transform.e, y: transform.f };
}

let nextMarkId = 0;
function makeMark(type, points, color) {
  const id = globalThis.crypto?.randomUUID?.() ?? `mark-${Date.now()}-${++nextMarkId}`;
  return { id, type, points, color: safeColor(color) };
}

function showPreview(container, mark) {
  const preview = container.querySelector('[data-drawing-preview]');
  if (preview) preview.innerHTML = mark ? markArtwork(mark) : '';
}

const dragTools = new Set([...arrowTools, 'line', 'pen', 'zone', 'highlight', 'rectangle', 'oval', 'vision', 'measure', 'path', 'space']);
const landmarks = [{ x: 500, y: 312.5 }, { x: 127, y: 312.5 }, { x: 873, y: 312.5 },
  { x: 25, y: 24 }, { x: 975, y: 24 }, { x: 25, y: 601 }, { x: 975, y: 601 }];
const keyboardMoves = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

export function bindBoard(container, callbacks) {
  let drag = null;
  let arrowStart = null;
  const getTool = () => callbacks.getTool?.() ?? 'select';
  const getColor = () => callbacks.getColor?.() ?? '#f2f7e6';

  function cancelArrow() {
    if (!arrowStart) return;
    arrowStart = null;
    showPreview(container);
  }

  function arrowPoint(point, target) {
    const piece = target?.closest('[data-piece]');
    if (piece) return piecePoint(piece);
    if (!(callbacks.getSnap?.() ?? renderedBoards.get(container)?.snap)) return point;
    const candidates = [...container.querySelectorAll('[data-piece]')].map(piecePoint).concat(landmarks);
    const left = container.querySelector('svg').viewBox.baseVal.x;
    let nearest = point;
    let limit = 24;
    for (const candidate of candidates) {
      if (candidate.x < left) continue;
      const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
      if (distance >= limit) continue;
      nearest = candidate;
      limit = distance;
    }
    return nearest;
  }

  function down(event) {
    if (drag || event.button !== 0 || !event.isPrimary) return;
    const target = event.target;
    const tool = getTool();
    const point = pitchPoint(container,event,tool === 'shot' || target.closest('[data-piece="ball"]'));
    if (!point) return;
    if (arrowStart && arrowStart.type !== tool) cancelArrow();

    if (tool === 'select') {
      const piece = target.closest('[data-piece]');
      if (!piece) {
        callbacks.onSelect?.(null);
        callbacks.onSelectMark?.(target.closest('[data-mark]')?.dataset.mark ?? null);
        return;
      }
      const position = piecePoint(piece);
      drag = { pointer: event.pointerId, origin: point, position, id: piece.dataset.piece };
      container.setPointerCapture(event.pointerId);
      callbacks.onSelect?.(drag.id);
    } else if (tool === 'erase') {
      const mark = target.closest('[data-mark]');
      if (mark) callbacks.onErase?.(mark.dataset.mark);
    } else if (tool === 'text') {
      callbacks.onText?.(point, safeColor(getColor()));
    } else if (['cone','target','cross','number'].includes(tool)) {
      callbacks.onMark?.(makeMark(tool, [point], getColor()));
    } else if (dragTools.has(tool)) {
      const isArrow = arrowTools.has(tool);
      const startPlayer = target.closest('[data-piece]');
      const playerId = startPlayer?.dataset.piece;
      const attachablePlayer = playerId && playerId !== 'ball' ? playerId : null;
      const start = isArrow ? arrowPoint(point,target) :
        tool === 'highlight' && attachablePlayer && callbacks.getAttach?.() ? piecePoint(startPlayer) : point;
      const fromPending = isArrow && Boolean(arrowStart);
      const mark = fromPending ? arrowStart : makeMark(tool, [start], getColor());
      if (fromPending) {
        mark.points[1] = start;
        if (attachablePlayer && callbacks.getAttach?.()) {
          mark.anchors = [...(mark.anchors ?? []),{index:1,playerId:attachablePlayer,dx:0,dy:0}];
        }
        arrowStart = null;
      } else if ((isArrow || tool === 'highlight' || tool === 'vision') && attachablePlayer && callbacks.getAttach?.()) {
        const center = piecePoint(startPlayer);
        mark.anchors = [{index:0,playerId:attachablePlayer,dx:start.x-center.x,dy:start.y-center.y}];
      }
      drag = { pointer: event.pointerId, origin: point, mark, fromPending };
      container.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
  }

  function move(event) {
    if (!drag) {
      if (!arrowStart) return;
      if (arrowStart.type !== getTool()) return cancelArrow();
      const point = pitchPoint(container,event,arrowStart.type === 'shot');
      if (point) showPreview(container, { ...arrowStart, points: [arrowStart.points[0], arrowPoint(point, event.target)] });
      return;
    }
    if (drag.pointer !== event.pointerId) return;
    const point = pitchPoint(container,event,drag.id === 'ball' || drag.mark?.type === 'shot');
    if (!point) return;
    const dx = point.x - drag.origin.x;
    const dy = point.y - drag.origin.y;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;

    if (drag.id) {
      if (!drag.moved) callbacks.onStart?.(drag.id);
      const y = clamp(drag.position.y + dy, FIELD.top, FIELD.bottom);
      const [left,right] = pitchLimits(container.querySelector('svg'),y,drag.id === 'ball');
      const x = clamp(drag.position.x + dx,left,right);
      callbacks.onMove?.(drag.id, x, y);
    } else {
      const { mark } = drag;
      if (['pen','path','space'].includes(mark.type)) {
        const last = mark.points.at(-1);
        if (mark.points.length < 4000 && Math.hypot(point.x - last.x, point.y - last.y) >= 2) mark.points.push(point);
      } else {
        mark.points[1] = arrowTools.has(mark.type) ? arrowPoint(point) : point;
      }
      showPreview(container, mark);
    }
    drag.moved = true;
  }

  function finish(event) {
    if (!drag || drag.pointer !== event.pointerId) return;
    const finished = drag;
    drag = null;
    if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
    if (finished.id && finished.moved) callbacks.onCommit?.();
    if (!finished.mark) return;
    showPreview(container);
    if (event.type !== 'pointerup') return;
    const { mark } = finished;
    if (arrowTools.has(mark.type)) {
      if (finished.moved || finished.fromPending) {
        const distance = Math.hypot(mark.points[1].x - mark.points[0].x, mark.points[1].y - mark.points[0].y);
        if (distance >= 3) callbacks.onMark?.(mark);
      } else {
        arrowStart = mark;
        showPreview(container, { ...mark, type: 'highlight', points: [mark.points[0], { x: mark.points[0].x + 16, y: mark.points[0].y }] });
      }
    } else if ((finished.moved && mark.points.length >= 2) || mark.type === 'highlight') {
      callbacks.onMark?.(mark);
    }
  }

  function keydown(event) {
    const piece = event.target.closest('[data-piece]');
    if (!piece || piece !== event.target || getTool() !== 'select') return;
    const id = piece.dataset.piece;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callbacks.onSelect?.(id);
      focusPiece(id);
      return;
    }
    const step = keyboardMoves[event.key];
    if (!step) return;
    event.preventDefault();
    const point = piecePoint(piece);
    const distance = event.shiftKey ? 20 : 5;
    const y = clamp(point.y + distance * step[1],FIELD.top,FIELD.bottom);
    const [left,right] = pitchLimits(container.querySelector('svg'),y,id === 'ball');
    callbacks.onSelect?.(id);
    callbacks.onStart?.(id);
    callbacks.onMove?.(id,clamp(point.x + distance * step[0],left,right),y);
    callbacks.onCommit?.();
    focusPiece(id);
  }

  function focusPiece(id) {
    const pieces = container.querySelectorAll('[data-piece]');
    [...pieces].find((piece) => piece.dataset.piece === id)?.focus();
  }

  container.addEventListener('pointerdown', down);
  container.addEventListener('pointermove', move);
  container.addEventListener('pointerup', finish);
  container.addEventListener('pointercancel', finish);
  container.addEventListener('lostpointercapture', finish);
  container.addEventListener('keydown', keydown);

  function clearOnEscape(event) {
    if (event.key === 'Escape') cancelArrow();
  }
  function clearAfterToolChange() {
    if (arrowStart && getTool() !== arrowStart.type) cancelArrow();
  }
  const document = container.ownerDocument;
  document.addEventListener('keydown', clearOnEscape);
  document.addEventListener('click', clearAfterToolChange);

  function unbind() {
    container.removeEventListener('pointerdown', down);
    container.removeEventListener('pointermove', move);
    container.removeEventListener('pointerup', finish);
    container.removeEventListener('pointercancel', finish);
    container.removeEventListener('lostpointercapture', finish);
    container.removeEventListener('keydown', keydown);
    document.removeEventListener('keydown', clearOnEscape);
    document.removeEventListener('click', clearAfterToolChange);
  }

  unbind.startArrow = (x,y,playerId) => {
    const type = getTool();
    if (!arrowTools.has(type)) return;
    arrowStart = makeMark(type,[{x,y}],getColor());
    if (playerId && callbacks.getAttach?.()) arrowStart.anchors = [{index:0,playerId,dx:0,dy:0}];
    showPreview(container, { ...arrowStart, type: 'highlight', points: [{ x, y }, { x: x + 16, y }] });
  };
  return unbind;
}

export async function canvasBoard(container, { scale = 2 } = {}) {
  const source = container.querySelector('svg');
  if (!source) throw new Error('The pitch is not ready to export.');
  const copy = source.cloneNode(true);
  const width = source.width.baseVal.value;
  const height = source.height.baseVal.value;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  copy.removeAttribute('style');
  copy.setAttribute('width', canvas.width);
  copy.setAttribute('height', canvas.height);
  copy.querySelectorAll('[data-selection], [data-drawing-preview]').forEach(element => element.remove());
  copy.querySelectorAll('[data-selected-mark]').forEach(element => element.removeAttribute('data-selected-mark'));

  const svg = new XMLSerializer().serializeToString(copy);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('The pitch image could not be rendered.'));
      image.src = url;
    });
    canvas.getContext('2d').drawImage(image, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportBoard(container, filename = 'touchline.png') {
  const canvas = await canvasBoard(container);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('PNG export failed.')), 'image/png');
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = /\.png$/i.test(filename) ? filename : `${filename}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

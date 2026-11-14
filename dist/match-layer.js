const color = value => /^#[\da-f]{6}$/i.test(value) ? value : '#e1f4bd';
const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character]);

export function matchLayerArtwork(layer, id) {
  if (!layer || !Array.isArray(layer.points)) return '';
  if (layer.mode === 'heat') {
    const palette = ['#fb6337','#ffbe31','#66e58e'];
    const gradient = palette.map((tone,index) => `<radialGradient id="${id}-density-${index}">
      <stop offset="0" stop-color="${tone}"/><stop offset=".4" stop-color="${tone}" stop-opacity=".67"/>
      <stop offset="1" stop-color="${tone}" stop-opacity="0"/>
    </radialGradient>`).join('');
    return `<defs>${gradient}</defs>${layer.points.map(point =>
      `<circle cx="${Number(point.x)}" cy="${Number(point.y)}" r="${Number(point.r)}"
        fill="url(#${id}-density-${Math.max(0,palette.indexOf(point.color))})" opacity="${Number(point.alpha)}"/>`).join('')}`;
  }
  return layer.points.map(point => {
    const x = Number(point.x), y = Number(point.y), radius = Number(point.r);
    return `<g opacity="${Number(point.alpha)}"><title>${escape(point.label)}</title>
      <circle cx="${x}" cy="${y}" r="${radius}" fill="${color(point.color)}" stroke="#eefbd7" stroke-width="2"/>
      ${point.caption ? `<text x="${x}" y="${y - 16}" text-anchor="middle" font-size="13" font-family="Arial,sans-serif"
        fill="#ffffff" stroke="#152a1a" stroke-width="3" paint-order="stroke" font-weight="700">${escape(point.caption)}</text>` : ''}</g>`;
  }).join('');
}

export function validMatchLayer(layer) {
  if (layer === undefined) return true;
  return layer && ['shots','heat','average'].includes(layer.mode) && ['both','home','away'].includes(layer.side) &&
    typeof layer.match === 'string' && layer.match.length <= 180 &&
    typeof layer.source === 'string' && layer.source.length <= 190 &&
    Array.isArray(layer.points) && layer.points.length <= 400 && layer.points.every(point =>
      point && Number.isFinite(point.x) && point.x >= 0 && point.x <= 1000 &&
      Number.isFinite(point.y) && point.y >= 0 && point.y <= 625 &&
      Number.isFinite(point.r) && point.r >= 0 && point.r <= 100 &&
      Number.isFinite(point.alpha) && point.alpha >= 0 && point.alpha <= 1 &&
      /^#[\da-f]{6}$/i.test(point.color) && typeof point.label === 'string' && point.label.length <= 180 &&
      (point.caption === undefined || (typeof point.caption === 'string' && point.caption.length <= 55)));
}

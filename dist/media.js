import { applyMediaKeyframe, openMediaKeyframeEditor } from './media-keyframes.js';
import { deleteMediaProject, getMediaProject, listMediaProjects, saveMediaProject } from './media-projects.js';

const iconPaths = {
  back: '<path d="m13 5-7 7 7 7m-7-7h13"/>',
  projects: '<path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 10h18"/>',
  animate: '<path d="m12 3 6 9-6 9-6-9z"/><path d="M3 7v10m18-10v10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  arrow: '<path d="M5 19 19 5m-9 0h9v9"/>',
  line: '<path d="M5 19 19 5"/>',
  pen: '<path d="M3 17c2-9 4-9 7-3s5 6 11-7"/>',
  highlight: '<circle cx="12" cy="12" r="7"/>',
  zone: '<rect x="4" y="5" width="16" height="14" rx="2" stroke-dasharray="3 3"/>',
  erase: '<path d="m6 16 6 5h5m-7-3 10-11-5-5L4 14zm0-9 5 5"/>',
  undo: '<path d="M4 11h10a5 5 0 1 1 0 10h-3m-2-15-5 5 5 5"/>',
  redo: '<path d="M20 11H10a5 5 0 1 0 0 10h3m2-15 5 5-5 5"/>',
  text: '<path d="M4 7V4h16v3m-8-3v16m-4 0h8"/>',
  oval: '<ellipse cx="12" cy="12" rx="8.5" ry="6"/>',
  rectangle: '<rect x="4" y="5" width="16" height="14" rx="1.5"/>',
  spotlight: '<circle cx="12" cy="12" r="5"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2m10-10 2-2"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
  number: '<circle cx="12" cy="12" r="8"/><path d="m10 9 2-2v10m-2 0h4"/>',
  cross: '<path d="m6 6 12 12M6 18 18 6"/>',
  measure: '<path d="M3 15h18V9H3zm4-6v3m3-3v2m4-2v3m3-3v2"/>',
  path: '<path d="M3 20c4-9 10 0 9-8-1-6 3-9 8-8m-5 1 5-1-1 5"/>',
  fov: '<path d="M4 18 20 5a17 17 0 0 1 1 13z"/><circle cx="4" cy="18" r="1"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  backFrame: '<path d="M5 5v14m14-14-9 7 9 7z"/>',
  nextFrame: '<path d="M19 5v14M5 5l9 7-9 7z"/>',
  trash: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  media: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m10 8 6 4-6 4z"/>',
  play: '<path d="m8 5 11 7-11 7z" fill="currentColor"/>',
  pause: '<path d="M9 5H6v14h3zm9 0h-3v14h3z" fill="currentColor"/>',
  eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/>',
};
const drawTools = {
  arrow: ['Arrow', 'Drag to show a pass.'],
  line: ['Line', 'Drag to draw a straight line.'],
  pen: ['Pen', 'Draw freely on the frame.'],
  highlight: ['Highlight', 'Click or drag to highlight a player or area.'],
  zone: ['Zone', 'Drag to shade an area.'],
  text: ['Text', 'Click where you want a label.'],
  rectangle: ['Rectangle', 'Drag between opposite corners.'],
  oval: ['Oval', 'Drag between opposite corners.'],
  spotlight: ['Spotlight', 'Click or drag to dim everything around the subject.'],
  target: ['Target', 'Click or drag to place a target ring.'],
  number: ['Number marker', 'Click to place the next numbered marker.'],
  cross: ['X mark', 'Click to place an X, or drag to change the size.'],
  measure: ['Measure', 'Drag to measure distance in source pixels.'],
  path: ['Path arrow', 'Draw a curved path ending in an arrow.'],
  fov: ['Field of view', 'Drag from a player in the direction they are facing.'],
  erase: ['Eraser', 'Click a visible annotation to erase it.'],
};
const quickTools = ['arrow', 'line', 'pen', 'highlight', 'zone', 'text'];
const pointTools = new Set(['highlight', 'spotlight', 'target', 'number', 'cross']);
const continuousTools = new Set(['path', 'pen']);
const colors = { Cyan:'#22ebfa', White:'#f7faf7', Yellow:'#f9d226', Red:'#ff606b', Green:'#80df87', Blue:'#659fff' };

function markRadius(mark) {
  const first = mark.points[0], last = mark.points.at(-1);
  return mark.points.length === 1 ? mark.radius : Math.max(5, Math.hypot(last.x-first.x,last.y-first.y));
}

function arrowHead(context, from, to, width) {
  const distance = Math.hypot(to.x-from.x,to.y-from.y);
  if (distance < 2) return;
  const angle = Math.atan2(to.y-from.y,to.x-from.x);
  const size = Math.min(Math.max(14,width*3.6),distance*.68);
  const wing = turn => [to.x-size*Math.cos(angle+turn),to.y-size*Math.sin(angle+turn)];
  context.moveTo(...wing(-.55));
  context.lineTo(to.x,to.y);
  context.lineTo(...wing(.55));
}

function icon(name) {
  return `<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;
}

function action(name, title, iconName = name) {
  return `<button class="media-button" data-media-action="${name}" title="${title}" aria-label="${title}">${icon(iconName)}<span>${title}</span></button>`;
}

function drawMark(context, mark) {
  context.save();
  renderMark(context,mark);
  context.restore();
}

function renderMark(context, mark) {
  const from = mark.points[0];
  const to = mark.points.at(-1);
  const width = mark.width ?? 4;
  const factor = mark.scale ?? 1;
  const radius = markRadius(mark);
  const dx = to.x-from.x;
  const dy = to.y-from.y;
  context.lineWidth = width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = mark.color;
  context.fillStyle = mark.color;
  if (mark.dashed) context.setLineDash([width*2.5,width*2]);
  context.beginPath();

  if (mark.type === 'spotlight') {
    context.rect(0,0,context.canvas.width,context.canvas.height);
    context.arc(from.x,from.y,radius,0,2*Math.PI);
    context.fillStyle = '#07120d';
    context.globalAlpha = .68;
    context.fill('evenodd');
    context.beginPath();
    context.arc(from.x,from.y,radius,0,2*Math.PI);
    context.globalAlpha = .75;
    context.stroke();
    return;
  }
  if (mark.type === 'text' || mark.type === 'number') {
    const label = mark.text ?? '';
    const size = Math.max(17*factor,width*4.6);
    if (mark.type === 'number') {
      context.arc(from.x,from.y,Math.max(radius*.54,size*.73),0,2*Math.PI);
      context.fill();
      context.fillStyle = '#101912';
    } else {
      context.shadowColor = '#0c180f';
      context.shadowBlur = 5*factor;
    }
    context.font = `700 ${size}px Inter, sans-serif`;
    context.textAlign = mark.type === 'number' ? 'center' : 'left';
    context.textBaseline = 'middle';
    context.fillText(label,from.x,from.y,Math.max(size,context.canvas.width-from.x));
    return;
  }
  if (['zone','rectangle','oval','highlight','target','fov'].includes(mark.type)) {
    if (mark.type === 'zone' || mark.type === 'rectangle') context.rect(from.x,from.y,dx,dy);
    else if (mark.type === 'oval') {
      context.ellipse(from.x+dx/2,from.y+dy/2,Math.abs(dx/2),Math.abs(dy/2),0,0,2*Math.PI);
    } else if (mark.type === 'fov') {
      const angle = Math.atan2(dy,dx);
      context.moveTo(from.x,from.y);
      context.arc(from.x,from.y,radius,angle-Math.PI/6,angle+Math.PI/6);
      context.closePath();
    } else context.arc(from.x,from.y,radius,0,2*Math.PI);
    if (mark.type === 'zone' || mark.type === 'highlight' || mark.type === 'fov') {
      context.globalAlpha = .23;
      context.fill();
      context.globalAlpha = 1;
    }
    context.stroke();
    if (mark.type === 'target') {
      context.beginPath();
      context.arc(from.x,from.y,radius*.46,0,2*Math.PI);
      context.fill();
    }
    return;
  }
  if (mark.type === 'cross') {
    const leg = radius*.66;
    context.moveTo(from.x-leg,from.y-leg);
    context.lineTo(from.x+leg,from.y+leg);
    context.moveTo(from.x-leg,from.y+leg);
    context.lineTo(from.x+leg,from.y-leg);
    context.stroke();
    return;
  }
  if (mark.type === 'measure') {
    context.moveTo(from.x,from.y);
    context.lineTo(to.x,to.y);
    const length = Math.hypot(dx,dy);
    if (length >= 1) {
      const tick = width*2.1;
      for (const at of [from,to]) {
        context.moveTo(at.x+dy/length*tick,at.y-dx/length*tick);
        context.lineTo(at.x-dy/length*tick,at.y+dx/length*tick);
      }
      context.stroke();
      context.font = `700 ${Math.max(13*factor,width*3.3)}px Inter, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'bottom';
      context.shadowColor = '#0c180f';
      context.shadowBlur = 5*factor;
      context.fillText(`${Math.round(length*(mark.pixelRatio ?? 1))} px`,from.x+dx/2,from.y+dy/2-width*1.7);
    }
    return;
  }

  context.moveTo(from.x,from.y);
  if (continuousTools.has(mark.type) && mark.points.length > 2) {
    for (let index = 1; index < mark.points.length-1; index++) {
      const a = mark.points[index], b = mark.points[index+1];
      context.quadraticCurveTo(a.x,a.y,(a.x+b.x)/2,(a.y+b.y)/2);
    }
    context.lineTo(to.x,to.y);
  } else {
    for (const point of mark.points.slice(1)) context.lineTo(point.x,point.y);
  }
  context.stroke();
  if (mark.type === 'arrow' || mark.type === 'path') {
    const stem = mark.points.findLast(point => Math.hypot(point.x-to.x,point.y-to.y) > width*1.5) ?? from;
    context.setLineDash([]);
    context.beginPath();
    arrowHead(context,stem,to,width);
    context.stroke();
  }
}

function distanceToSegment({ x, y }, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const u = lengthSquared ? Math.min(1, Math.max(0, ((x - from.x) * dx + (y - from.y) * dy) / lengthSquared)) : 0;
  return Math.hypot(x - (from.x + u * dx), y - (from.y + u * dy));
}

function hitsMark(mark, point) {
  const from = mark.points[0];
  const to = mark.points.at(-1);
  const padding = Math.max(8,(mark.width ?? 4)*2.1);
  if (['zone','rectangle','oval'].includes(mark.type)) {
    return point.x >= Math.min(from.x,to.x)-padding && point.x <= Math.max(from.x,to.x)+padding &&
      point.y >= Math.min(from.y,to.y)-padding && point.y <= Math.max(from.y,to.y)+padding;
  }
  if (pointTools.has(mark.type) || mark.type === 'fov') {
    return Math.hypot(point.x-from.x,point.y-from.y) <= markRadius(mark)+padding;
  }
  if (mark.type === 'text') {
    const height = Math.max(17*(mark.scale ?? 1),(mark.width ?? 4)*4.6);
    return point.x >= from.x-padding && point.x <= from.x+height*.65*mark.text.length+padding &&
      Math.abs(point.y-from.y) <= height*.6+padding;
  }
  return mark.points.slice(1).some((end,index) => distanceToSegment(point,mark.points[index],end) <= padding);
}

function visibleAt(mark, time) {
  return !mark.timing || (time+0.001 >= mark.timing.start && time <= mark.timing.end+0.001);
}

function showTimestamp(seconds, precise = false) {
  if (!Number.isFinite(seconds)) return '0:00';
  const fraction = precise ? `.${String(Math.floor((seconds%1)*10)).padStart(1,'0')}` : '';
  return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}${fraction}`;
}

export function mountMedia(container, {goHome} = {}) {
  const listenerController = new AbortController();
  const { signal } = listenerController;
  const urls = new Set();
  const items = [];
  let activeIndex = -1;
  let element = null;
  let tool = 'arrow';
  let color = colors.Cyan;
  let annotationsVisible = true;
  let isPlaying = false;
  let draft = null;
  let activePointer = null;
  let drawingWidth = 4;
  let dashed = false;
  let timed = false;
  let timingEdit = null;
  let timingForNewMark = null;
  let statusTimer;
  let mediaEvents;
  let videoFrame = null;
  let recording = null;
  let project = null;
  let projectBusy = false;
  let dirty = false;
  let pickingMotion = false;
  let mounted = true;
  container.classList.add('media-screen');
  container.innerHTML = `
    <header class="media-top">
      <div class="media-title">${action('home','Back to home','back')}<h1>Media Draw</h1></div>
      <p id="mediaFileTitle">Local footage</p>
      <div class="media-top-actions">${action('projects','Projects')}${action('add','Add media','plus')}${action('export','Export frame','download')}${action('export-video','Export video','media')}</div>
    </header>
    <div class="media-body">
      <aside class="media-rail" aria-label="Media clips">
        <div class="media-clips"></div>${action('add','Add media','plus')}${action('remove','Remove clip','trash')}
      </aside>
      <main class="media-main">
        <div class="media-viewport">
          <div class="media-surface" hidden>
            <div class="media-element"></div>
            <canvas aria-label="Annotation surface"></canvas>
          </div>
          <div class="media-empty">
            <div class="media-empty-icon">${icon('media')}</div>
            <h2>Add a clip or image</h2>
            <p>Pause on a moment and draw over the frame.</p>
            ${action('add','Choose media','plus')}
          </div>
        </div>
        <div class="media-playback" aria-label="Playback controls" hidden>
          ${action('back-frame','Step back 0.03 seconds','backFrame')}
          ${action('play','Play','play')}
          ${action('next-frame','Step forward 0.03 seconds','nextFrame')}
          <time>0:00 / 0:00</time>
          <div class="media-seek-group">
            <input type="range" class="media-seek" aria-label="Video position" min="0" max="0" step="0.01" value="0">
            <div class="media-cues" aria-label="Timed annotations"></div>
          </div>
          <button class="media-speed" data-media-action="speed" aria-label="Playback speed">1×</button>
        </div>
      </main>
    </div>
    <footer class="media-tools">
      <div class="media-draw-tools" aria-label="Annotation tools"></div>
      <div class="media-tool-options" aria-label="Drawing options">
        <div class="media-colors" aria-label="Annotation colors"></div>
        <label class="media-picker" title="Custom colour"><span class="media-sr">Custom colour</span><input type="color" value="#22ebfa"></label>
        <label class="media-width" title="Stroke width"><span class="media-sr">Stroke width</span><select aria-label="Stroke width"><option value="2">Fine</option><option value="4" selected>Medium</option><option value="7">Bold</option><option value="11">Heavy</option></select></label>
        <button type="button" class="media-button media-dash" data-media-action="dash" aria-label="Dashed stroke" title="Dashed stroke" aria-pressed="false"><span aria-hidden="true">╌</span></button>
      </div>
      <div class="media-edit-tools">${action('timing','New annotation timing','clock')}${action('animate','Animate annotation')}${action('visibility','Hide annotations','eye')}${action('undo','Undo')}${action('redo','Redo')}${action('clear','Clear annotations','trash')}</div>
      <p class="media-tool-hint">Drag to show a pass.</p>
      <div class="media-more-menu" aria-label="More annotation tools" hidden></div>
      <form class="media-timing" hidden>
        <h2>Annotation timing</h2>
        <p class="media-timing-hint"></p>
        <div class="media-timing-controls">
          <label>From (s)<input class="media-time-start" type="number" min="0" step="0.001" required></label>
          <label>To (s)<input class="media-time-end" type="number" min="0" step="0.001" required></label>
        </div>
        <div class="media-timing-actions">
          <button type="button" class="media-button" data-media-action="cancel-timing">Cancel</button>
          <button type="button" class="media-button" data-media-action="whole">Whole clip</button>
          <button type="submit" class="media-button media-primary">Use range</button>
        </div>
      </form>
    </footer>
    <p class="media-status" role="status" hidden></p>
    <input class="media-files" type="file" accept="image/*,video/*" multiple hidden>
    <dialog class="media-project-dialog" aria-labelledby="mediaProjectsHeading">
      <div class="media-project-head"><div><h2 id="mediaProjectsHeading">Media projects</h2><p>Clips and annotations are saved in this browser.</p></div>
        <button type="button" class="media-button" data-media-action="close-projects">Close</button></div>
      <form class="media-project-save">
        <label>Project name<input name="title" maxlength="80" required></label>
        <button type="submit" class="media-button media-primary" value="save">Save project</button>
        <button type="submit" class="media-button" value="copy" hidden>Save a copy</button>
      </form>
      <p class="media-project-feedback" aria-live="polite"></p>
      <h3>Saved on this device</h3>
      <div class="media-project-list"></div>
    </dialog>
    <dialog class="media-text-dialog">
      <form method="dialog">
        <h2>Add a text label</h2>
        <label>Label<input class="media-text-value" type="text" maxlength="80" placeholder="Player or tactical instruction" required></label>
        <div class="media-timing-actions">
          <button type="button" class="media-button" data-media-action="cancel-text">Cancel</button>
          <button type="submit" class="media-button media-primary">Place label</button>
        </div>
      </form>
    </dialog>
  `;

  const $ = selector => container.querySelector(selector);
  const filePicker = $('.media-files');
  const surface = $('.media-surface');
  const elementSlot = $('.media-element');
  const canvas = $('canvas');
  const context = canvas.getContext('2d');
  const playback = $('.media-playback');
  const timeline = $('.media-seek');
  const playButton = $('[data-media-action=play]');
  const notice = $('.media-status');
  const morePanel = $('.media-more-menu');
  const timingPanel = $('.media-timing');
  const textDialog = $('.media-text-dialog');
  const projectDialog = $('.media-project-dialog');
  const projectForm = $('.media-project-save');
  const projectFeedback = $('.media-project-feedback');
  const projectList = $('.media-project-list');
  const item = () => items[activeIndex];
  let textMark = null;

  function toolButton(key) {
    const [name] = drawTools[key];
    return `<button type="button" class="media-button" data-media-tool="${key}" aria-pressed="false" aria-label="${name}" title="${name}">${icon(key)}<span>${name}</span></button>`;
  }
  $('.media-draw-tools').innerHTML = quickTools.map(toolButton).join('') + action('more','More tools','more');
  morePanel.innerHTML = Object.keys(drawTools).filter(key => !quickTools.includes(key)).map(toolButton).join('');
  $('.media-colors').innerHTML = Object.entries(colors).map(([name, value]) =>
    `<button class="media-swatch" title="${name}" aria-label="${name}" aria-pressed="false" data-media-color="${value}" style="--media-color:${value}"></button>`).join('');

  function report(message) {
    notice.textContent = message;
    notice.hidden = false;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { notice.hidden = true; }, 3000);
  }

  function renderControls() {
    const current = item();
    const hasMedia = Boolean(current && !surface.hidden);
    for (const button of container.querySelectorAll('[data-media-tool]')) {
      button.disabled = !hasMedia;
      button.setAttribute('aria-pressed', button.dataset.mediaTool === tool);
    }
    for (const button of container.querySelectorAll('[data-media-color]')) {
      button.disabled = !hasMedia;
      button.setAttribute('aria-pressed', button.dataset.mediaColor === color);
    }
    $('[data-media-action=export]').disabled = !hasMedia;
    $('[data-media-action=projects]').disabled = Boolean(recording);
    const motionButton = $('[data-media-action=animate]');
    motionButton.disabled = !hasMedia || current.kind !== 'video' || !current.marks.length || !Number.isFinite(element?.duration);
    motionButton.setAttribute('aria-pressed',String(pickingMotion));
    canvas.classList.toggle('media-pick-motion', pickingMotion);
    const videoExport = $('[data-media-action=export-video]');
    videoExport.hidden = current?.kind !== 'video' && !recording;
    videoExport.disabled = !recording && (!hasMedia || !Number.isFinite(element?.duration));
    videoExport.setAttribute('aria-label',recording ? 'Cancel video export' : 'Export video');
    videoExport.title = recording ? 'Cancel video export' : 'Export video';
    videoExport.querySelector('span').textContent = videoExport.title;
    $('[data-media-action=remove]').disabled = !current || Boolean(recording);
    $('[data-media-action=undo]').disabled = !current?.undo.length;
    $('[data-media-action=redo]').disabled = !current?.redo.length;
    $('[data-media-action=more]').disabled = !hasMedia;
    $('[data-media-action=more]').setAttribute('aria-expanded', String(!morePanel.hidden));
    $('[data-media-action=more]').setAttribute('aria-pressed',String(!quickTools.includes(tool)));
    $('[data-media-action=dash]').disabled = !hasMedia;
    $('[data-media-action=dash]').setAttribute('aria-pressed',String(dashed));
    $('[data-media-action=timing]').disabled = !hasMedia || current.kind !== 'video' || !Number.isFinite(element?.duration);
    $('[data-media-action=timing]').setAttribute('aria-pressed',String(timed));
    $('.media-width select').disabled = !hasMedia;
    $('.media-picker input').disabled = !hasMedia;
    $('[data-media-action=clear]').disabled = !current?.marks.length;
    $('[data-media-action=visibility]').disabled = !current?.marks.length;
    $('[data-media-action=visibility]').setAttribute('aria-pressed', String(!annotationsVisible));
    const visibilityText = annotationsVisible ? 'Hide annotations' : 'Show annotations';
    $('[data-media-action=visibility]').setAttribute('aria-label', visibilityText);
    $('[data-media-action=visibility]').title = visibilityText;
    const timing = timed && timingForNewMark && current?.kind === 'video'
      ? ` · New marks ${showTimestamp(timingForNewMark.start,true)}–${showTimestamp(timingForNewMark.end,true)}` : '';
    $('.media-tool-hint').textContent = pickingMotion ? 'Click a visible annotation to add movement keyframes.' : drawTools[tool][1] + timing;
  }

  function renderCues() {
    const rail = $('.media-cues');
    rail.replaceChildren();
    const duration = element?.duration;
    if (item()?.kind !== 'video' || !Number.isFinite(duration) || duration <= 0) return;
    item().marks.forEach((mark,index) => {
      const firstFrame = mark.keyframes?.[0]?.time;
      if (!mark.timing && !Number.isFinite(firstFrame)) return;
      const cue = document.createElement('button');
      cue.type = 'button';
      cue.className = 'media-cue';
      cue.dataset.mediaCue = index;
      const start = mark.timing?.start ?? firstFrame;
      const end = mark.timing?.end ?? mark.keyframes.at(-1).time;
      const motion = !mark.timing;
      cue.dataset.mediaCueMode = motion ? 'motion' : 'timing';
      cue.setAttribute('aria-label', `Edit ${drawTools[mark.type][0]} ${motion ? 'keyframes' : 'timing'} at ${showTimestamp(start,true)}`);
      cue.title = `${drawTools[mark.type][0]} · ${showTimestamp(start,true)}–${showTimestamp(end,true)}`;
      cue.style.left = `${Math.min(100,start/duration*100)}%`;
      cue.style.width = `${Math.min(100,(end-start)/duration*100)}%`;
      cue.style.setProperty('--media-cue-color',mark.color);
      rail.append(cue);
    });
  }

  function redraw() {
    context.clearRect(0,0,canvas.width,canvas.height);
    if (annotationsVisible) drawOverlay(context,item()?.marks ?? [],element?.currentTime ?? 0);
    if (draft) drawMark(context,draft);
  }

  function drawOverlay(output, marks, time) {
    const visible = marks.filter(mark => visibleAt(mark,time)).map(mark =>
      applyMediaKeyframe(mark,time,output.canvas.width,output.canvas.height));
    for (const mark of visible) if (mark.type === 'spotlight') drawMark(output,mark);
    for (const mark of visible) if (mark.type !== 'spotlight') drawMark(output,mark);
  }

  function showTiming(index = null) {
    if (element?.tagName !== 'VIDEO' || !Number.isFinite(element.duration)) return;
    element.pause();
    timingEdit = index;
    const current = element.currentTime;
    const duration = element.duration;
    const stored = index === null ? timingForNewMark : item()?.marks[index]?.timing;
    const start = Math.max(0,Math.min(duration-.1,stored?.start ?? current));
    const end = Math.min(duration,Math.max(start+.1,stored?.end ?? current+3));
    const first = $('.media-time-start');
    const last = $('.media-time-end');
    first.max = duration.toFixed(3);
    last.max = duration.toFixed(3);
    first.value = start.toFixed(3);
    last.value = end.toFixed(3);
    $('.media-timing-hint').textContent = index === null ?
      'New annotations will only appear in this time range.' : 'Set when this annotation appears during playback.';
    timingPanel.hidden = false;
    morePanel.hidden = true;
    renderControls();
    first.focus();
  }

  function saveTiming(range) {
    if (timingEdit === null) {
      timed = Boolean(range);
      timingForNewMark = range;
    } else if (item()?.marks[timingEdit]) {
      const selected = timingEdit;
      updateMarks(marks => marks.map((mark,index) => index === selected ? {...mark,timing:range} : mark));
    }
    timingPanel.hidden = true;
    timingEdit = null;
    renderControls();
  }

  function fitSurface() {
    const current = item();
    if (!current?.width || !current.height) return;
    const viewport = $('.media-viewport');
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (!width || !height) return;
    const scale = Math.min(width / current.width, height / current.height, 1.75);
    surface.style.width = `${Math.floor(current.width * scale)}px`;
    surface.style.height = `${Math.floor(current.height * scale)}px`;
    redraw();
  }

  function renderRail() {
    const rail = $('.media-clips');
    rail.replaceChildren();
    items.forEach((clip, index) => {
      const button = document.createElement('button');
      button.className = 'media-thumb';
      button.dataset.mediaIndex = index;
      button.title = clip.name;
      button.setAttribute('aria-label', clip.name);
      button.setAttribute('aria-current', index === activeIndex ? 'true' : 'false');
      if (clip.kind === 'image') {
        const thumbnail = new Image();
        thumbnail.src = clip.url;
        thumbnail.alt = '';
        button.append(thumbnail);
      } else if (clip.thumbnail) {
        const thumbnail = new Image();
        thumbnail.src = clip.thumbnail;
        thumbnail.alt = '';
        button.append(thumbnail);
        const playIcon = document.createElement('i');
        playIcon.innerHTML = icon('play');
        button.append(playIcon);
      } else {
        button.innerHTML = icon('media');
      }
      const number = document.createElement('span');
      number.textContent = index + 1;
      button.append(number);
      rail.append(button);
    });
  }

  function cancelVideoFrame() {
    if (videoFrame === null) return;
    if (typeof element?.cancelVideoFrameCallback === 'function') element.cancelVideoFrameCallback(videoFrame);
    else cancelAnimationFrame(videoFrame);
    videoFrame = null;
  }

  function scheduleVideoFrame() {
    if (videoFrame !== null || !item()?.marks.some(mark => mark.timing || mark.keyframes?.length) || !isPlaying) return;
    const frame = () => {
      videoFrame = null;
      redraw();
      scheduleVideoFrame();
    };
    videoFrame = typeof element.requestVideoFrameCallback === 'function'
      ? element.requestVideoFrameCallback(frame) : requestAnimationFrame(frame);
  }

  function syncTime() {
    if (element?.tagName !== 'VIDEO') return;
    const duration = Number.isFinite(element.duration) ? element.duration : 0;
    timeline.max = duration;
    timeline.value = element.currentTime;
    timeline.disabled = !duration;
    playback.querySelector('time').textContent = `${showTimestamp(element.currentTime,true)} / ${showTimestamp(duration,true)}`;
    $('.media-speed').textContent = `${element.playbackRate}×`;
    isPlaying = !element.paused && !element.ended;
    const name = isPlaying ? 'Pause' : 'Play';
    playButton.innerHTML = icon(isPlaying ? 'pause' : 'play') + '<span>' + name + '</span>';
    playButton.setAttribute('aria-label', name);
    playButton.title = name;
    if (isPlaying) scheduleVideoFrame();
    else cancelVideoFrame();
    redraw();
  }

  function setActive(index) {
    cancelVideoFrame();
    if (element?.tagName === 'VIDEO') {
      if (item()) item().time = element.currentTime;
      element.pause();
    }
    mediaEvents?.abort();
    mediaEvents = new AbortController();
    const mediaSignal = mediaEvents.signal;
    activeIndex = index;
    const current = item();
    draft = null;
    activePointer = null;
    isPlaying = false;
    annotationsVisible = true;
    pickingMotion = false;
    morePanel.hidden = true;
    timingPanel.hidden = true;
    timed = false;
    timingEdit = null;
    timingForNewMark = null;
    element = null;
    elementSlot.replaceChildren();
    surface.hidden = true;
    playback.hidden = true;
    $('.media-empty').hidden = Boolean(current);
    $('#mediaFileTitle').textContent = project ? `${project.title}${current ? ' · ' + current.name : ''}` : current?.name ?? 'Local footage';
    renderRail();
    renderControls();
    renderCues();
    if (!current) return;

    function initialize() {
      current.width = element.naturalWidth || element.videoWidth;
      current.height = element.naturalHeight || element.videoHeight;
      if (!current.width || !current.height) return;
      const scale = Math.min(1, 1920 / current.width, 1920 / current.height);
      canvas.width = Math.ceil(current.width * scale);
      canvas.height = Math.ceil(current.height * scale);
      surface.hidden = false;
      playback.hidden = current.kind !== 'video';
      if (current.kind === 'video') {
        element.currentTime = Math.max(0,Math.min(current.time,Number.isFinite(element.duration) ? element.duration : current.time));
        syncTime();
      }
      fitSurface();
      renderControls();
      renderCues();
    }

    if (current.kind === 'image') {
      element = new Image();
      element.alt = current.name;
      element.addEventListener('load', initialize,{signal:mediaSignal});
    } else {
      element = document.createElement('video');
      element.preload = 'auto';
      element.playsInline = true;
      element.addEventListener('loadedmetadata',initialize,{signal:mediaSignal});
      element.addEventListener('loadeddata',() => {
        if (current.thumbnail || !element.videoWidth) return;
        const thumbnail = document.createElement('canvas');
        thumbnail.width = 150;
        thumbnail.height = Math.max(1, Math.round(150 * element.videoHeight / element.videoWidth));
        thumbnail.getContext('2d').drawImage(element,0,0,thumbnail.width,thumbnail.height);
        current.thumbnail = thumbnail.toDataURL('image/jpeg', .65);
        renderRail();
      },{signal:mediaSignal});
      for (const name of ['play','pause','seeking','seeked','timeupdate','durationchange','ratechange','ended']) {
        element.addEventListener(name,syncTime,{signal:mediaSignal});
      }
    }
    element.addEventListener('error',() => report('This file format could not be opened.'),{signal:mediaSignal});
    elementSlot.append(element);
    element.src = current.url;
  }

  function addFiles(files) {
    const next = items.length;
    for (const file of files) {
      if (items.length >= 250) break;
      if (!file.size || !file.name.trim()) continue;
      let kind;
      if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(file.name)) kind = 'image';
      else if (file.type.startsWith('video/') || /\.(mp4|webm|m4v|mov)$/i.test(file.name)) kind = 'video';
      else continue;
      const url = URL.createObjectURL(file);
      urls.add(url);
      items.push({ url, file, kind, name:file.name.slice(0,255), time:0, marks:[], undo:[], redo:[] });
    }
    if (items.length > next) {
      dirty = true;
      setActive(next);
    }
    else if (files.length) report('Choose a supported image or video file.');
  }

  function setProjectBusy(value) {
    projectBusy = value;
    projectForm.querySelectorAll('input,button').forEach(control => { control.disabled = value; });
    projectList.querySelectorAll('button').forEach(control => { control.disabled = value; });
  }

  function projectError(error) {
    return error?.name === 'QuotaExceededError' ? 'Storage is full. Remove a saved project or save a smaller clip.' :
      error?.message || 'The media project could not be opened or saved.';
  }

  async function refreshProjectList() {
    const rows = await listMediaProjects();
    if (!mounted) return;
    projectList.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No media projects saved yet.';
      projectList.append(empty);
    }
    for (const entry of rows) {
      const row = document.createElement('div');
      row.className = 'media-project-row';
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'media-project-open';
      open.dataset.mediaProject = entry.id;
      const title = document.createElement('strong');
      title.textContent = entry.title;
      const meta = document.createElement('small');
      meta.textContent = `${entry.clipCount} ${entry.clipCount === 1 ? 'clip' : 'clips'} · ${new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(entry.updatedAt)}`;
      open.append(title,meta);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'media-button';
      remove.dataset.mediaProjectDelete = entry.id;
      remove.setAttribute('aria-label',`Remove ${entry.title}`);
      remove.textContent = 'Remove';
      row.append(open,remove);
      projectList.append(row);
    }
  }

  function syncProjectForm() {
    projectForm.hidden = !items.length;
    projectForm.elements.title.value = project?.title ?? item()?.name?.replace(/\.[^.]+$/,'').slice(0,80) ?? '';
    projectForm.querySelector('[value=copy]').hidden = !project;
    projectForm.querySelector('[value=save]').textContent = project ? 'Update project' : 'Save project';
  }

  async function showProjects() {
    if (projectDialog.open) return;
    if (element?.tagName === 'VIDEO') element.pause();
    syncProjectForm();
    projectFeedback.textContent = 'Loading projects…';
    projectDialog.showModal();
    setProjectBusy(true);
    try {
      await refreshProjectList();
      projectFeedback.textContent = '';
    } catch (error) {
      projectFeedback.textContent = projectError(error);
    } finally { setProjectBusy(false); }
  }

  async function runProjectOperation(callback) {
    if (projectBusy) return;
    setProjectBusy(true);
    try { await callback(); }
    catch (error) { projectFeedback.textContent = projectError(error); }
    finally { setProjectBusy(false); }
  }

  async function loadProject(id) {
    if (dirty && !window.confirm('Open the saved project and discard the unsaved changes in Media Draw?')) return;
    return runProjectOperation(async () => {
      const saved = await getMediaProject(id);
      if (!mounted) return;
      setActive(-1);
      for (const clip of items) {
        URL.revokeObjectURL(clip.url);
        urls.delete(clip.url);
      }
      items.length = 0;
      for (const clip of saved.clips) {
        const url = URL.createObjectURL(clip.file);
        urls.add(url);
        items.push({...clip,url,undo:[],redo:[]});
      }
      project = {id:saved.id,title:saved.title};
      dirty = false;
      setActive(saved.activeIndex);
      projectDialog.close();
      report(`Opened ${saved.title}`);
    });
  }

  function showMotion(index) {
    const current = item();
    const mark = current?.marks[index];
    if (!mark || element?.tagName !== 'VIDEO' || !Number.isFinite(element.duration)) return;
    element.pause();
    if (mark.timing && !visibleAt(mark,element.currentTime)) element.currentTime = mark.timing.start;
    pickingMotion = false;
    renderControls();
    const video = element;
    openMediaKeyframeEditor({
      container,mark,time:video.currentTime,duration:video.duration,width:canvas.width,height:canvas.height,
      onSave(keyframes) { if (item() === current) updateMarks(marks => marks.map((entry,at) => at === index ? {...entry,keyframes} : entry)); },
      onSeek(time) { if (element === video) video.currentTime = time; },
      paintPreview(context, transformedMark) {
        if (video.readyState >= 2) context.drawImage(video,0,0,context.canvas.width,context.canvas.height);
        if (transformedMark) drawMark(context,transformedMark);
      },
    });
  }

  function openFile() {
    if (mounted) filePicker.click();
  }

  function updateMarks(update) {
    const current = item();
    if (!current) return;
    current.undo.push(current.marks);
    if (current.undo.length > 60) current.undo.shift();
    current.redo.length = 0;
    current.marks = update(current.marks);
    marksChanged();
  }

  function marksChanged() {
    dirty = true;
    redraw();
    renderControls();
    renderCues();
  }

  function history(source,destination) {
    const current = item();
    if (!current?.[source].length) return;
    current[destination].push(current.marks);
    current.marks = current[source].pop();
    marksChanged();
  }

  function removeClip() {
    const removeIndex = activeIndex;
    const current = item();
    if (!current) return;
    const url = current.url;
    setActive(-1);
    items.splice(removeIndex,1);
    dirty = true;
    URL.revokeObjectURL(url);
    urls.delete(url);
    setActive(items.length ? Math.min(removeIndex, items.length - 1) : -1);
  }

  function download(blob,current,suffix) {
    if (!mounted) return;
    const url = URL.createObjectURL(blob);
    urls.add(url);
    const name = current.name.replace(/\.[^.]+$/,'') || 'touchline';
    const link = Object.assign(document.createElement('a'),{href:url,download:`${name}-${suffix}`});
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      urls.delete(url);
    },1000);
  }

  function exportVideo() {
    if (recording) {
      const stop = recording;
      stop(true);
      report('Video export cancelled.');
      return;
    }
    const current = item();
    if (current?.kind !== 'video' || surface.hidden) return;
    const output = document.createElement('canvas');
    const mime = ['video/mp4','video/webm;codecs=vp8,opus','video/webm']
      .find(type => globalThis.MediaRecorder?.isTypeSupported(type));
    if (!mime || !output.captureStream) {
      report('This browser supports frame export only.');
      return;
    }
    element.pause();
    output.width = canvas.width;
    output.height = canvas.height;
    const outputContext = output.getContext('2d');
    const stream = output.captureStream(30);
    const source = document.createElement('video');
    source.playsInline = true;
    source.preload = 'auto';
    const marks = annotationsVisible ? current.marks : [];
    const chunks = [];
    const recorderEvents = new AbortController();
    const { signal } = recorderEvents;
    let audio;
    // Route the source track into the recording and keep its playback off the speakers.
    source.muted = true;
    const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (Audio) {
      try {
        audio = new Audio();
        const destination = audio.createMediaStreamDestination();
        audio.createMediaElementSource(source).connect(destination);
        const [track] = destination.stream.getAudioTracks();
        if (track) {
          stream.addTrack(track);
          source.muted = false;
          void audio.resume().catch(() => {});
        }
      } catch {
        source.muted = true;
      }
    }
    let recorder, frameId, cancelled = false;
    let waitTimer;

    function cleanup() {
      clearTimeout(waitTimer);
      recorderEvents.abort();
      source.pause();
      if (frameId != null) {
        if (source.cancelVideoFrameCallback) source.cancelVideoFrameCallback(frameId);
        else cancelAnimationFrame(frameId);
      }
      source.removeAttribute('src');
      source.load();
      stream.getTracks().forEach(track => track.stop());
      if (audio?.state !== 'closed') void audio?.close().catch(() => {});
      recording = null;
      if (mounted) renderControls();
    }

    function finish(cancel) {
      if (signal.aborted) return;
      if (cancel) cancelled = true;
      if (recorder?.state === 'recording') {
        recorder.stop();
        if (!cancel) {
          clearTimeout(waitTimer);
          waitTimer = setTimeout(cleanup,3000);
          return;
        }
      }
      cleanup();
    }

    function paint() {
      if (signal.aborted) return;
      outputContext.drawImage(source,0,0,output.width,output.height);
      drawOverlay(outputContext,marks,source.currentTime);
      frameId = source.requestVideoFrameCallback
        ? source.requestVideoFrameCallback(paint) : requestAnimationFrame(paint);
    }

    function fail() {
      if (!signal.aborted) {
        finish(true);
        if (mounted) report('The clip could not be exported. Try exporting a frame.');
      }
    }

    recording = finish;
    renderControls();
    report('Exporting video in real time. Keep this tab open.');
    waitTimer = setTimeout(fail,15000);
    source.addEventListener('error',fail,{signal,once:true});
    source.addEventListener('ended',() => finish(false),{signal,once:true});
    source.addEventListener('playing',() => {
      try {
        clearTimeout(waitTimer);
        recorder = new MediaRecorder(stream,{mimeType:mime});
        recorder.ondataavailable = ({data}) => { if (data.size) chunks.push(data); };
        recorder.onstop = () => {
          if (!signal.aborted) cleanup();
          if (cancelled || !mounted) return;
          if (!chunks.length) return report('The recorded clip was empty.');
          const extension = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
          download(new Blob(chunks,{type:mime}),current,`annotated.${extension}`);
          report('Video exported.');
        };
        recorder.onerror = fail;
        paint();
        recorder.start();
      } catch { fail(); }
    },{signal,once:true});
    source.src = current.url;
    void source.play().catch(fail);
  }

  function exportFrame() {
    const current = item();
    if (!element || !current || surface.hidden || (element.tagName === 'VIDEO' && (element.readyState < 2 || element.seeking))) {
      report('Wait for the frame to load.');
      return;
    }
    if (isPlaying) element.pause();
    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    const outputContext = output.getContext('2d');
    outputContext.drawImage(element,0,0,output.width,output.height);
    if (annotationsVisible) drawOverlay(outputContext,current.marks,element.currentTime ?? 0);
    output.toBlob(blob => {
      if (!mounted) return;
      if (!blob) return report('This frame could not be exported.');
      download(blob,current,'frame.png');
      report('Frame exported');
    },'image/png');
  }

  function point(event) {
    const bounds = canvas.getBoundingClientRect();
    const x = Math.max(0,Math.min(bounds.width,event.clientX-bounds.left));
    const y = Math.max(0,Math.min(bounds.height,event.clientY-bounds.top));
    return { x:x * canvas.width / bounds.width, y:y * canvas.height / bounds.height };
  }

  container.addEventListener('click',event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    const {mediaTool,mediaColor,mediaAction,mediaIndex,mediaCue,mediaCueMode,mediaProject,mediaProjectDelete} = button.dataset;
    if (mediaProject) return void loadProject(mediaProject);
    if (mediaProjectDelete && !projectBusy) {
      if (!window.confirm('Remove this saved media project from this device?')) return;
      return void runProjectOperation(async () => {
        await deleteMediaProject(mediaProjectDelete);
        if (!mounted) return;
        if (project?.id === mediaProjectDelete) {
          project = null;
          dirty = Boolean(items.length);
          syncProjectForm();
        }
        await refreshProjectList();
        projectFeedback.textContent = 'Project removed.';
      });
    }
    if (mediaTool) {
      pickingMotion = false;
      tool = mediaTool;
      morePanel.hidden = true;
      renderControls();
    }
    if (mediaCue != null) {
      const index = Number(mediaCue);
      const mark = item()?.marks[index];
      if (!mark || element?.tagName !== 'VIDEO') return;
      if (mediaCueMode === 'motion') {
        element.currentTime = mark.keyframes[0].time;
        showMotion(index);
      } else {
        element.currentTime = mark.timing.start;
        showTiming(index);
      }
    }
    if (mediaColor) {
      color = mediaColor;
      $('.media-picker input').value = color;
      renderControls();
    }
    if (mediaIndex != null) setActive(Number(mediaIndex));
    switch (mediaAction) {
      case 'home':
        if (!dirty || window.confirm('Return home and discard unsaved changes to this media project?')) goHome?.();
        break;
      case 'projects':
        void showProjects();
        break;
      case 'close-projects':
        if (!projectBusy) projectDialog.close();
        break;
      case 'animate':
        pickingMotion = !pickingMotion;
        if (pickingMotion) {
          element?.pause?.();
          if (!annotationsVisible) {
            annotationsVisible = true;
            redraw();
          }
        }
        renderControls();
        break;
      case 'add':
        openFile();
        break;
      case 'remove':
        removeClip();
        break;
      case 'play':
        if (element?.tagName !== 'VIDEO') break;
        if (isPlaying) element.pause();
        else element.play().catch(() => report('Could not start video playback.'));
        break;
      case 'speed': {
        if (element?.tagName !== 'VIDEO') break;
        const speeds = [.5,1,1.5,2];
        const next = (speeds.indexOf(element.playbackRate) + 1) % speeds.length;
        element.playbackRate = speeds[next];
        break;
      }
      case 'back-frame':
      case 'next-frame':
        if (element?.tagName === 'VIDEO') {
          element.pause();
          const step = mediaAction === 'back-frame' ? -1/30 : 1/30;
          element.currentTime = Math.max(0,Math.min(element.duration,element.currentTime+step));
        }
        break;
      case 'more':
        morePanel.hidden = !morePanel.hidden;
        timingPanel.hidden = true;
        renderControls();
        break;
      case 'dash':
        dashed = !dashed;
        renderControls();
        break;
      case 'timing':
        if (timingPanel.hidden) showTiming();
        else timingPanel.hidden = true;
        break;
      case 'cancel-timing':
        timingPanel.hidden = true;
        break;
      case 'whole':
        saveTiming(null);
        break;
      case 'cancel-text':
        textDialog.close();
        break;
      case 'export':
        exportFrame();
        break;
      case 'export-video':
        exportVideo();
        break;
      case 'undo':
        history('undo','redo');
        break;
      case 'redo':
        history('redo','undo');
        break;
      case 'clear':
        if (item()?.marks.length) updateMarks(() => []);
        break;
      case 'visibility':
        annotationsVisible = !annotationsVisible;
        redraw();
        renderControls();
        break;
    }
  },{signal});
  projectDialog.addEventListener('cancel',event => { if (projectBusy) event.preventDefault(); },{signal});
  projectForm.addEventListener('submit',event => {
    event.preventDefault();
    const title = projectForm.elements.title.value.trim();
    const id = event.submitter?.value === 'copy' ? undefined : project?.id;
    if (!title || !items.length) return;
    void runProjectOperation(async () => {
      projectFeedback.textContent = 'Saving clips and annotations…';
      const clips = items.map(({file,kind,name,time,marks},index) => ({
        file,kind,name,marks,time:index === activeIndex && element?.tagName === 'VIDEO' ? element.currentTime : time,
      }));
      const saved = await saveMediaProject({id,title,clips,activeIndex});
      if (!mounted) return;
      project = saved;
      dirty = false;
      syncProjectForm();
      $('#mediaFileTitle').textContent = saved.title + ' · ' + item().name;
      await refreshProjectList();
      projectFeedback.textContent = 'Project saved on this device.';
    });
  },{signal});
  timingPanel.addEventListener('submit',event => {
    event.preventDefault();
    const start = Number($('.media-time-start').value);
    const end = Number($('.media-time-end').value);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > element.duration + .01) {
      report('Choose an end time later than the start.');
      return;
    }
    saveTiming({start,end:Math.min(end,element.duration)});
  },{signal});
  textDialog.addEventListener('submit',event => {
    event.preventDefault();
    const value = $('.media-text-value').value.trim();
    if (!value || !textMark) return;
    const mark = {...textMark,text:value};
    updateMarks(marks => [...marks,mark]);
    textDialog.close();
  },{signal});
  textDialog.addEventListener('close',() => { textMark = null; },{signal});
  $('.media-width select').addEventListener('change',event => { drawingWidth = Number(event.target.value); },{signal});
  $('.media-picker input').addEventListener('input',event => { color = event.target.value; renderControls(); },{signal});
  container.addEventListener('keydown',event => {
    if (event.key !== 'Escape' || textDialog.open) return;
    if (pickingMotion) { pickingMotion = false; renderControls(); }
    else if (!timingPanel.hidden) timingPanel.hidden = true;
    else if (!morePanel.hidden) { morePanel.hidden = true; renderControls(); }
  },{signal});
  filePicker.addEventListener('change',() => {
    addFiles(filePicker.files);
    filePicker.value = '';
  },{signal});
  timeline.addEventListener('input',() => {
    if (element?.tagName === 'VIDEO') element.currentTime = Number(timeline.value);
  },{signal});
  $('.media-viewport').addEventListener('dragover',event => event.preventDefault(),{signal});
  $('.media-viewport').addEventListener('drop',event => {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  },{signal});

  canvas.addEventListener('pointerdown',event => {
    if (!event.isPrimary || event.button !== 0 || !item()) return;
    const start = point(event);
    if (isPlaying) element.pause();
    if (tool === 'erase' || pickingMotion) {
      if (!annotationsVisible) return;
      const time = element.currentTime ?? 0;
      const index = item().marks.findLastIndex(mark => visibleAt(mark,time) &&
        hitsMark(applyMediaKeyframe(mark,time,canvas.width,canvas.height),start));
      if (index >= 0 && pickingMotion) showMotion(index);
      else if (index >= 0) updateMarks(marks => marks.filter((_,position) => position !== index));
      else if (pickingMotion) report('Choose a visible annotation on the frame.');
      return;
    }
    if (item().marks.length >= 3000) return report('This clip has reached 3,000 annotations.');
    const current = item();
    const scale = Math.max(1,Math.min(canvas.width,canvas.height)/520);
    const timing = timed && timingForNewMark ? {...timingForNewMark} : null;
    const radius = (tool === 'spotlight' ? 56 : tool === 'highlight' ? 30 : 19)*scale;
    const mark = {type:tool,color,points:[start],radius,width:drawingWidth*scale,dashed,scale,timing,
      pixelRatio:current.width/canvas.width};
    annotationsVisible = true;
    if (tool === 'text') {
      textMark = mark;
      $('.media-text-value').value = '';
      textDialog.showModal();
      $('.media-text-value').focus();
      return;
    }
    if (tool === 'number') {
      mark.text = String(1+Math.max(0,...current.marks.filter(mark => mark.type === 'number').map(mark => Number(mark.text))));
      updateMarks(marks => [...marks,mark]);
      return;
    }
    activePointer = event.pointerId;
    canvas.setPointerCapture(activePointer);
    draft = mark;
    redraw();
  },{signal});
  canvas.addEventListener('pointermove',event => {
    if (!draft || event.pointerId !== activePointer) return;
    const next = point(event);
    const last = draft.points.at(-1);
    if (Math.hypot(next.x-last.x,next.y-last.y) < 2) return;
    if (continuousTools.has(draft.type)) {
      if (draft.points.length < 12000) draft.points.push(next);
    } else draft.points[1] = next;
    redraw();
  },{signal});
  function finish(event) {
    if (!draft || event.pointerId !== activePointer) return;
    const mark = draft;
    const save = event.type === 'pointerup' && (mark.points.length > 1 || pointTools.has(mark.type));
    draft = null;
    activePointer = null;
    if (save) updateMarks(marks => [...marks, mark]);
    else redraw();
  }
  for (const type of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(type,finish,{signal});

  const observer = new ResizeObserver(fitSurface);
  observer.observe($('.media-viewport'));
  setActive(-1);

  return {
    openFile,
    openProjects:showProjects,
    cleanup() {
      mounted = false;
      recording?.(true);
      cancelVideoFrame();
      if (element?.tagName === 'VIDEO') element.pause();
      listenerController.abort();
      mediaEvents?.abort();
      observer.disconnect();
      clearTimeout(statusTimer);
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
      container.replaceChildren();
      container.classList.remove('media-screen');
    },
  };
}

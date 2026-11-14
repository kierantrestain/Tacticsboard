const iconPaths = {
  back: '<path d="m13 5-7 7 7 7m-7-7h13"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  arrow: '<path d="M5 19 19 5m-9 0h9v9"/>',
  line: '<path d="M5 19 19 5"/>',
  pen: '<path d="M3 17c2-9 4-9 7-3s5 6 11-7"/>',
  highlight: '<circle cx="12" cy="12" r="7"/>',
  zone: '<rect x="4" y="5" width="16" height="14" rx="2" stroke-dasharray="3 3"/>',
  erase: '<path d="m6 16 6 5h5m-7-3 10-11-5-5L4 14zm0-9 5 5"/>',
  undo: '<path d="M4 11h10a5 5 0 1 1 0 10h-3m-2-15-5 5 5 5"/>',
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
  erase: ['Eraser', 'Click an annotation to erase it.'],
};
const colors = { Cyan: '#22ebfa', White: '#f7faf7', Yellow: '#f9d226' };

function icon(name) {
  return `<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;
}

function action(name, title, iconName = name) {
  return `<button class="media-button" data-media-action="${name}" title="${title}" aria-label="${title}">${icon(iconName)}<span>${title}</span></button>`;
}

function drawMark(context, mark) {
  const from = mark.points[0];
  const to = mark.points.at(-1);
  context.lineWidth = 3.25;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = mark.color;
  context.fillStyle = mark.color;
  if (mark.type === 'zone' || mark.type === 'highlight') {
    context.beginPath();
    if (mark.type === 'zone') context.rect(from.x, from.y, to.x - from.x, to.y - from.y);
    else context.arc(from.x, from.y, mark.points.length === 1 ? mark.radius : Math.max(5, Math.hypot(to.x - from.x, to.y - from.y)), 0, 2 * Math.PI);
    context.globalAlpha = .23;
    context.fill();
    context.globalAlpha = .85;
    context.stroke();
    context.globalAlpha = 1;
    return;
  }

  context.beginPath();
  context.moveTo(from.x, from.y);
  for (const point of mark.points.slice(1)) context.lineTo(point.x, point.y);
  if (mark.type === 'arrow') {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    if (distance < 2) return;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const size = Math.min(15, distance / 2);
    const wing = turn => [to.x - size * Math.cos(angle + turn), to.y - size * Math.sin(angle + turn)];
    context.moveTo(...wing(-.55));
    context.lineTo(to.x, to.y);
    context.lineTo(...wing(.55));
  }
  context.stroke();
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
  if (mark.type === 'zone') {
    return point.x >= Math.min(from.x, to.x) && point.x <= Math.max(from.x, to.x) &&
      point.y >= Math.min(from.y, to.y) && point.y <= Math.max(from.y, to.y);
  }
  if (mark.type === 'highlight') {
    const radius = mark.points.length === 1 ? mark.radius : Math.hypot(to.x - from.x, to.y - from.y);
    return Math.hypot(point.x - from.x, point.y - from.y) <= Math.max(5,radius) + 4;
  }
  return mark.points.slice(1).some((end, index) => distanceToSegment(point, mark.points[index], end) <= 13);
}

function showTimestamp(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
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
  let statusTimer;
  let mediaEvents;
  let mounted = true;
  container.classList.add('media-screen');
  container.innerHTML = `
    <header class="media-top">
      <div class="media-title">${action('home','Back to home','back')}<h1>Media Draw</h1></div>
      <p id="mediaFileTitle">Local footage</p>
      <div class="media-top-actions">${action('add','Add media','plus')}${action('export','Export frame','download')}</div>
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
          ${action('play','Play','play')}
          <time>0:00 / 0:00</time>
          <input type="range" class="media-seek" aria-label="Video position" min="0" max="0" step="0.05" value="0">
          <button class="media-speed" data-media-action="speed" aria-label="Playback speed">1×</button>
        </div>
      </main>
    </div>
    <footer class="media-tools">
      <div class="media-draw-tools" aria-label="Annotation tools"></div>
      <div class="media-colors" aria-label="Annotation colors"></div>
      <div class="media-edit-tools">${action('visibility','Hide annotations','eye')}${action('undo','Undo')}${action('clear','Clear annotations','trash')}</div>
      <p class="media-tool-hint">Drag to show a pass.</p>
    </footer>
    <p class="media-status" role="status" hidden></p>
    <input class="media-files" type="file" accept="image/*,video/*" multiple hidden>
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
  const item = () => items[activeIndex];

  $('.media-draw-tools').innerHTML = Object.entries(drawTools).map(([key, [name]]) =>
    `<button class="media-button" data-media-tool="${key}" aria-pressed="false" title="${name}">${icon(key)}<span>${name}</span></button>`).join('');
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
    $('[data-media-action=remove]').disabled = !current;
    $('[data-media-action=undo]').disabled = !current?.undo.length;
    $('[data-media-action=clear]').disabled = !current?.marks.length;
    $('[data-media-action=visibility]').disabled = !current?.marks.length;
    $('[data-media-action=visibility]').setAttribute('aria-pressed', String(!annotationsVisible));
    const visibilityText = annotationsVisible ? 'Hide annotations' : 'Show annotations';
    $('[data-media-action=visibility]').setAttribute('aria-label', visibilityText);
    $('[data-media-action=visibility]').title = visibilityText;
    $('.media-tool-hint').textContent = drawTools[tool][1];
  }

  function redraw() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (annotationsVisible) item()?.marks.forEach(mark => drawMark(context, mark));
    if (draft) drawMark(context, draft);
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

  function syncTime() {
    if (element?.tagName !== 'VIDEO') return;
    const duration = Number.isFinite(element.duration) ? element.duration : 0;
    timeline.max = duration;
    timeline.value = element.currentTime;
    timeline.disabled = !duration;
    playback.querySelector('time').textContent = `${showTimestamp(element.currentTime)} / ${showTimestamp(duration)}`;
    $('.media-speed').textContent = `${element.playbackRate}×`;
    isPlaying = !element.paused && !element.ended;
    const name = isPlaying ? 'Pause' : 'Play';
    playButton.innerHTML = icon(isPlaying ? 'pause' : 'play') + '<span>' + name + '</span>';
    playButton.setAttribute('aria-label', name);
    playButton.title = name;
  }

  function setActive(index) {
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
    element = null;
    elementSlot.replaceChildren();
    surface.hidden = true;
    playback.hidden = true;
    $('.media-empty').hidden = Boolean(current);
    $('#mediaFileTitle').textContent = current?.name ?? 'Local footage';
    renderRail();
    renderControls();
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
        element.currentTime = current.time;
        syncTime();
      }
      fitSurface();
      renderControls();
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
      for (const name of ['play','pause','timeupdate','durationchange','ratechange','ended']) {
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
      let kind;
      if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(file.name)) kind = 'image';
      else if (file.type.startsWith('video/') || /\.(mp4|webm|m4v|mov)$/i.test(file.name)) kind = 'video';
      else continue;
      const url = URL.createObjectURL(file);
      urls.add(url);
      items.push({ url, kind, name:file.name, time:0, marks:[], undo:[] });
    }
    if (items.length > next) setActive(next);
    else if (files.length) report('Choose a supported image or video file.');
  }

  function openFile() {
    if (mounted) filePicker.click();
  }

  function updateMarks(update) {
    const current = item();
    if (!current) return;
    current.undo.push(current.marks);
    if (current.undo.length > 60) current.undo.shift();
    current.marks = update(current.marks);
    redraw();
    renderControls();
  }

  function removeClip() {
    const removeIndex = activeIndex;
    const current = item();
    if (!current) return;
    const url = current.url;
    setActive(-1);
    items.splice(removeIndex,1);
    URL.revokeObjectURL(url);
    urls.delete(url);
    setActive(items.length ? Math.min(removeIndex, items.length - 1) : -1);
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
    if (annotationsVisible) current.marks.forEach(mark => drawMark(outputContext,mark));
    output.toBlob(blob => {
      if (!mounted) return;
      if (!blob) return report('This frame could not be exported.');
      const url = URL.createObjectURL(blob);
      urls.add(url);
      const name = current.name.replace(/\.[^.]+$/,'') || 'touchline';
      const link = Object.assign(document.createElement('a'),{href:url,download:`${name}-frame.png`});
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        urls.delete(url);
      },1000);
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
    const {mediaTool,mediaColor,mediaAction,mediaIndex} = button.dataset;
    if (mediaTool) {
      tool = mediaTool;
      renderControls();
    }
    if (mediaColor) {
      color = mediaColor;
      renderControls();
    }
    if (mediaIndex != null) setActive(Number(mediaIndex));
    switch (mediaAction) {
      case 'home':
        goHome?.();
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
      case 'export':
        exportFrame();
        break;
      case 'undo':
        if (item()?.undo.length) {
          item().marks = item().undo.pop();
          redraw();
          renderControls();
        }
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
    if (tool === 'erase') {
      if (!annotationsVisible) return;
      const index = item().marks.findLastIndex(mark => hitsMark(mark,start));
      if (index >= 0) updateMarks(marks => marks.filter((_,position) => position !== index));
      return;
    }
    annotationsVisible = true;
    activePointer = event.pointerId;
    canvas.setPointerCapture(activePointer);
    draft = {type:tool,color,points:[start],radius:Math.max(15, Math.min(canvas.width,canvas.height) / 14)};
    redraw();
  },{signal});
  canvas.addEventListener('pointermove',event => {
    if (!draft || event.pointerId !== activePointer) return;
    const next = point(event);
    const last = draft.points.at(-1);
    if (Math.hypot(next.x-last.x,next.y-last.y) < 2) return;
    if (draft.type === 'pen') draft.points.push(next);
    else draft.points[1] = next;
    redraw();
  },{signal});
  function finish(event) {
    if (!draft || event.pointerId !== activePointer) return;
    const mark = draft;
    const save = event.type === 'pointerup' && (mark.points.length > 1 || mark.type === 'highlight');
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
    cleanup() {
      mounted = false;
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

const identity = Object.freeze({x:0,y:0,scale:1});
const maximumFrames = 120;
const maximumTime = 86400;
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const radialMarks = new Set(['highlight','spotlight','target','number','cross','fov','text']);

export function validMediaKeyframes(frames) {
  if (frames == null) return true;
  if (!Array.isArray(frames) || frames.length > maximumFrames) return false;
  let previous = -1;
  return frames.every(frame => {
    if (!frame || !Number.isFinite(frame.time) || frame.time < 0 || frame.time > maximumTime || frame.time <= previous ||
        !Number.isFinite(frame.x) || Math.abs(frame.x) > 1 || !Number.isFinite(frame.y) || Math.abs(frame.y) > 1 ||
        !Number.isFinite(frame.scale) || frame.scale < .25 || frame.scale > 4) return false;
    previous = frame.time;
    return true;
  });
}

export function mediaTransformAt(frames,time,start = 0) {
  if (!frames?.length || !Number.isFinite(time)) return identity;
  const first = frames[0];
  const beginning = Math.min(first.time,Math.max(0,start));
  const baseline = beginning < first.time ? {...identity,time:beginning} : null;
  if (time < beginning) return identity;
  if (time === first.time) return transform(first);
  if (time < first.time) return interpolate(baseline,first,null,frames[1],time);
  const last = frames.at(-1);
  if (time >= last.time) return transform(last);

  let lower = 0;
  let upper = frames.length - 1;
  while (upper - lower > 1) {
    const middle = (upper + lower) >> 1;
    if (frames[middle].time <= time) lower = middle;
    else upper = middle;
  }
  return interpolate(frames[lower],frames[upper],frames[lower - 1] ?? baseline,frames[upper + 1],time);
}

function transform({x,y,scale}) {
  return {x,y,scale};
}

function tangent(previous, current, previousDuration, duration) {
  if (previous * current <= 0) return 0;
  const leftWeight = (2 * duration + previousDuration) / (3 * (previousDuration + duration));
  return 1 / (leftWeight / previous + (1 - leftWeight) / current);
}

function interpolate(from,to,previous,next,time) {
  const duration = to.time - from.time;
  const t = (time - from.time) / duration;
  const position = t * t * (3 - 2 * t);
  function component(key) {
    const delta = (to[key] - from[key]) / duration;
    const pastTime = previous ? from.time - previous.time : 0;
    const nextTime = next ? next.time - to.time : 0;
    const start = previous ? tangent((from[key] - previous[key]) / pastTime,delta,pastTime,duration) : 0;
    const end = next ? tangent(delta,(next[key] - to[key]) / nextTime,duration,nextTime) : 0;
    const value = from[key] + (to[key] - from[key]) * position +
      duration * (start * t * (1 - t) ** 2 - end * t * t * (1 - t));
    return clamp(value,Math.min(from[key],to[key]),Math.max(from[key],to[key]));
  }
  return {x:component('x'),y:component('y'),scale:component('scale')};
}

function markAnchor(mark) {
  if (radialMarks.has(mark.type)) return mark.points[0];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const {x,y} of mark.points) {
    minX = Math.min(minX,x);
    minY = Math.min(minY,y);
    maxX = Math.max(maxX,x);
    maxY = Math.max(maxY,y);
  }
  return {x:(minX+maxX)/2,y:(minY+maxY)/2};
}

export function applyMediaKeyframe(mark,time,width,height) {
  const {x,y,scale} = mediaTransformAt(mark.keyframes,time,mark.timing?.start ?? 0);
  if (x === 0 && y === 0 && scale === 1 || !mark.points?.length) return mark;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return mark;
  const anchor = markAnchor(mark);
  const dx = x * width;
  const dy = y * height;
  return {
    ...mark,
    points:mark.points.map(point => ({
      ...point,
      x:anchor.x + (point.x - anchor.x) * scale + dx,
      y:anchor.y + (point.y - anchor.y) * scale + dy,
    })),
    width:(mark.width ?? 4) * scale,
    radius:(mark.radius ?? 19) * scale,
    scale:(mark.scale ?? 1) * scale,
  };
}

function rounded(value,precision = 1000) {
  return Math.round(value * precision) / precision;
}

export function openMediaKeyframeEditor({container,mark,time,duration,width,height,onSave,onSeek,paintPreview}) {
  const doc = container.ownerDocument;
  const dialog = doc.createElement('dialog');
  dialog.className = 'media-text-dialog media-keyframe-dialog';
  dialog.setAttribute('aria-label','Annotation keyframes');
  const minimum = clamp(mark.timing?.start ?? 0,0,maximumTime);
  const length = Number.isFinite(duration) ? duration : maximumTime;
  const maximum = Math.max(minimum,Math.min(length,mark.timing?.end ?? maximumTime,maximumTime));
  let frames = (mark.keyframes ?? []).map(frame => ({...frame}));
  dialog.innerHTML = `<form method="dialog">
    <h2>Annotation keyframes</h2>
    <p class="media-motion-hint">Set a position and size at two or more times. The annotation moves smoothly between them.</p>
    <label>Time (seconds)<input type="number" name="time" step="any" required></label>
    <div class="media-timing-controls">
      <label>Across (%)<input type="number" name="x" min="-100" max="100" step="any" required></label>
      <label>Down (%)<input type="number" name="y" min="-100" max="100" step="any" required></label>
      <label>Size (%)<input type="number" name="scale" min="25" max="400" step="any" required></label>
    </div>
    <canvas aria-label="Drag the annotation preview to position it"></canvas>
    <div class="media-timing-actions"><button type="button" class="media-button" data-motion-add>Add keyframe</button></div>
    <div class="media-motion-list" aria-label="Saved keyframes"></div>
    <p role="status" class="media-motion-status"></p>
    <div class="media-timing-actions">
      <button type="button" class="media-button" data-motion-cancel>Cancel</button>
      <button type="submit" class="media-button media-primary">Save motion</button>
    </div>
  </form>`;
  dialog.style.width = 'min(530px, calc(100vw - 28px))';
  const form = dialog.querySelector('form');
  const fields = form.elements;
  const list = dialog.querySelector('.media-motion-list');
  const status = dialog.querySelector('.media-motion-status');
  const preview = dialog.querySelector('canvas');
  preview.width = Number.isFinite(width) && width > 0 ? width : 640;
  preview.height = Number.isFinite(height) && height > 0 ? height : 360;
  preview.style.cssText = 'width:100%;max-height:25vh;object-fit:contain;touch-action:none;cursor:grab;border:1px solid #48715b;border-radius:6px;background:#16291f';
  list.style.cssText = 'display:grid;gap:4px;max-height:105px;overflow:auto';
  status.style.cssText = 'min-height:1em;font-size:11px';
  const context = preview.getContext('2d');
  let drag;
  let repaint;
  let focusedTime = null;
  let changedTransform = false;

  function read() {
    const timeValue = Number(fields.time.value);
    const picked = clamp(timeValue,minimum,maximum);
    return {
      time:clamp(rounded(picked),minimum,maximum),
      x:clamp(Number(fields.x.value)/100,-1,1),
      y:clamp(Number(fields.y.value)/100,-1,1),
      scale:clamp(Number(fields.scale.value)/100,.25,4),
    };
  }

  function display(frame) {
    changedTransform = false;
    fields.time.value = frame.time;
    fields.x.value = rounded(frame.x * 100,100);
    fields.y.value = rounded(frame.y * 100,100);
    fields.scale.value = rounded(frame.scale * 100,100);
    draw();
  }

  function draw() {
    if (!context) return;
    const state = read();
    const rendered = applyMediaKeyframe({...mark,keyframes:[{...state,time:0}]},0,preview.width,preview.height);
    context.clearRect(0,0,preview.width,preview.height);
    if (paintPreview) {
      paintPreview(context,rendered,state.time);
    } else if (rendered.points?.length) {
      const {x,y} = markAnchor(rendered);
      const radius = Math.max(8,13 * state.scale);
      context.beginPath();
      context.arc(x,y,radius,0,Math.PI*2);
      context.moveTo(x-radius*1.4,y);
      context.lineTo(x+radius*1.4,y);
      context.moveTo(x,y-radius*1.4);
      context.lineTo(x,y+radius*1.4);
      context.strokeStyle = mark.color ?? '#75e299';
      context.lineWidth = Math.max(2,preview.width/170);
      context.stroke();
    }
  }

  function refreshPreview() {
    draw();
    if (paintPreview) {
      clearTimeout(repaint);
      repaint = setTimeout(draw,180);
    }
  }

  function seek(at) {
    const pending = onSeek?.(at);
    if (pending?.then) void Promise.resolve(pending).then(() => { if (dialog.open) draw(); }, () => {});
    refreshPreview();
  }

  function displayList() {
    list.replaceChildren();
    for (const [index,frame] of frames.entries()) {
      const row = doc.createElement('div');
      row.className = 'media-timing-controls';
      const edit = doc.createElement('button');
      edit.type = 'button';
      edit.className = 'media-button';
      edit.textContent = `${frame.time.toFixed(2)} s · ${Math.round(frame.x*100)}%, ${Math.round(frame.y*100)}% · ${Math.round(frame.scale*100)}%`;
      edit.addEventListener('click',() => {
        focusedTime = frame.time;
        display(frame);
        seek(frame.time);
      });
      const remove = doc.createElement('button');
      remove.type = 'button';
      remove.className = 'media-button';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label',`Remove keyframe at ${frame.time.toFixed(2)} seconds`);
      remove.addEventListener('click',() => {
        frames = frames.filter((_,position) => index !== position);
        if (focusedTime === frame.time) focusedTime = null;
        displayList();
        status.textContent = 'Keyframe removed.';
      });
      row.append(edit,remove);
      list.append(row);
    }
    dialog.querySelector('[data-motion-add]').textContent = focusedTime == null ? 'Add keyframe' : 'Update keyframe';
  }

  function upsert() {
    if (!form.reportValidity()) return false;
    const frame = read();
    const next = frames.filter(item => item.time !== frame.time && item.time !== focusedTime);
    if (next.length >= maximumFrames) {
      status.textContent = 'This annotation already has 120 keyframes.';
      return false;
    }
    frames = [...next,frame].sort((a,b) => a.time - b.time);
    focusedTime = null;
    changedTransform = false;
    displayList();
    status.textContent = `Keyframe set at ${frame.time.toFixed(2)} seconds.`;
    return true;
  }

  fields.time.min = minimum;
  fields.time.max = maximum;
  const firstTime = clamp(rounded(Number.isFinite(time) ? time : minimum),minimum,maximum);
  display({...mediaTransformAt(frames,firstTime,minimum),time:firstTime});

  fields.time.addEventListener('change',() => {
    if (!fields.time.checkValidity()) return;
    focusedTime = null;
    const at = read().time;
    if (!changedTransform) display({...mediaTransformAt(frames,at,minimum),time:at});
    displayList();
    seek(at);
  });
  form.addEventListener('input',event => {
    if (event.target === fields.time) return;
    changedTransform = true;
    draw();
  });
  dialog.querySelector('[data-motion-add]').addEventListener('click',upsert);
  dialog.querySelector('[data-motion-cancel]').addEventListener('click',() => dialog.close());
  form.addEventListener('submit',event => {
    event.preventDefault();
    if (changedTransform && !upsert()) return;
    onSave?.(frames);
    dialog.close();
  });

  preview.addEventListener('pointerdown',event => {
    if (!event.isPrimary || event.button !== 0) return;
    const start = read();
    const rect = preview.getBoundingClientRect();
    const scale = Math.min(rect.width / preview.width,rect.height / preview.height);
    if (!scale) return;
    drag = {id:event.pointerId,x:event.clientX,y:event.clientY,start,scale};
    preview.setPointerCapture(event.pointerId);
    preview.style.cursor = 'grabbing';
  });
  preview.addEventListener('pointermove',event => {
    if (!drag || event.pointerId !== drag.id) return;
    fields.x.value = rounded(100 * clamp(drag.start.x + (event.clientX-drag.x) / (preview.width * drag.scale),-1,1),100);
    fields.y.value = rounded(100 * clamp(drag.start.y + (event.clientY-drag.y) / (preview.height * drag.scale),-1,1),100);
    changedTransform = true;
    draw();
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) {
    preview.addEventListener(type,() => {
      drag = null;
      preview.style.cursor = 'grab';
    });
  }

  dialog.addEventListener('close',() => {
    clearTimeout(repaint);
    dialog.remove();
  },{once:true});
  displayList();
  container.append(dialog);
  dialog.showModal();
  return dialog;
}

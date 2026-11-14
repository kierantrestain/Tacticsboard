export const fullPitchBounds = Object.freeze({x:0,y:0,width:1000,height:625});
export const halfPitchBounds = Object.freeze({x:482,y:0,width:518,height:625});
export const cameraLimits = Object.freeze({minZoom:1,maxZoom:3});

const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const mix = (from,to,t) => from + (to - from) * t;

function checkedBounds(base) {
  if (!base || ![base.x,base.y,base.width,base.height].every(Number.isFinite) ||
      base.width <= 0 || base.height <= 0) return fullPitchBounds;
  return base;
}

export function validCamera(camera) {
  return Boolean(camera && Number.isFinite(camera.x) && Number.isFinite(camera.y) &&
    Number.isFinite(camera.zoom) && camera.x >= 0 && camera.x <= fullPitchBounds.width &&
    camera.y >= 0 && camera.y <= fullPitchBounds.height &&
    camera.zoom >= cameraLimits.minZoom && camera.zoom <= cameraLimits.maxZoom);
}

export function clampCamera(camera, bounds = fullPitchBounds) {
  const base = checkedBounds(bounds);
  const zoom = clamp(Number.isFinite(camera?.zoom) ? camera.zoom : 1,cameraLimits.minZoom,cameraLimits.maxZoom);
  const halfWidth = base.width / zoom / 2;
  const halfHeight = base.height / zoom / 2;
  const x = Number.isFinite(camera?.x) ? camera.x : base.x + base.width / 2;
  const y = Number.isFinite(camera?.y) ? camera.y : base.y + base.height / 2;
  return {
    x:clamp(x,base.x + halfWidth,base.x + base.width - halfWidth),
    y:clamp(y,base.y + halfHeight,base.y + base.height - halfHeight),
    zoom,
  };
}

export function cameraBounds(camera, bounds = fullPitchBounds) {
  const base = checkedBounds(bounds);
  const {x,y,zoom} = clampCamera(camera,base);
  const width = base.width / zoom;
  const height = base.height / zoom;
  return {x:x - width / 2,y:y - height / 2,width,height};
}

export function interpolateCamera(from, to, progress, bounds = fullPitchBounds) {
  if (!from && !to) return undefined;
  const first = clampCamera(from,bounds);
  const last = clampCamera(to,bounds);
  const t = clamp(Number.isFinite(progress) ? progress : 0,0,1);
  const eased = t ** 3 * (t * (t * 6 - 15) + 10);

  // Interpolate the visible span, not zoom itself. The four edges then travel
  // with the same easing and stay inside the base frame during combined pans.
  const visible = mix(1 / first.zoom,1 / last.zoom,eased);
  return clampCamera({x:mix(first.x,last.x,eased),y:mix(first.y,last.y,eased),zoom:1 / visible},bounds);
}

export const pitchStyles = Object.freeze([
  Object.freeze({id:'natural',name:'Natural grass',base:'#0e4909',light:'#21731a',dark:'#196613',
    white:'#f2f6ea',shade:'#183314',shine:'#d2e89f',stripes:true}),
  Object.freeze({id:'stadium',name:'Floodlit grass',base:'#123425',light:'#246641',dark:'#1c5338',
    white:'#eff7ef',shade:'#11291e',shine:'#d0efd5',stripes:true}),
  Object.freeze({id:'chalk',name:'Chalkboard',base:'#161f25',light:'#1c2c33',dark:'#1c2c33',
    white:'#e9efed',shade:'#18242b',shine:'#d9e3dc',stripes:false}),
  Object.freeze({id:'training',name:'Training surface',base:'#133545',light:'#235267',dark:'#235267',
    white:'#e8f4fa',shade:'#162b37',shine:'#d2edf6',stripes:false}),
]);

export function getPitchStyle(id) {
  return pitchStyles.find(style => style.id === id) ?? pitchStyles[0];
}

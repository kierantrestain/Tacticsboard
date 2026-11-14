const crestKits = new Map();

function rankedPalette(image) {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d',{willReadFrequently:true});
  context.drawImage(image,0,0,size,size);
  const {data} = context.getImageData(0,0,size,size);
  const groups = new Map();
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 180) continue;
    const r = data[index], g = data[index + 1], b = data[index + 2];
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    const family = [r,g,b].map(value => Math.round(value / 51)).join('');
    const sample = groups.get(family) ?? {red:0,green:0,blue:0,count:0,weight:0};
    sample.red += r;
    sample.green += g;
    sample.blue += b;
    sample.count += 1;
    sample.weight += max - min > 45 ? 1.7 : .65;
    groups.set(family,sample);
  }
  return [...groups.values()].filter(group => group.count >= 8).sort((a,b) => b.weight - a.weight)
    .map(group => {
      const channels = [group.red,group.green,group.blue].map(value => Math.round(value / group.count));
      return {channels,hex:'#' + channels.map(value => value.toString(16).padStart(2,'0')).join('')};
    });
}

export function suggestCrestKit(logo) {
  if (!/^https:\/\/media\.api-sports\.io\/football\/teams\/[1-9]\d*\.png$/.test(logo ?? '')) return Promise.resolve(null);
  if (!crestKits.has(logo)) {
    const pending = new Promise(resolve => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.referrerPolicy = 'no-referrer';
      const timer = setTimeout(() => resolve(null),2500);
      image.onerror = () => { clearTimeout(timer); resolve(null); };
      image.onload = () => {
        clearTimeout(timer);
        try {
          const [primary,...rest] = rankedPalette(image);
          if (!primary) return resolve(null);
          const secondary = rest.find(item => Math.hypot(...item.channels.map((value,index) =>
            value - primary.channels[index])) > 98);
          resolve({primary:primary.hex,secondary:secondary?.hex ?? '#edf1ee',source:'Crest suggestion'});
        } catch { resolve(null); }
      };
      image.src = logo;
    });
    crestKits.set(logo,pending);
  }
  return crestKits.get(logo);
}

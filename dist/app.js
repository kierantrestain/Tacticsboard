import { mountMedia } from './media.js';
import { renderHome } from './home.js';
import { formations, makeLineup, templates } from './data.js';
import { bindBoard, canvasBoard, exportBoard, renderBoard } from './board.js';
import { downloadBoard, initialBoard, interpolateScene, listSavedBoards, loadBoard, makeId, parseBoard, removeSavedBoard, saveBoard, sharedUrl, storeSavedBoard } from './model.js';

const icons = {
  brand:'<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M12 5v14M3 9h4v6H3m18-6h-4v6h4"/><circle cx="12" cy="12" r="3"/>',
  pitch:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14M3 9h3v6H3m18-6h-3v6h3"/><circle cx="12" cy="12" r="2.5"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm9 9-9 5-9-5m18 4-9 5-9-5"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 4.1 1.9c-1 .8-1.6 1-1.6 2.6m0 2.4h.01"/>',
  link:'<path d="M9 15 15 9m-6.5 7.5-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0m1-1 1-1a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0" transform="translate(2 0)"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  upload:'<path d="M12 16V4M8 8l4-4 4 4M4 16v4h16v-4"/>',
  chevronRight:'<path d="m9 6 6 6-6 6"/>',
  edit:'<path d="m14.5 5.5 4 4M4 20l4.4-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  present:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="m9 21 3-5 3 5m-4-13 4 2-4 2z"/>',
  expand:'<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>',
  sliders:'<path d="M4 7h5m4 0h7M4 17h8m4 0h4"/><circle cx="11" cy="7" r="2"/><circle cx="14" cy="17" r="2"/>',
  film:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v16m8-16v16M4 9h4m-4 6h4m8-6h4m-4 6h4"/>',
  play:'<path d="m8 5 12 7-12 7z" fill="currentColor"/>',
  pause:'<path d="M9 5H6v14h3zm9 0h-3v14h3z" fill="currentColor"/>',
  skipBack:'<path d="M6 6v12m12-12-9 6 9 6z"/>',
  skipForward:'<path d="M18 6v12M6 6l9 6-9 6z"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  select:'<path d="m5 3 14 9-6 1-3 6-5-16Z"/>',
  arrow:'<path d="M5 19 19 5m-9 0h9v9"/>',
  run:'<path d="m4 18 3-3m2-2 3-3m2-2 5-5m-6 0h6v6"/>',
  line:'<path d="M5 19 19 5"/>',
  pen:'<path d="M3 17c2-9 4-9 7-3s5 6 11-7"/>',
  zone:'<rect x="4" y="5" width="16" height="14" rx="2" stroke-dasharray="3 3"/>',
  text:'<path d="M5 6V4h14v2m-7-2v16m-4 0h8"/>',
  cone:'<path d="m7 16 3.6-11h2.8L17 16m-8-5h6M5 16h14v3H5z"/>',
  erase:'<path d="m6 16 6 5h5m-7-3 10-11-5-5L4 14zm0-9 5 5"/>',
  undo:'<path d="M4 11h10a5 5 0 1 1 0 10h-3m-2-15-5 5 5 5"/>',
  redo:'<path d="M20 11H10a5 5 0 1 0 0 10h3m2-15 5 5-5 5"/>',
  dots:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1"/><path d="m3 17 5-4 3 2 4-5 6 6"/>',
  file:'<path d="M6 3h8l4 4v14H6zm7 0v5h5m-9 5h6m-6 4h6"/>',
  home:'<path d="m3 11 9-8 9 8h-3v9h-4v-6h-4v6H6v-9z"/>',
  eye:'<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  swap:'<path d="M4 8h16l-4-4M20 16H4l4 4"/>',
  stages:'<path d="m8 4 6 8-6 8-6-8 6-8Zm6 0 6 8-6 8m4-16 5 8-5 8"/>',
  camera:'<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="3"/>',
  guides:'<path d="M3 3v17h18M7 15l4-4 4 2 5-7"/><circle cx="20" cy="6" r="2"/>',
  save:'<path d="M4 4h13l3 3v13H4V4zm4 0v5h7V4m-7 16v-7h8v7"/>',
  dribble:'<path d="M4 20c2-6 6-1 6-7s5-1 7-7m-5 1 6-3 2 7"/>',
  lob:'<path d="M4 20Q3 5 19 5m-6-3 7 3-4 5"/>',
  shot:'<path d="m4 20 15-15m-11 13 5-5m-3-8h9v9"/>',
  snap:'<path d="M7 4v10a5 5 0 0 0 10 0V4h-4v10a1 1 0 0 1-2 0V4zm0 4h4m2 0h4"/>',
  grid:'<path d="M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z"/>',
  highlight:'<path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>',
  ball:'<circle cx="12" cy="12" r="9"/><path d="m12 7 5 4-2 5H9l-2-5 5-4zm0 0V3m5 8 4-2m-6 7 2 4m-8-4-2 4m0-9L3 9"/>',
  list:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
};

const $ = selector => document.querySelector(selector);
const dialog = $('#dialog');
const pitch = $('#pitch');
const toolbar = $('#toolbar');
const teams = $('#teams');
const timelinePanel = $('#timelinePanel');
const toolPanel = $('#toolPanel');
const playerPanel = $('#playerPanel');
const homeView = $('#homeView');
const mediaView = $('#mediaView');
let media;
const boardView = $('#boardView');
const phases = $('#phases');
const clipLength = 1350;
const tools = [
  ['select', 'Move', 'V', 'Drag players or the ball to reposition them'],
  ['arrow', 'Pass arrow', 'A', 'Drag to draw a passing arrow'],
  ['run', 'Run arrow', 'R', 'Drag to draw a dashed movement arrow'],
  ['line', 'Line', 'L', 'Drag to draw a straight line'],
  ['pen', 'Freehand', 'P', 'Draw freely on the pitch'],
  ['zone', 'Zone', 'Z', 'Drag to shade an area'],
  ['text', 'Text', 'T', 'Click anywhere on the pitch to add a label'],
  ['cone', 'Cone', 'C', 'Click to place a training cone'],
  ['erase', 'Eraser', 'E', 'Click an annotation to remove it'],
  ['dribble', 'Dribble', 'D', 'Drag or click each end to mark a dribble'],
  ['lob', 'Lob', 'B', 'Drag or click each end to draw a lob'],
  ['shot', 'Shot', 'S', 'Drag or click each end to draw a shot'],
  ['highlight', 'Highlight', 'H', 'Click or drag to highlight a player or space'],
];
let board = await loadBoard() ?? initialBoard();
let tool = 'select';
let drawingColor = '#08e5f1';
let panel = null;
let view = 'board';
let selected = null;
let saveMessage = 'Saved on this device';
let undoStack = [];
let redoStack = [];
let toastTimer;
let playing = false;
let exporting = false;
let animationFrame = 0;
let playbackIndex = 0;
let presentation = false;

const icon = name => `<span data-icon="${name}"></span>`;
const escape = value => String(value).replace(/[&<>"']/g, character =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character]);
const arrowTools = ['arrow','run','dribble','lob','shot'];
const dockTool = (name, label, iconName, active, action = 'data-tool') =>
  `<button type="button" class="dock-tool${active ? ' is-active' : ''}" ${action}="${name}" aria-pressed="${Boolean(active)}">${icon(iconName)}<span>${label}</span></button>`;
const phase = () => board.phases[board.active];
const filename = () => board.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'touchline';
const button = (action, label, iconName, extra = '') =>
  `<button type="button" class="icon-button ${extra}" data-action="${action}" title="${escape(label)}" aria-label="${escape(label)}">${icon(iconName)}</button>`;

function fillIcons(root = document) {
  root.querySelectorAll('[data-icon]:empty').forEach(node => {
    node.innerHTML = `<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[node.dataset.icon] ?? ''}</svg>`;
  });
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2850);
}

function snapshot() {
  undoStack.push(structuredClone(board));
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
}

function persist(edit = true) {
  if (edit && location.hash.startsWith('#board=')) {
    history.replaceState(null, '', location.pathname + location.search);
  }
  if (location.hash.startsWith('#board=')) {
    saveMessage = 'Shared board';
    if ($('#saveStatus')) $('#saveStatus').textContent = saveMessage;
    return;
  }
  saveMessage = saveBoard(board) ? 'Saved on this device' : 'Device storage unavailable';
  if ($('#saveStatus')) $('#saveStatus').textContent = saveMessage;
}

function mutate(edit) {
  stop();
  snapshot();
  edit();
  persist();
  render();
}

function renderPitch(scene = phase().scene, container = pitch) {
  renderBoard(container, scene, { ...board.settings, selected: container === pitch ? selected : null });
}

function renderToolbar() {
  const palette = [
    ['#08e5f1','Cyan'],
    ['#f5f7e8','White'],
    ['#ffd000','Yellow'],
  ];
  const arrow = arrowTools.includes(tool);
  toolbar.innerHTML = `
    <div class="toolbar-group">
      ${button('animation','Animation creator','stages')}${button('export','Export','upload')}${button('share','Share','link')}
      ${button('templates','Templates','grid')}${button('help','Help and shortcuts','help')}${button('settings','All panels and settings','dots')}
    </div>
    <div class="toolbar-divider"></div>
    <div class="toolbar-group toolbar-main">
      ${dockTool('play',playing ? 'Pause' : 'Play',playing ? 'pause' : 'play',playing,'data-action')}
      ${dockTool('select','Select','select',tool === 'select')}
      ${dockTool('arrow','Arrow','arrow',arrow,'data-action')}
      ${dockTool('line','Line','line',tool === 'line')}
      ${dockTool('pen','Pen','pen',tool === 'pen')}
      ${dockTool('text','Text box','text',tool === 'text')}
      ${dockTool('zone','Section','zone',tool === 'zone')}
      ${dockTool('more','More tools','dots',panel === 'more','data-action')}
    </div>
    <div class="toolbar-divider"></div>
    <div class="toolbar-group toolbar-state">
      ${button('save','Save tactic','save')}${button('undo','Undo','undo')}${button('redo','Redo','redo')}${button('clear','Clear annotations','trash')}
      <small id="boardTitle" title="${escape(board.title)}">${escape(board.title)} · ${board.active + 1}/${board.phases.length}</small><small id="saveStatus"></small>
    </div>
    <div class="toolbar-divider"></div>
    <div class="toolbar-group palette">
      ${palette.map(([color,label]) => `<button class="swatch" type="button" data-color="${color}" style="--swatch:${color}" aria-label="${label}" title="${label}" aria-pressed="${drawingColor === color}">${drawingColor === color ? '✓' : ''}</button>`).join('')}
      <label class="color-picker" title="Custom drawing color"><span>+</span><input type="color" aria-label="Custom drawing color" id="drawingColor" value="${drawingColor}"></label>
    </div>
    <div class="toolbar-divider"></div>
    <div class="toolbar-group dock-end">
      ${button('animation','Stages','list')}${button('present','Present full screen','expand')}${button('settings','Pitch settings','sliders')}${button('home','Home','home')}
    </div>`;
  toolbar.querySelector('[data-action=undo]').disabled = !undoStack.length;
  toolbar.querySelector('[data-action=redo]').disabled = !redoStack.length;
  toolbar.querySelector('[data-action=clear]').disabled = !phase().scene.marks.length;
  toolbar.querySelector('[data-action=play]').disabled = board.phases.length < 2;
  pitch.dataset.tool = tool;
  toolbar.querySelector('#saveStatus').textContent = saveMessage;
  fillIcons(toolbar);
}

function renderTeams() {
  teams.innerHTML = ['home','away'].map(team => {
    const name = board.settings[team + 'Name'];
    const color = board.settings[team + 'Color'];
    const bench = phase().scene.players.filter(player => player.team === team && player.benched).length;
    return `<div class="team-unit">
      <div class="team-badge" style="--team-color:${color}">
        <button class="team-visibility" data-action="visibility-${team}" aria-label="Show ${team}" title="Toggle ${team}" aria-pressed="${board.settings[team] !== false}">${icon('eye')}</button>
        <button class="team-open" data-action="team-${team}" aria-label="${team} team settings"><span>${escape((name === 'Away' ? 'AWY' : name.slice(0,3)).toUpperCase())}</span>${icon('down')}</button>
      </div>
      <button class="bench-button" data-action="bench-${team}" aria-label="${team} bench">Bench${bench ? ' · ' + bench : ''}</button>
    </div>`;
  }).join('') + `<button class="swap-team" data-action="swap-teams" title="Swap sides" aria-label="Swap sides">${icon('swap')}</button>`;
  fillIcons(teams);
}

function panelItem(name,label,iconName,active,attr='data-action') {
  return `<button class="tool-option${active ? ' is-active' : ''}" ${attr}="${name}" aria-pressed="${Boolean(active)}">${icon(iconName)}<span>${label}</span></button>`;
}

function renderPanels() {
  timelinePanel.hidden = panel !== 'animation';
  toolPanel.hidden = !['arrows','more'].includes(panel);
  const player = phase().scene.players.find(item => item.id === selected);
  playerPanel.hidden = Boolean(panel || tool !== 'select' || !player || presentation);
  if (!playerPanel.hidden) {
    playerPanel.innerHTML = `<button data-action="highlight-player">${icon('highlight')} Highlight</button>
      <button data-action="give-ball">${icon('ball')} Give ball</button>
      <button data-action="player-arrow">${icon('arrow')} Arrow</button>
      <button data-action="player-card">${icon('edit')} Card</button>`;
    fillIcons(playerPanel);
  }
  if (toolPanel.hidden) return;
  const arrows = panel === 'arrows';
  toolPanel.innerHTML = `<div class="tool-panel-header">
    <span><strong>${arrows ? 'Arrow' : 'More tools'}</strong>${arrows ? ' · Drag to draw, or click each end.' : ' · Mark a player or a space.'}</span>
    <button class="button button-accent" data-action="done-tool">Done <span>(Esc)</span></button>
  </div><div class="tool-options">${arrows ?
    arrowTools.map((name,index) => panelItem(name,['Pass','Run','Dribble','Lob','Shot'][index],name,tool === name,'data-tool')).join('') +
    panelItem('snap','Snap','snap',board.settings.snap) + panelItem('guides','Guides','grid',board.settings.grid)
    : panelItem('highlight','Highlight','highlight',tool === 'highlight','data-tool') +
      panelItem('cone','Cone','cone',tool === 'cone','data-tool') +
      panelItem('erase','Eraser','erase',tool === 'erase','data-tool') +
      panelItem('guides','Guides','grid',board.settings.grid)}</div>`;
  fillIcons(toolPanel);
}

function renderHomeView() {
  renderHome(homeView, { board, saved:listSavedBoards(), templates, renderPreview:renderBoard });
  fillIcons(homeView);
}

function setView(next) {
  view = next;
  stop();
  if (next !== 'media' && media) {
    media.cleanup();
    media = null;
  }
  mediaView.hidden = next !== 'media';
  homeView.hidden = next !== 'home';
  boardView.hidden = next !== 'board';
  if (next === 'home') renderHomeView();
  if (next === 'board') render();
  if (next === 'media' && !media) media = mountMedia(mediaView, {goHome: () => setView('home')});
}

function teamCard(team) {
  const name = escape(board.settings[team + 'Name']);
  const color = board.settings[team + 'Color'];
  const formation = board.settings[team + 'Formation'];
  return `<div class="team-card">
    <div class="team-card-head">
      <label class="team-color" title="${team} kit color"><i style="background:${color}"></i><input data-setting="${team}Color" aria-label="${team} kit color" type="color" value="${color}"></label>
      <input type="text" maxlength="40" aria-label="${team} team name" data-setting="${team}Name" value="${name}" spellcheck="false">
    </div>
    <select data-formation="${team}" aria-label="${team} formation">${formations.map(value =>
      `<option value="${value}"${value === formation ? ' selected' : ''}>${value}</option>`).join('')}</select>
  </div>`;
}

function toggle(setting, label) {
  return `<label class="toggle-row">${label}<input type="checkbox" data-setting="${setting}" ${board.settings[setting] ? 'checked' : ''}></label>`;
}

function openTeam(team) {
  openDialog(`${team === 'home' ? 'Home' : 'Away'} team`, `${teamCard(team)}
    <p>Change the team name, kit color or formation for this stage.</p>`);
}

function openGuidePicker() {
  openDialog('Spacing guides', `
    ${option('guides-lanes','Five lanes','Show five channels across the width of the pitch.','grid')}
    ${option('guides-thirds','Thirds','Mark the defensive, middle, and attacking thirds.','line')}
    ${option('guides-zones','18 zones','Divide the field into a three-by-six grid.','grid')}
    ${board.settings.grid ? option('guides-off','Hide guides','Return to standard pitch markings.','close') : ''}`);
}

function openSettings() {
  openDialog('All panels and settings', `
    <section class="setup-section"><h3 class="section-label">Pitch view</h3>
      <div class="segment" aria-label="Pitch view">${['full','half'].map(view =>
        `<button data-view="${view}" class="${view === board.settings.view ? 'selected' : ''}" aria-pressed="${view === board.settings.view}">${view === 'full' ? 'Full pitch' : 'Half pitch'}</button>`).join('')}</div>
      ${toggle('labels','Player labels')}${toggle('away','Show opposition')}${toggle('grid','Spacing guides')}${toggle('snap','Arrow snap')}
    </section>
    ${option('rename','Rename board',board.title,'edit')}
    ${option('templates','Play templates','Start from a coached example.','grid')}
    ${option('media','Media Draw','Annotate a local clip or still image.','film')}
    ${option('save','Save tactic','Add a copy of this board to your local library.','save')}
    ${option('new','New board','Create a board or open a file.','plus')}`);
}

function openPlayer() {
  const player = phase().scene.players.find(item => item.id === selected);
  if (!player) return;
  openDialog('Player card', `<div class="player-form">
    <label>Name<input class="input" data-player="name" maxlength="32" value="${escape(player.name)}"></label>
    <label>Number<input class="input" type="number" min="0" max="999" data-player="number" value="${player.number}"></label></div>`);
}

function openBench(team) {
  const players = phase().scene.players.filter(player => player.team === team);
  openDialog(`${team === 'home' ? 'Home' : 'Away'} bench`, `<p>Choose a player to move them between the pitch and the bench.</p>
    <div class="bench-list">${players.map(player =>
      `<button data-action="bench-player-${escape(player.id)}"><span>${player.number} · ${escape(player.name)}</span><small>${player.benched ? 'Put on pitch' : 'Send to bench'}</small></button>`
    ).join('')}</div>`);
}

function renderTimeline() {
  const index = playing ? playbackIndex : board.active;
  $('#phaseCount').textContent = `· ${board.phases.length} ${board.phases.length === 1 ? 'phase' : 'phases'}`;
  $('#play').innerHTML = icon(playing ? 'pause' : 'play') + `<span>${playing ? 'Pause' : 'Play'}</span>`;
  $('#play').disabled = board.phases.length < 2;
  $('[data-action=previous]').disabled = index === 0;
  $('[data-action=next]').disabled = index === board.phases.length - 1;
  phases.innerHTML = board.phases.map((item, position) => `
    <div class="phase-card${position === index ? ' active' : ''}">
      <button data-phase="${position}" aria-current="${position === index ? 'step' : 'false'}">
        <span class="phase-number">${String(position + 1).padStart(2,'0')}</span>${escape(item.title)}
      </button>${button(`phase-edit-${position}`, `Edit ${item.title}`, 'dots', 'phase-edit')}
    </div>`).join('') + `<button class="add-phase" data-action="add-phase">${icon('plus')} Add phase</button>`;
  const notes = $('#notes');
  if (document.activeElement !== notes) notes.value = phase().notes;
  fillIcons($('.timeline'));
}

function render() {
  document.title = board.title + ' • Touchline';
  renderToolbar();
  renderTeams();
  renderPitch();
  renderTimeline();
  renderPanels();
}

function setTool(name) {
  if (presentation) return;
  stop();
  tool = name;
  if (arrowTools.includes(name)) panel = 'arrows';
  else if (['highlight','cone','erase'].includes(name)) panel = 'more';
  else panel = null;
  if (name !== 'select' && selected) {
    selected = null;
    renderPitch();
  }
  renderToolbar();
  renderPanels();
}

function switchPhase(index) {
  stop();
  if (index === board.active || !board.phases[index]) return;
  board.active = index;
  selected = null;
  persist(false);
  render();
}

function stop() {
  if (!playing) return;
  playing = false;
  cancelAnimationFrame(animationFrame);
  renderPitch();
  renderTimeline();
  renderToolbar();
}

function play() {
  if (playing) {
    const index = playbackIndex;
    stop();
    switchPhase(index);
    return;
  }
  if (board.phases.length < 2) return;
  const origin = board.active === board.phases.length - 1 ? 0 : board.active;
  selected = null;
  playing = true;
  renderPanels();
  renderToolbar();
  playbackIndex = origin;
  const start = performance.now();
  renderTimeline();
  function frame(now) {
    const offset = (now - start) / clipLength;
    const index = origin + Math.floor(offset);
    if (index >= board.phases.length - 1) {
      playing = false;
      board.active = board.phases.length - 1;
      persist(false);
      render();
      return;
    }
    if (index !== playbackIndex) {
      playbackIndex = index;
      renderTimeline();
    }
    renderPitch(interpolateScene(board.phases[index].scene, board.phases[index + 1].scene, offset % 1));
    animationFrame = requestAnimationFrame(frame);
  }
  animationFrame = requestAnimationFrame(frame);
}

function goHistory(direction) {
  stop();
  const from = direction === 'undo' ? undoStack : redoStack;
  const to = direction === 'undo' ? redoStack : undoStack;
  if (!from.length) return;
  to.push(structuredClone(board));
  board = from.pop();
  selected = null;
  persist();
  render();
}

function openDialog(title, body) {
  if (dialog.open) dialog.close();
  dialog.innerHTML = `<div class="dialog-head"><h2>${escape(title)}</h2>${button('close', 'Close', 'close')}</div><div class="dialog-body">${body}</div>`;
  fillIcons(dialog);
  dialog.showModal();
}

function inputDialog(title, label, value, callback, max = 80) {
  openDialog(title, `<form><label>${escape(label)}<input class="input" name="value" value="${escape(value)}" maxlength="${max}" required autofocus></label>
    <div class="dialog-actions"><button class="button button-muted" type="button" data-action="close">Cancel</button><button class="button button-accent" type="submit">Save</button></div></form>`);
  const field = dialog.querySelector('input');
  field.select();
  dialog.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    const value = field.value.trim();
    if (!value) return;
    dialog.close();
    callback(value);
  });
}

function option(action, title, detail, iconName) {
  return `<button data-action="${action}" class="option">${icon(iconName)}<span><strong>${escape(title)}</strong><small>${escape(detail)}</small></span></button>`;
}

function createBoard(template) {
  mutate(() => {
    const defaults = initialBoard();
    if (template) {
      defaults.title = template.name;
      defaults.settings.homeFormation = template.homeFormation;
      defaults.settings.awayFormation = template.awayFormation;
      defaults.phases = [{ id: makeId(), title: 'Starting shape', notes: template.description, scene: structuredClone(template.scene) }];
    } else {
      defaults.title = 'Untitled board';
      defaults.phases = [{ id: makeId(), title: 'Starting shape', notes: '', scene: {
        players: [...makeLineup('home', defaults.settings.homeFormation), ...makeLineup('away', defaults.settings.awayFormation)],
        ball: {x:500,y:312.5}, marks: [],
      }}];
    }
    board = defaults;
    selected = null;
    panel = null;
    tool = 'select';
  });
  setView('board');
  showToast('Board created. Undo to return to the previous board.');
}

function editPhase(index) {
  openDialog('Edit phase', `<form><label>Phase name<input class="input" name="title" maxlength="80" value="${escape(board.phases[index].title)}" required autofocus></label>
    <div class="dialog-actions">
      ${board.phases.length > 1 ? '<button class="button button-muted" type="button" data-action="remove-phase">Delete phase</button>' : ''}
      <button class="button button-accent" type="submit">Save</button>
    </div></form>`);
  dialog.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    const title = event.currentTarget.elements.title.value.trim();
    if (!title) return;
    dialog.close();
    mutate(() => { board.phases[index].title = title; });
  });
  dialog.querySelector('[data-action=remove-phase]')?.addEventListener('click', () => {
    dialog.close();
    mutate(() => {
      board.phases.splice(index, 1);
      if (board.active > index) board.active -= 1;
      if (board.active === board.phases.length) board.active -= 1;
      selected = null;
    });
  });
}

function togglePresentation() {
  presentation = !presentation;
  document.body.classList.toggle('presenting', presentation);
  if (presentation) panel = null;
  renderPanels();
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href:url, download:name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function exportVideo() {
  if (exporting) return;
  if (board.phases.length < 2) return showToast('Add a second phase to export animation.');
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    return showToast('Video export is unavailable in this browser.');
  }
  stop();
  exporting = true;
  const copy = structuredClone(board);
  const exportPitch = document.createElement('div');
  const output = document.createElement('canvas');
  const ctx = output.getContext('2d');
  let stream;
  let recorder;
  try {
    renderBoard(exportPitch, copy.phases[0].scene, copy.settings);
    const initial = await canvasBoard(exportPitch, {scale:1});
    output.width = initial.width + initial.width % 2;
    output.height = initial.height + initial.height % 2;
    ctx.drawImage(initial, 0, 0, output.width, output.height);
    const mime = ['video/mp4','video/webm;codecs=vp9','video/webm'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mime) throw new Error('No supported format');
    stream = output.captureStream(24);
    recorder = new MediaRecorder(stream, {mimeType:mime});
    const chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const finished = new Promise(resolve => { recorder.onstop = resolve; });
    showToast('Recording animation…');
    recorder.start();
    const duration = clipLength * (copy.phases.length - 1) + 450;
    const start = performance.now();
    let elapsed = 0;
    while (elapsed < duration) {
      const offset = elapsed / clipLength;
      const index = Math.min(copy.phases.length - 2, Math.floor(offset));
      const scene = interpolateScene(copy.phases[index].scene, copy.phases[index + 1].scene, Math.min(1, offset - index));
      renderBoard(exportPitch, scene, copy.settings);
      const frame = await canvasBoard(exportPitch, {scale:1});
      ctx.drawImage(frame, 0, 0, output.width, output.height);
      await new Promise(resolve => setTimeout(resolve, 30));
      elapsed = performance.now() - start;
    }
    recorder.stop();
    await finished;
    if (!chunks.length) throw new Error('No frames captured');
    downloadBlob(new Blob(chunks, {type:mime}), `${filename()}.${mime.includes('mp4') ? 'mp4' : 'webm'}`);
    showToast('Animation exported');
  } catch {
    showToast('Video export failed. Try the PNG or board file.');
  } finally {
    if (recorder?.state === 'recording') recorder.stop();
    stream?.getTracks().forEach(track => track.stop());
    exporting = false;
  }
}

async function handleAction(action) {
  if (action.startsWith('saved-open-')) {
    const saved = listSavedBoards().find(item => item.id === action.slice(11));
    if (saved) {
      mutate(() => { board = structuredClone(saved.board); selected = null; panel = null; tool = 'select'; });
      setView('board');
    }
    return;
  }
  if (action.startsWith('saved-delete-')) {
    const id = action.slice(13);
    const saved = listSavedBoards().find(item => item.id === id);
    if (!saved) return;
    openDialog('Remove saved tactic', `<p>Remove ${escape(saved.title)} from this device's library?</p>
      <div class="dialog-actions"><button class="button button-muted" data-action="close">Cancel</button><button class="button button-accent" id="confirmRemove">Remove</button></div>`);
    $('#confirmRemove').addEventListener('click', () => {
      dialog.close();
      if (removeSavedBoard(id)) {
        renderHomeView();
        showToast('Saved tactic removed');
      } else showToast('The tactic could not be removed.');
    });
    return;
  }
  if (action.startsWith('visibility-')) {
    const team = action.slice(11);
    return mutate(() => { board.settings[team] = board.settings[team] === false; selected = null; });
  }
  if (action.startsWith('team-')) return openTeam(action.slice(5));
  if (action.startsWith('bench-player-')) {
    const id = action.slice(13);
    const player = phase().scene.players.find(item => item.id === id);
    if (!player) return;
    mutate(() => { player.benched = !player.benched; selected = null; });
    return openBench(player.team);
  }
  if (action.startsWith('bench-')) return openBench(action.slice(6));
  if (action.startsWith('phase-edit-')) return editPhase(Number(action.slice(11)));
  if (action.startsWith('template-')) {
    dialog.close();
    return createBoard(templates[Number(action.slice(9))]);
  }
  switch (action) {
    case 'close': return dialog.close();
    case 'board': case 'open-board': return setView('board');
    case 'home': panel = null; return setView('home');
    case 'settings': return openSettings();
    case 'media': return setView('media');
    case 'media-import': setView('media'); return media.openFile();
    case 'save': {
      if (dialog.open) dialog.close();
      const saved = storeSavedBoard(board);
      if (view === 'home') renderHomeView();
      return showToast(saved ? 'Tactic saved to your library' : 'Browser storage is full or unavailable.');
    }
    case 'animation':
      panel = panel === 'animation' ? null : 'animation';
      if (tool !== 'select') { tool = 'select'; renderToolbar(); }
      return renderPanels();
    case 'arrow':
      return panel === 'arrows' ? setTool('select') : setTool('arrow');
    case 'more':
      panel = panel === 'more' ? null : 'more';
      tool = 'select';
      selected = null;
      renderToolbar();
      renderPitch();
      return renderPanels();
    case 'done-tool': return setTool('select');
    case 'guides': return openGuidePicker();
    case 'guides-off':
      dialog.close();
      return mutate(() => { board.settings.grid = false; });
    case 'guides-lanes': case 'guides-thirds': case 'guides-zones':
      dialog.close();
      return mutate(() => {
        board.settings.grid = true;
        board.settings.guideMode = action.slice(7);
      });
    case 'snap': return mutate(() => { board.settings.snap = !board.settings.snap; });
    case 'swap-teams': return mutate(() => {
      for (const item of board.phases) {
        for (const player of item.scene.players) player.x = 1000 - player.x;
        item.scene.ball.x = 1000 - item.scene.ball.x;
        for (const mark of item.scene.marks) for (const point of mark.points) point.x = 1000 - point.x;
      }
      selected = null;
    });
    case 'player-card': return openPlayer();
    case 'player-arrow': {
      const player = phase().scene.players.find(item => item.id === selected);
      setTool('arrow');
      if (player) boardBinding.startArrow?.(player.x, player.y);
      return;
    }
    case 'give-ball': {
      const player = phase().scene.players.find(item => item.id === selected);
      if (player) mutate(() => { phase().scene.ball = { x:Math.min(975,player.x + 24), y:player.y }; });
      return;
    }
    case 'highlight-player': {
      const player = phase().scene.players.find(item => item.id === selected);
      if (!player || phase().scene.marks.length >= 500) return;
      return mutate(() => { phase().scene.marks.push({id:makeId(),type:'highlight',color:drawingColor,points:[{x:player.x,y:player.y}]}); });
    }
    case 'templates':
      return openDialog('Play templates', `<p>Start with a coached example and adapt it to your team.</p>${templates.map((item, index) =>
        option(`template-${index}`, item.name, `${item.category} · ${item.description}`, 'pitch')).join('')}`);
    case 'new':
      return openDialog('New board', `<p>Start with a fresh lineup, browse a template, or open a saved board file.</p>
        ${option('blank', 'Blank board', 'Two editable XIs with no annotations.', 'plus')}
        ${option('templates', 'Play templates', 'Build-up, pressing, and set-piece examples.', 'layers')}
        ${option('import', 'Open board file', 'Restore a Touchline JSON file.', 'upload')}`);
    case 'blank': dialog.close(); return createBoard();
    case 'rename': return inputDialog('Rename board', 'Board name', board.title, title => mutate(() => { board.title = title; }));
    case 'import': dialog.close(); return $('#importFile').click();
    case 'help':
      return openDialog('Keyboard shortcuts', `<div class="shortcut-list">${tools.map(([,label,key]) => `<span>${label}</span><kbd>${key}</kbd>`).join('')}
        <span>Play or pause animation</span><kbd>Space</kbd><span>Previous or next phase</span><kbd>← / →</kbd><span>Undo / redo</span><kbd>Ctrl/⌘ + Z / ⇧Z</kbd></div>`);
    case 'undo': case 'redo': return goHistory(action);
    case 'clear':
      if (phase().scene.marks.length) {
        mutate(() => { phase().scene.marks = []; });
        showToast('Annotations cleared. Undo to restore them.');
      }
      return;
    case 'present': return togglePresentation();
    case 'previous': return switchPhase((playing ? playbackIndex : board.active) - 1);
    case 'next': return switchPhase((playing ? playbackIndex : board.active) + 1);
    case 'play': return play();
    case 'add-phase':
      if (board.phases.length >= 100) return showToast('This board has reached 100 phases.');
      return mutate(() => {
        const item = { id:makeId(), title:`Phase ${board.phases.length + 1}`, scene:structuredClone(phase().scene), notes:'' };
        board.phases.splice(board.active + 1, 0, item);
        board.active += 1;
        selected = null;
      });
    case 'share': {
      openDialog('Share board', `<p>The link contains a snapshot of this board. The recipient needs access to Touchline.</p>
        <input class="input" id="shareLink" aria-label="Board link" placeholder="Preparing link…" readonly>
        <div class="dialog-actions"><button class="button button-muted" data-action="export-json">Download board file</button><button class="button button-accent" data-action="copy-link" disabled>${icon('link')} Copy link</button></div>`);
      const input = $('#shareLink');
      const copy = dialog.querySelector('[data-action=copy-link]');
      try {
        const link = await sharedUrl(board);
        if (input.isConnected) {
          input.value = link;
          copy.disabled = false;
        }
      } catch {
        if (input.isConnected) input.placeholder = 'Board is too large. Download the board file.';
      }
      return;
    }
    case 'copy-link':
      try {
        await navigator.clipboard.writeText($('#shareLink').value);
        showToast('Board link copied');
      } catch {
        $('#shareLink').select();
        showToast('Link selected. Copy it with Ctrl or ⌘ + C.');
      }
      return;
    case 'export':
      return openDialog('Export board', `${option('export-png', 'Pitch image', 'Download the current phase as a PNG.', 'image')}
        ${option('export-video', 'Animation video', 'Download all phases as MP4 or WebM, depending on this browser.', 'film')}
        ${option('export-json', 'Editable board file', 'Save every phase and note in a JSON file.', 'file')}
        ${option('share', 'Share board link', 'Copy a snapshot link.', 'link')}`);
    case 'export-png':
      dialog.close();
      stop();
      try { await exportBoard(pitch, `${filename()}.png`); showToast('Pitch image exported'); }
      catch { showToast('Image export failed. Try again.'); }
      return;
    case 'export-video': dialog.close(); return exportVideo();
    case 'export-json': return downloadBoard(board);
  }
}

document.addEventListener('click', event => {
  const control = event.target.closest('[data-action], [data-tool], [data-phase], [data-view], [data-color]');
  if (!control || control.disabled) return;
  if (control.dataset.action) void handleAction(control.dataset.action);
  if (control.dataset.tool) setTool(control.dataset.tool);
  if (control.dataset.phase != null) switchPhase(Number(control.dataset.phase));
  if (control.dataset.color) {
    drawingColor = control.dataset.color;
    renderToolbar();
  }
  if (control.dataset.view && board.settings.view !== control.dataset.view) {
    mutate(() => { board.settings.view = control.dataset.view; });
    openSettings();
  }
});

document.addEventListener('change', async event => {
  const input = event.target;
  if (input.id === 'drawingColor') { drawingColor = input.value; renderToolbar(); }
  if (input.id === 'notes' && input.value !== phase().notes) {
    snapshot();
    phase().notes = input.value;
    persist();
    toolbar.querySelector('[data-action=undo]').disabled = false;
    toolbar.querySelector('[data-action=redo]').disabled = true;
  }
  if (input.dataset.setting) {
    const key = input.dataset.setting;
    const value = input.type === 'checkbox' ? input.checked : input.value.trim();
    if (value === board.settings[key]) return;
    mutate(() => {
      board.settings[key] = value === '' ? (key.startsWith('home') ? 'Home' : 'Away') : value;
      if (!board.settings.away && phase().scene.players.some(player => player.id === selected && player.team === 'away')) selected = null;
    });
    if (input.type === 'color') input.closest('.team-color').querySelector('i').style.background = value;
  }
  if (input.dataset.formation) {
    const team = input.dataset.formation;
    mutate(() => {
      const currentFormation = board.settings[team + 'Formation'];
      board.settings[team + 'Formation'] = input.value;
      const old = new Map(phase().scene.players.map(player => [player.id,player]));
      const roles = new Map(makeLineup(team, currentFormation).map(player => [player.id, player.name]));
      phase().scene.players = phase().scene.players.filter(player => player.team !== team).concat(
        makeLineup(team, input.value).map(player => {
          const previous = old.get(player.id);
          if (previous) {
            player.number = previous.number;
            player.benched = previous.benched ?? false;
            if (previous.name !== roles.get(player.id)) player.name = previous.name;
          }
          return player;
        }));
      selected = null;
    });
  }
  if (input.dataset.player) {
    const key = input.dataset.player;
    const player = phase().scene.players.find(item => item.id === selected);
    if (!player) return;
    const value = key === 'number' ? Math.max(0, Math.min(999, Math.round(Number(input.value)))) : input.value.trim();
    if (value !== player[key]) mutate(() => { player[key] = value; });
  }
  if (input.id === 'importFile') {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    try {
      const imported = file.size <= 8_000_000 ? parseBoard(await file.text()) : null;
      if (!imported) throw new Error('Invalid board');
      mutate(() => { board = imported; selected = null; panel = null; tool = 'select'; });
      setView('board');
      showToast('Board imported');
    } catch {
      showToast('Choose a valid Touchline board file.');
    }
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && presentation) togglePresentation();
  if (event.defaultPrevented || dialog.open || view !== 'board' || event.target.matches('input, select, textarea')) return;
  if (event.key === 'Escape' && (panel || tool !== 'select')) return setTool('select');
  const key = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && (key === 'z' || key === 'y')) {
    event.preventDefault();
    return goHistory(key === 'y' || event.shiftKey ? 'redo' : 'undo');
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (key === '?') return void handleAction('help');
  if (key === ' ' && !event.target.closest('button')) { event.preventDefault(); return play(); }
  if (key === 'arrowleft' || key === 'arrowright') {
    event.preventDefault();
    return void handleAction(key === 'arrowleft' ? 'previous' : 'next');
  }
  const entry = tools.find(([, ,shortcut]) => shortcut.toLowerCase() === key);
  if (entry) setTool(entry[0]);
});

const boardBinding = bindBoard(pitch, {
  getTool: () => presentation || playing ? 'inactive' : tool,
  getColor: () => drawingColor,
  getSnap: () => board.settings.snap,
  onSelect(id) { selected = id; renderPitch(); renderPanels(); },
  onStart() { snapshot(); },
  onMove(id, x, y) {
    const target = id === 'ball' ? phase().scene.ball : phase().scene.players.find(player => player.id === id);
    if (!target) return;
    Object.assign(target, {x,y});
    renderPitch();
  },
  onCommit() { persist(); renderToolbar(); renderPanels(); },
  onMark(mark) {
    if (phase().scene.marks.length >= 500) return showToast('This phase has reached 500 annotations.');
    mutate(() => { phase().scene.marks.push({ ...mark, id:mark.id || makeId() }); });
  },
  onErase(id) {
    if (id) mutate(() => { phase().scene.marks = phase().scene.marks.filter(mark => mark.id !== id); });
  },
  onText(point, color) {
    inputDialog('Add pitch label', 'Label', '', text => {
      if (phase().scene.marks.length >= 500) return showToast('This phase has reached 500 annotations.');
      mutate(() => { phase().scene.marks.push({ id:makeId(), type:'text', color, text, points:[point] }); });
    });
  },
});

window.addEventListener('hashchange', async () => {
  const hash = location.hash;
  const shared = await loadBoard();
  if (!shared || location.hash !== hash) return;
  stop();
  board = shared;
  setView('board');
  selected = null;
  panel = null;
  undoStack = [];
  redoStack = [];
  persist(false);
  render();
});

fillIcons();
setView(new URLSearchParams(location.search).get('view') === 'home' && !location.hash ? 'home' : 'board');
persist(false);

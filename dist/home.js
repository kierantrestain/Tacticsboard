import { createLibraryFolder, deleteLibraryFolder, moveLibraryTactic, readLibraryFolders, renameLibraryFolder } from './library-folders.js';

const iconPaths = {
  home: '<path d="m3 10 9-7 9 7v10h-6v-6H9v6H3z"/>',
  board: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M12 5v14M3 9h3v6H3m18-6h-3v6h3"/><circle cx="12" cy="12" r="2.7"/>',
  templates: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  recent: '<path d="M3 4v5h5M3.6 8A9 9 0 1 1 3 15m9-8v5l3 2"/>',
  film: '<rect x="3" y="4.5" width="18" height="15" rx="1"/><path d="m10 9 5 3-5 3z"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  upload: '<path d="M12 15V4m-4 4 4-4 4 4M4 15v5h16v-5"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
  edit: '<path d="m4 16 11-11 4 4L8 20H4zm9-9 4 4"/>',
  move: '<path d="M4 20h16a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-8l-2-3H4a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1Zm4-6h8m-3-3 3 3-3 3"/>',
  dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  trash: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15m-7-12V9m4 0v8"/>',
};

const icon = key => `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${iconPaths[key]}</svg>`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function opponents(board) {
  return `${board.settings.homeName} v ${board.settings.awayName}`;
}

function elapsedLabel(timestamp) {
  if (!Number.isFinite(timestamp)) return '';
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    ...(new Date(timestamp).getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
  }).format(timestamp);
}

function recentCard({ id, title, board, current }) {
  return `<button type="button" class="home-recent-card${current ? ' home-current-card' : ''}" data-action="${current ? 'open-board' : `saved-open-${escape(id)}`}">
    <div class="home-preview" data-preview="${current ? 'current' : `recent-${escape(id)}`}"></div>
    ${current ? '<span class="home-continue">Continue</span>' : ''}
    <div class="home-recent-detail"><strong>${escape(title)}</strong><small>${escape(opponents(board))}</small></div>
  </button>`;
}

function tacticRow(item,folder) {
  const actionId = escape(item.id);
  const title = escape(item.title);
  const count = item.board.phases.length;
  return `<div class="home-tactic" data-search-row="${actionId}">
    <button class="home-tactic-open" data-action="saved-open-${actionId}" type="button">
      <div class="home-row-preview home-preview" data-preview="saved-${actionId}"></div>
      <span><strong>${title}</strong><small>${escape(opponents(item.board))} · ${count} ${count === 1 ? 'stage' : 'stages'}${folder ? ' · ' + escape(folder.name) : ''}</small></span>
      <span class="home-tactic-date">${escape(elapsedLabel(item.modified))}</span>
    </button>
    <button class="home-tactic-remove" data-tactic-options="${actionId}" aria-label="Options for ${title}" title="Tactic options" type="button">${icon('dots')}</button>
  </div>`;
}

function drawPreview(node, scene, settings, renderPreview) {
  if (!node || !scene) return;
  node.setAttribute('aria-hidden', 'true');
  renderPreview(node, scene, { ...settings, labels:false, view:'full', grid:false, selected:null });
  node.querySelectorAll('[tabindex]').forEach(element => element.removeAttribute('tabindex'));
}

const homeViewState = new WeakMap();

export function renderHome(container, { board, saved = [], templates = [], renderPreview, onRenameSaved }) {
  const items = [...saved].sort((first, second) => second.modified - first.modified);
  const {folders,locations} = readLibraryFolders();
  const foldersById = new Map(folders.map(folder => [folder.id,folder]));
  const folderOf = id => foldersById.get(locations.get(id));
  const selected = homeViewState.get(container) ?? {folder:'all',query:''};
  if (selected.folder !== 'all' && selected.folder !== 'unfiled' && !foldersById.has(selected.folder)) selected.folder = 'all';
  homeViewState.set(container,selected);
  const counts = new Map([['all',items.length],['unfiled',0]]);
  for (const item of items) {
    const id = folderOf(item.id)?.id ?? 'unfiled';
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const folderOption = (id,name) =>
    `<option value="${escape(id)}"${selected.folder === id ? ' selected' : ''}>${escape(name)} (${counts.get(id) ?? 0})</option>`;
  const current = { title:'Current board', board, current:true };
  const recent = items.slice(0, 1);
  const training = templates.slice(0, 3);
  const suggested = !recent.length ? templates[1] ?? templates[0] : null;
  const suggestionIndex = suggested ? templates.indexOf(suggested) : -1;
  container.innerHTML = `<div class="home-shell">
    <header class="home-header">
      <div class="home-brand" aria-label="Touchline"><span class="home-wordmark">touchline<span>.</span></span></div>
      <nav class="home-nav" aria-label="Workspace navigation">
        <button type="button" class="home-nav-current" aria-current="page" data-home-top>${icon('home')}<span>Home</span></button>
        <button type="button" data-action="open-board">${icon('board')}<span>Board</span></button>
        <button type="button" data-action="templates">${icon('templates')}<span>Templates</span></button>
        <button type="button" data-action="match-maps">${icon('board')}<span>Match maps</span></button>
      </nav>
      <button type="button" class="home-button home-button-accent home-header-new" data-action="new">${icon('plus')} New board</button>
      <label class="home-search home-header-search">${icon('search')}<input type="search" data-home-search aria-label="Search saved tactics" placeholder="Search your tactics…"></label>
    </header>

    <main class="home-main">
      <section class="home-panel home-recent">
        <div class="home-panel-head">${icon('recent')}<div><h1>Jump back in</h1><p>Your recent boards.</p></div></div>
        <div class="home-recent-grid">
          ${recentCard(current)}${recent.map(recentCard).join('')}
          ${suggested ? `<button type="button" class="home-recent-card" data-action="${suggested.stages?.length > 1 ? 'preview-template' : 'template'}-${suggestionIndex}">
            <div class="home-preview" data-preview="suggested"></div>
            <div class="home-recent-detail"><strong>${escape(suggested.name)}</strong><small>${suggested.stages?.length > 1 ? 'Play template' : 'Open template'}</small></div>
          </button>` : ''}
          <div class="home-new-card">
            <button type="button" data-action="new">${icon('plus')}<strong>New board</strong></button>
            <button type="button" data-action="templates">${icon('templates')}<strong>From a template</strong></button>
          </div>
        </div>
      </section>

      <section class="home-panel home-training">
        <div class="home-panel-head">${icon('film')}<div><h2>Media Draw</h2><p>Analyse footage and images.</p></div></div>
        <button type="button" class="home-training-cover" data-action="media">
          ${training[0] ? '<div class="home-pitch-banner" data-preview="training"></div>' : ''}
          <strong>Draw over the<br>footage.</strong>
          <span class="home-training-arrow">${icon('arrow')}</span>
        </button>
        <div class="home-training-actions">
          <button class="home-button home-button-accent" type="button" data-action="media">Open Media Draw ${icon('arrow')}</button>
          <button class="home-button home-button-outline" type="button" data-action="media-projects">Saved projects</button>
          <button class="home-button home-button-outline home-button-icon" type="button" aria-label="Upload footage or an image" title="Upload footage or an image" data-action="media-import">${icon('upload')}</button>
        </div>
      </section>

      <section class="home-panel home-match-maps">
        <div class="home-panel-head">${icon('board')}<div><h2>Match maps</h2><p>Explore real shots, xG and ball-action locations, or import your own event data.</p></div></div>
        <button type="button" class="home-button home-button-accent" data-action="match-maps">Explore match maps ${icon('arrow')}</button>
      </section>

      <section class="home-panel home-saved">
        <div class="home-saved-head">
          <div class="home-panel-head">${icon('folder')}<div><h2>Your tactics</h2><p>Boards you’ve saved on this device.</p></div></div>
          <div class="home-saved-actions">
            <label class="home-search home-library-search">${icon('search')}<input type="search" data-home-search aria-label="Filter saved tactics" placeholder="Search your tactics"></label>
            <button class="home-button home-button-outline home-button-icon" type="button" aria-label="Open a board file" title="Open a board file" data-action="import">${icon('upload')}</button>
          </div>
        </div>
        <div class="home-folders">
          <label class="home-folder-filter">${icon('folder')}<span class="visually-hidden">Folder</span>
            <select aria-label="Folder" data-home-folder-filter>
              ${folderOption('all','All tactics')}${folderOption('unfiled','Unfiled')}${folders.map(folder => folderOption(folder.id,folder.name)).join('')}
            </select>
          </label>
          <button class="home-button home-button-outline" type="button" data-folder-new>${icon('plus')} New folder</button>
          <button class="home-button home-button-outline" type="button" data-folder-options hidden>${icon('dots')} Folder options</button>
        </div>
        <div class="home-saved-items">${items.map(item => tacticRow(item,folderOf(item.id))).join('')}</div>
        <p class="home-empty" data-home-empty>Save a board to add it here.</p>
        <dialog class="home-library-dialog" aria-labelledby="home-library-dialog-title">
          <div class="dialog-head"><h2 id="home-library-dialog-title"></h2></div>
          <div class="dialog-body" data-library-body></div>
        </dialog>
      </section>

      ${training.length ? `<section class="home-panel home-starters">
        <div class="home-panel-head">${icon('templates')}<div><h2>Try a play</h2><p>Play a template, then edit it for your team.</p></div></div>
        <div class="home-starter-grid">${training.map((template, index) =>
          `<button class="home-starter" type="button" data-action="${template.stages?.length > 1 ? 'preview-template' : 'template'}-${index}">
            <div class="home-preview" data-preview="template-${index}"></div><span><strong>${escape(template.name)}</strong><small>${escape(template.category)}</small></span>
          </button>`).join('')}</div>
      </section>` : ''}
    </main>
  </div>`;

  const byPreview = new Map([...container.querySelectorAll('[data-preview]')].map(node => [node.dataset.preview, node]));
  drawPreview(byPreview.get('current'), board.phases[board.active]?.scene ?? board.phases[0]?.scene, board.settings, renderPreview);
  for (const {id, board:savedBoard} of items) {
    const scene = savedBoard.phases[savedBoard.active]?.scene ?? savedBoard.phases[0]?.scene;
    drawPreview(byPreview.get(`saved-${id}`), scene, savedBoard.settings, renderPreview);
    drawPreview(byPreview.get(`recent-${id}`), scene, savedBoard.settings, renderPreview);
  }
  for (const [index, template] of training.entries()) {
    drawPreview(byPreview.get(`template-${index}`), template.scene, board.settings, renderPreview);
  }
  if (training[0]) drawPreview(byPreview.get('training'), training[0].scene, board.settings, renderPreview);
  if (suggested) drawPreview(byPreview.get('suggested'), suggested.scene, board.settings, renderPreview);
  container.querySelector('[data-home-top]').addEventListener('click', () => {
    container.querySelector('.home-header').scrollIntoView({ block:'start' });
  });

  const searchFields = [...container.querySelectorAll('[data-home-search]')];
  const rows = [...container.querySelectorAll('[data-search-row]')];
  const empty = container.querySelector('[data-home-empty]');
  const folderFilter = container.querySelector('[data-home-folder-filter]');
  folderFilter.value = selected.folder;
  const folderOptions = container.querySelector('[data-folder-options]');
  const libraryDialog = container.querySelector('.home-library-dialog');
  const modalHeading = libraryDialog.querySelector('h2');
  const modalBody = libraryDialog.querySelector('[data-library-body]');
  const byId = new Map(items.map(item => [item.id,item]));

  function filter() {
    const query = selected.query.trim().toLowerCase();
    folderOptions.hidden = !foldersById.has(selected.folder);
    rows.forEach(row => {
      const item = byId.get(row.dataset.searchRow);
      const folder = folderOf(item.id);
      const correctFolder = selected.folder === 'all' || selected.folder === (folder?.id ?? 'unfiled');
      row.hidden = !correctFolder || !`${item.title} ${opponents(item.board)} ${folder?.name ?? ''}`.toLowerCase().includes(query);
    });
    empty.hidden = rows.some(row => !row.hidden);
    empty.textContent = query ? 'No saved tactics match this search.' :
      selected.folder === 'all' ? 'Save a board to add it here.' :
        selected.folder === 'unfiled' ? 'No unfiled tactics.' : 'Move a saved tactic to this folder from its options.';
  }

  function refresh(records = items) {
    libraryDialog.close();
    renderHome(container,{board,saved:records,templates,renderPreview,onRenameSaved});
    container.querySelector('[data-home-folder-filter]')?.focus({preventScroll:true});
  }

  function openLibraryDialog(title,body) {
    modalHeading.textContent = title;
    modalBody.innerHTML = body;
    modalBody.querySelectorAll('[data-library-cancel]').forEach(control =>
      control.addEventListener('click',() => libraryDialog.close()));
    if (!libraryDialog.open) libraryDialog.showModal();
    modalBody.querySelector('input, select, button')?.focus();
    return modalBody;
  }

  const cancel = '<button class="button button-muted" type="button" data-library-cancel>Cancel</button>';
  const apply = caption => `<button class="button button-accent" type="submit">${escape(caption)}</button>`;

  function showForm(title,fields,caption,onSubmit) {
    const content = openLibraryDialog(title,`<form>${fields}<p class="home-library-error" role="alert"></p>
      <div class="dialog-actions">${cancel}${apply(caption)}</div></form>`);
    const form = content.querySelector('form');
    form.addEventListener('submit',event => {
      event.preventDefault();
      try { onSubmit(new FormData(form)); }
      catch (error) { form.querySelector('[role=alert]').textContent = error.message; }
    });
  }

  folderFilter.addEventListener('change',() => {
    selected.folder = folderFilter.value;
    filter();
  });
  container.querySelector('[data-folder-new]').addEventListener('click',() => {
    showForm('New folder','<label>Folder name<input name="name" class="input" maxlength="60" required></label>','Create',values => {
      selected.folder = createLibraryFolder(values.get('name'));
      refresh();
    });
  });
  folderOptions.addEventListener('click',() => {
    const folder = foldersById.get(selected.folder);
    if (!folder) return;
    const content = openLibraryDialog(folder.name,
      `<button class="option" type="button" data-library-rename>${icon('edit')} Rename folder</button>
        <button class="option" type="button" data-library-delete>${icon('trash')} Remove folder</button>
        <div class="dialog-actions">${cancel}</div>`);
    content.querySelector('[data-library-rename]').addEventListener('click',() => {
      showForm('Rename folder',`<label>Folder name<input name="name" class="input" maxlength="60" value="${escape(folder.name)}" required></label>`,'Rename',values => {
        renameLibraryFolder(folder.id,values.get('name'));
        refresh();
      });
    });
    content.querySelector('[data-library-delete]').addEventListener('click',() => {
      showForm('Remove folder','<p>Its boards will move to Unfiled.</p>','Remove folder',() => {
        deleteLibraryFolder(folder.id);
        selected.folder = 'unfiled';
        refresh();
      });
    });
  });

  for (const control of container.querySelectorAll('[data-tactic-options]')) {
    control.addEventListener('click',() => {
      const item = byId.get(control.dataset.tacticOptions);
      if (!item) return;
      const content = openLibraryDialog(item.title,
        `${onRenameSaved ? `<button class="option" type="button" data-library-rename>${icon('edit')} Rename tactic</button>` : ''}
        ${folders.length ? `<button class="option" type="button" data-library-move>${icon('move')} Move to folder</button>` : ''}
        <button class="option" type="button" data-action="saved-delete-${escape(item.id)}" data-library-cancel>${icon('trash')} Remove tactic</button>
        <div class="dialog-actions">${cancel}</div>`);
      content.querySelector('[data-library-rename]')?.addEventListener('click',() => {
        showForm('Rename tactic',`<label>Tactic name<input name="title" class="input" maxlength="100" value="${escape(item.title)}" required></label>`,'Rename',values => {
          const title = values.get('title').trim();
          if (!title) throw new Error('Enter a tactic name.');
          if (items.some(record => record.id !== item.id && record.title.toLowerCase() === title.toLowerCase())) {
            throw new Error('A saved tactic already has that name.');
          }
          const records = onRenameSaved(item.id,title);
          if (!Array.isArray(records)) throw new Error('Could not save the new name.');
          refresh(records);
        });
      });
      content.querySelector('[data-library-move]')?.addEventListener('click',() => {
        const current = locations.get(item.id) ?? '';
        const moveOption = (id,name) =>
          `<option value="${escape(id)}"${current === id ? ' selected' : ''}>${escape(name)}</option>`;
        showForm('Move tactic',`<label>Folder<select name="folder" class="input">
          ${moveOption('','Unfiled')}${folders.map(folder => moveOption(folder.id,folder.name)).join('')}</select></label>`,'Move',values => {
          moveLibraryTactic(item.id,values.get('folder'),items.map(record => record.id));
          refresh();
        });
      });
    });
  }

  for (const field of searchFields) {
    field.value = selected.query;
    field.addEventListener('input', () => {
      selected.query = field.value;
      searchFields.filter(input => input !== field).forEach(input => { input.value = field.value; });
      filter();
    });
    field.addEventListener('keydown', event => {
      if (event.key === 'Enter') container.querySelector('.home-saved').scrollIntoView({ block:'nearest', behavior:'smooth' });
    });
  }
  filter();
}

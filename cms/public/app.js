// Gallery editor frontend. Edits public/paintings.json through the small API in
// ../server.js. Every visible string is German; the code is not.

const SAVE_DELAY = 3000;   // autosave while typing
const POLL_DELAY = 3000;   // pick up images newly copied into public/images

const state = {
  data: {},
  images: [],
};

let saveTimer = null;
let saving = false;
let saveQueued = false;
let dirty = false;
let saveFailed = false;
let busy = false;   // a pull or an upload is running

const groupsEl   = document.getElementById('groups');
const statusEl   = document.getElementById('status');
const publishEl  = document.getElementById('publish');
const pullEl     = document.getElementById('pull');
const warningEl  = document.getElementById('publish-warning');

// --- helpers ---------------------------------------------------------------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fileName(imagePath) {
  return imagePath.replace(/^.*\//, '');
}

function thumbUrl(imagePath) {
  const base = fileName(imagePath).replace(/\.[^.]+$/, '');
  return `images/thumbs/${base}-800.webp`;
}

function workAt(groupName, index) {
  return state.data[groupName]?.works?.[index];
}

function missingEntries() {
  const available = new Set(state.images);
  const result = [];
  for (const [groupName, group] of Object.entries(state.data)) {
    group.works.forEach((work, index) => {
      if (!available.has(work.image)) result.push({ groupName, index, work });
    });
  }
  return result;
}

// Images used by an entry other than `self`. The entry's own image is not
// "taken" — it should stay in the normal list while she is editing it.
function usedImages(self) {
  const used = new Set();
  for (const group of Object.values(state.data)) {
    for (const work of group.works) {
      if (work !== self && work.image) used.add(work.image);
    }
  }
  return used;
}

function allMediums() {
  const values = new Set();
  for (const group of Object.values(state.data)) {
    for (const work of group.works) if (work.medium) values.add(work.medium);
  }
  return [...values].sort((a, b) => a.localeCompare(b, 'de'));
}

// "30 × 40 cm" -> { width: "30", height: "40" }
const DIMENSIONS = /^\s*(\d+(?:[.,]\d+)?)\s*[×xX*]\s*(\d+(?:[.,]\d+)?)\s*(?:cm)?\s*$/;

function parseDimensions(value) {
  if (!value) return { width: '', height: '' };
  const match = DIMENSIONS.exec(value);
  if (!match) return null;
  return { width: match[1].replace(',', '.'), height: match[2].replace(',', '.') };
}

function formatDimensions(width, height) {
  const w = String(width).trim();
  const h = String(height).trim();
  return w && h ? `${w} × ${h} cm` : '';
}

// --- saving ----------------------------------------------------------------

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.dataset.kind = kind;
}

function scheduleSave() {
  dirty = true;
  setStatus('Nicht gespeicherte Änderungen …', 'pending');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, SAVE_DELAY);
}

function saveNow() {
  clearTimeout(saveTimer);
  return save();
}

async function save() {
  if (saving) {
    saveQueued = true;
    return;
  }
  saving = true;
  setStatus('Wird gespeichert …', 'saving');
  try {
    const response = await fetch('/api/paintings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.data),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.error) throw new Error(body.error ?? 'Unbekannter Fehler');
    dirty = false;
    saveFailed = false;
    setStatus('Alle Änderungen gespeichert', 'ok');
  } catch (error) {
    saveFailed = true;
    setStatus(`Konnte nicht gespeichert werden: ${error.message}`, 'error');
  } finally {
    saving = false;
    updateHeader();
    if (saveQueued) {
      saveQueued = false;
      save();
    }
  }
}

// --- rendering -------------------------------------------------------------

function fillImageOptions(select, work) {
  const current = work.image;
  const used = usedImages(work);

  select.textContent = '';
  const empty = el('option', null, '— Bitte ein Bild auswählen —');
  empty.value = '';
  select.append(empty);

  if (current && !state.images.includes(current)) {
    const gone = el('option', null, `⚠ fehlt: ${fileName(current)}`);
    gone.value = current;
    select.append(gone);
  }

  // Unused images first, so the ones she most likely wants are at the top.
  const append = (label, images) => {
    if (!images.length) return;
    const optgroup = el('optgroup');
    optgroup.label = label;
    for (const image of images) {
      const option = el('option', null, fileName(image));
      option.value = image;
      optgroup.append(option);
    }
    select.append(optgroup);
  };

  append('Neu', state.images.filter((i) => !used.has(i)));
  append('Schon in der Gallerie', state.images.filter((i) => used.has(i)));

  select.value = current ?? '';
}

// Choosing an image changes what counts as "already used" everywhere else.
function refreshImageOptions() {
  for (const panel of groupsEl.querySelectorAll('.panel')) {
    const work = workAt(panel.dataset.group, Number(panel.dataset.index));
    if (work) fillImageOptions(panel.querySelector('.image-select'), work);
  }
}

function textField(label, value, onInput, { wide = false, type = 'text', attrs = {} } = {}) {
  const wrap = el('label', 'field' + (wide ? ' field--wide' : ''));
  wrap.append(el('span', 'field__label', label));
  const input = type === 'textarea' ? el('textarea') : el('input');
  if (type !== 'textarea') input.type = type;
  for (const [name, attrValue] of Object.entries(attrs)) input.setAttribute(name, attrValue);
  input.value = value ?? '';
  input.addEventListener('input', () => onInput(input.value));
  wrap.append(input);
  return wrap;
}

function dimensionsField(work) {
  const wrap = el('div', 'field field--dimensions');
  wrap.append(el('span', 'field__label', 'Maße'));
  const parsed = parseDimensions(work.dimensions);

  // Values that do not follow "Breite × Höhe cm" keep a plain text box, so
  // nothing gets lost silently.
  if (parsed === null) {
    const input = el('input');
    input.type = 'text';
    input.value = work.dimensions ?? '';
    input.addEventListener('input', () => {
      work.dimensions = input.value;
      scheduleSave();
    });
    wrap.append(input);
    return wrap;
  }

  const row = el('div', 'dimensions');
  const width = el('input');
  const height = el('input');
  for (const input of [width, height]) {
    input.type = 'number';
    input.min = '1';
    input.step = 'any';
    input.className = 'dimensions__number';
  }
  width.value = parsed.width;
  height.value = parsed.height;
  width.setAttribute('aria-label', 'Breite in Zentimetern');
  height.setAttribute('aria-label', 'Höhe in Zentimetern');

  const update = () => {
    work.dimensions = formatDimensions(width.value, height.value);
    scheduleSave();
  };
  width.addEventListener('input', update);
  height.addEventListener('input', update);

  row.append(width, el('span', 'dimensions__times', '×'), height, el('span', 'dimensions__unit', 'cm'));
  wrap.append(row);
  return wrap;
}

function iconButton(label, title, onClick, { disabled = false, className = '' } = {}) {
  const button = el('button', `icon-button ${className}`.trim(), label);
  button.type = 'button';
  button.title = title;
  button.setAttribute('aria-label', title);
  button.disabled = disabled;
  button.addEventListener('click', onClick);
  return button;
}

function createPanel(groupName, index) {
  const group = state.data[groupName];
  const work = group.works[index];

  const panel = el('article', 'panel');
  panel.dataset.group = groupName;
  panel.dataset.index = String(index);

  const thumb = el('div', 'panel__thumb');
  const img = el('img');
  img.alt = '';
  img.loading = 'lazy';
  thumb.append(img);

  const fields = el('div', 'panel__fields');
  const error = el('p', 'panel__error');
  error.hidden = true;

  const imageWrap = el('label', 'field field--wide');
  imageWrap.append(el('span', 'field__label', 'Bild'));
  const select = el('select', 'image-select');
  fillImageOptions(select, work);
  select.addEventListener('change', () => {
    work.image = select.value;
    updatePanelState(panel);
    refreshImageOptions();
    updateHeader();
    saveNow();
  });
  imageWrap.append(select);

  fields.append(
    error,
    imageWrap,
    textField('Titel', work.title, (value) => { work.title = value; scheduleSave(); }, { wide: true }),
    textField('Jahr', work.year, (value) => { work.year = value; scheduleSave(); }, {
      type: 'number',
      attrs: { min: '1900', max: '2100', step: '1' },
    }),
    textField('Technik', work.medium, (value) => { work.medium = value; scheduleSave(); }, {
      attrs: { list: 'mediums' },
    }),
    dimensionsField(work),
    textField('Notiz (wird in der Detailansicht gezeigt)', work.note, (value) => {
      work.note = value;
      scheduleSave();
    }, { wide: true, type: 'textarea' }),
  );

  const side = el('div', 'panel__side');
  side.append(
    iconButton('▲', 'Nach oben schieben', () => moveWork(groupName, index, -1), { disabled: index === 0 }),
    iconButton('▼', 'Nach unten schieben', () => moveWork(groupName, index, 1), {
      disabled: index === group.works.length - 1,
    }),
    iconButton('✕', 'Diesen Eintrag löschen', () => deleteWork(groupName, index), {
      className: 'icon-button--danger',
    }),
  );

  panel.append(thumb, fields, side);
  updatePanelState(panel);
  return panel;
}

function updatePanelState(panel) {
  const groupName = panel.dataset.group;
  const index = Number(panel.dataset.index);
  const work = workAt(groupName, index);
  if (!work) return;

  const error = panel.querySelector('.panel__error');
  const img = panel.querySelector('.panel__thumb img');
  const exists = state.images.includes(work.image);

  panel.classList.toggle('panel--error', !exists);
  if (!work.image) {
    error.textContent = 'Für diesen Eintrag ist noch kein Bild ausgewählt.';
    error.hidden = false;
  } else if (!exists) {
    error.textContent = `Die Bilddatei „${fileName(work.image)}" gibt es nicht (mehr). `
      + 'Bitte ein anderes Bild auswählen.';
    error.hidden = false;
  } else {
    error.hidden = true;
  }

  const wanted = exists ? thumbUrl(work.image) : '';
  if (img.dataset.for !== work.image) {
    img.dataset.for = work.image;
    if (wanted) {
      img.hidden = false;
      // The thumbnail may not exist yet for a freshly added photo — fall back
      // to the original, exactly like the website does.
      img.onerror = () => { img.onerror = null; img.src = work.image; };
      img.src = wanted;
    } else {
      img.hidden = true;
      img.removeAttribute('src');
    }
  }
}

function createGroup(groupName) {
  const group = state.data[groupName];
  const section = el('section', 'group');
  section.append(el('h2', 'group__title', groupName));

  const description = textField(
    'Beschreibung dieser Gruppe',
    group.description,
    (value) => { group.description = value; scheduleSave(); },
    { wide: true, type: 'textarea' },
  );
  description.classList.add('group__description');
  section.append(description);

  const list = el('div', 'group__works');
  group.works.forEach((_, index) => list.append(createPanel(groupName, index)));
  section.append(list);

  const add = el('button', 'button', '+ Neues Bild hinzufügen');
  add.type = 'button';
  add.addEventListener('click', () => addWork(groupName));
  section.append(add);

  return section;
}

function render() {
  groupsEl.textContent = '';

  const datalist = el('datalist');
  datalist.id = 'mediums';
  for (const medium of allMediums()) {
    const option = el('option');
    option.value = medium;
    datalist.append(option);
  }
  groupsEl.append(datalist);

  for (const groupName of Object.keys(state.data)) {
    groupsEl.append(createGroup(groupName));
  }
  updateHeader();
}

function updateHeader() {
  const missing = missingEntries();
  publishEl.disabled = busy || missing.length > 0 || saveFailed;
  pullEl.disabled = busy;

  if (missing.length) {
    warningEl.textContent = missing.length === 1
      ? '1 Eintrag hat kein gültiges Bild — bitte zuerst korrigieren.'
      : `${missing.length} Einträge haben kein gültiges Bild — bitte zuerst korrigieren.`;
    warningEl.hidden = false;
  } else if (saveFailed) {
    warningEl.textContent = 'Die letzten Änderungen konnten nicht gespeichert werden.';
    warningEl.hidden = false;
  } else {
    warningEl.hidden = true;
  }
}

// --- editing ---------------------------------------------------------------

function moveWork(groupName, index, direction) {
  const works = state.data[groupName].works;
  const target = index + direction;
  if (target < 0 || target >= works.length) return;
  [works[index], works[target]] = [works[target], works[index]];
  render();
  saveNow();
}

function deleteWork(groupName, index) {
  const work = state.data[groupName].works[index];
  const name = work.title || 'dieser Eintrag';
  if (!confirm(`„${name}" wirklich aus der Galerie entfernen?\n\nDas Bild selbst bleibt erhalten.`)) return;
  state.data[groupName].works.splice(index, 1);
  render();
  saveNow();
}

function addWork(groupName) {
  const works = state.data[groupName].works;
  const previous = works[works.length - 1];
  works.push({
    image: '',
    title: '',
    year: String(new Date().getFullYear()),
    medium: previous?.medium ?? '',
    dimensions: previous?.dimensions ?? '',
  });
  render();
  saveNow();
  const panels = groupsEl.querySelectorAll(`.panel[data-group="${CSS.escape(groupName)}"]`);
  const last = panels[panels.length - 1];
  last?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  last?.querySelector('select')?.focus();
}

// --- publishing ------------------------------------------------------------

const dialog        = document.getElementById('dialog');
const dialogTitle   = document.getElementById('dialog-title');
const dialogSteps   = document.getElementById('dialog-steps');
const dialogMessage = document.getElementById('dialog-message');
const dialogDetails = document.getElementById('dialog-details');
const dialogOutput  = document.getElementById('dialog-output');
const dialogClose   = document.getElementById('dialog-close');

dialogClose.addEventListener('click', () => { dialog.hidden = true; });

function showDialog(title, message) {
  dialog.hidden = false;
  dialogTitle.textContent = title;
  dialogSteps.textContent = '';
  dialogMessage.textContent = message ?? '';
  dialogMessage.dataset.kind = '';
  dialogDetails.hidden = true;
  dialogOutput.textContent = '';
  dialogClose.hidden = true;
}

function showResult(result) {
  dialogSteps.textContent = '';
  for (const step of result.steps ?? []) {
    dialogSteps.append(el('li', step.ok ? 'step step--ok' : 'step step--failed', step.label));
  }
  const failed = (result.steps ?? []).filter((step) => !step.ok || step.output);
  if (failed.length) {
    dialogOutput.textContent = failed.map((step) => `${step.label}\n${step.output}`).join('\n\n');
    dialogDetails.hidden = false;
  }
  dialogTitle.textContent = result.ok ? 'Fertig' : 'Es hat nicht geklappt';
  dialogMessage.textContent = result.ok ? (result.message ?? 'Fertig.') : (result.error ?? 'Unbekannter Fehler.');
  dialogMessage.dataset.kind = result.ok ? 'ok' : 'error';
  dialogClose.hidden = false;
}

publishEl.addEventListener('click', async () => {
  await saveNow();
  if (saveFailed) {
    showDialog('Es hat nicht geklappt');
    showResult({ ok: false, error: 'Die Änderungen konnten nicht gespeichert werden. Bitte kurz Bescheid geben.' });
    return;
  }
  showDialog('Wird hochgeladen …', 'Das dauert einen Moment. Bitte das Fenster offen lassen.');
  busy = true;
  updateHeader();
  try {
    const response = await fetch('/api/publish', { method: 'POST' });
    const result = await response.json().catch(() => ({ ok: false, error: 'Unerwartete Antwort vom Server.' }));
    showResult(result);
  } catch (error) {
    showResult({ ok: false, error: `Der Editor ist nicht erreichbar: ${error.message}` });
  } finally {
    busy = false;
    updateHeader();
  }
});

async function reload() {
  const response = await fetch('/api/state');
  const body = await response.json();
  if (body.error) throw new Error(body.error);
  state.data = body.data;
  state.images = body.images;
  dirty = false;
  render();
  setStatus('Alle Änderungen gespeichert', 'ok');
}

pullEl.addEventListener('click', async () => {
  await saveNow();
  busy = true;
  updateHeader();
  showDialog('Wird heruntergeladen …', 'Einen Moment bitte.');
  try {
    const response = await fetch('/api/pull', { method: 'POST' });
    const result = await response.json().catch(() => ({
      ok: false,
      error: 'Unerwartete Antwort vom Editor.',
    }));
    if (result.ok && result.changed) await reload();
    showResult(result);
  } catch (error) {
    showResult({ ok: false, error: `Der Editor ist nicht erreichbar: ${error.message}` });
  } finally {
    busy = false;
    updateHeader();
  }
});

// --- startup ---------------------------------------------------------------

async function pollImages() {
  try {
    const response = await fetch('/api/images');
    const body = await response.json();
    const images = body.images ?? [];
    if (images.join('\n') === state.images.join('\n')) return;
    state.images = images;
    for (const panel of groupsEl.querySelectorAll('.panel')) {
      const work = workAt(panel.dataset.group, Number(panel.dataset.index));
      if (!work) continue;
      fillImageOptions(panel.querySelector('.image-select'), work);
      panel.querySelector('.panel__thumb img').dataset.for = '';
      updatePanelState(panel);
    }
    updateHeader();
  } catch {
    // The server may be restarting — try again on the next tick.
  }
}

window.addEventListener('beforeunload', (event) => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

async function init() {
  try {
    const response = await fetch('/api/state');
    const body = await response.json();
    if (body.error) throw new Error(body.error);
    state.data = body.data;
    state.images = body.images;
    render();
    setStatus('Alle Änderungen gespeichert', 'ok');
    setInterval(pollImages, POLL_DELAY);
  } catch (error) {
    setStatus(`Die Galerie konnte nicht geladen werden: ${error.message}`, 'error');
  }
}

init();

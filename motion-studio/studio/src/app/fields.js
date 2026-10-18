// Form editors for story fields. Each editor writes straight into project.fields via update().
import { h, icon, toast, pickFiles, dropTarget } from './ui.js';
import { normalizePhoto, fileToDataURL } from '../engine/media.js';

const IMG_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';

export function fieldEditor(field, store) {
  const get = () => store.state.project.fields[field.key];
  const set = (v, kind = 'content') => store.update(p => { p.fields[field.key] = v; }, kind);
  const E = EDITORS[field.type] || EDITORS.text;
  const body = E(field, get, set, store);
  const label = h('div', { class: 'field-label' },
    h('span', null, field.label, field.required ? h('span', { class: 'req', title: 'Required' }, ' *') : null),
    !field.required && !['image', 'images'].includes(field.type) ? h('span', { class: 'opt' }, 'optional') : null);
  const wrap = h('div', { class: 'field', 'data-field': field.key, style: { display: 'grid', gap: '6px' } }, label, body, field.help ? h('div', { class: 'help' }, field.help) : null);
  return wrap;
}

const EDITORS = {
  text(f, get, set) {
    return h('input', { type: 'text', value: get() ?? '', placeholder: f.placeholder || '', 'aria-label': f.label, oninput: e => set(e.target.value) });
  },
  url(f, get, set) {
    const inp = h('input', { type: 'url', value: get() ?? '', placeholder: f.placeholder || 'https://', 'aria-label': f.label, inputmode: 'url',
      oninput: e => set(e.target.value.trim()),
      onblur: e => { const v = e.target.value.trim(); if (v && !/^https?:\/\//i.test(v) && /\./.test(v)) { e.target.value = 'https://' + v; set(e.target.value); } } });
    return inp;
  },
  number(f, get, set) {
    return h('input', { type: 'number', value: get() ?? '', placeholder: f.placeholder || '', min: f.min, max: f.max, 'aria-label': f.label, oninput: e => set(e.target.value === '' ? '' : Number(e.target.value)) });
  },
  textarea(f, get, set) {
    return h('textarea', { rows: 3, placeholder: f.placeholder || '', 'aria-label': f.label, oninput: e => set(e.target.value) }, get() ?? '');
  },
  select(f, get, set) {
    const sel = h('select', { 'aria-label': f.label, onchange: e => set(e.target.value, 'structure') },
      f.options.map(o => h('option', { value: o.value }, o.label)));
    sel.value = get() ?? f.default ?? f.options[0]?.value;
    return sel;
  },
  image(f, get, set) {
    const box = h('div', { class: 'uploader' });
    const render = () => {
      const v = get();
      const src = v?.src || v;
      box.replaceChildren(src
        ? h('div', { class: 'single-img' }, h('img', { src, alt: f.label }), h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
          h('button', { class: 'btn sm', onclick: choose }, icon('upload'), 'Replace'),
          h('button', { class: 'btn sm ghost', onclick: () => { set(null, 'structure'); render(); } }, icon('trash'), 'Remove')))
        : dropZone(`Drop ${f.label.toLowerCase()} here or click to upload`, files => add(files[0]), choose));
    };
    const add = async file => {
      if (!file || !file.type.startsWith('image/')) { toast('That file is not an image. Use JPG, PNG or WebP.', { error: true }); return; }
      const src = await normalizePhoto(file, 2000);
      set({ src, name: file.name }, 'structure');
      render();
    };
    const choose = async () => { const [file] = await pickFiles({ accept: IMG_ACCEPT }); if (file) add(file); };
    render();
    return box;
  },
  images(f, get, set) {
    const box = h('div', { class: 'uploader' });
    const list = () => (Array.isArray(get()) ? get() : []);
    const render = () => {
      const items = list();
      const rows = items.map((it, i) => h('div', { class: 'thumb-row' },
        h('img', { src: it.src, alt: `Photo ${i + 1}` }),
        f.captions
          ? h('div', { class: 'cap' },
            h('input', { type: 'text', value: it.caption || '', placeholder: 'Caption (e.g. Silver Lake)', 'aria-label': `Caption for photo ${i + 1}`, oninput: e => { items[i].caption = e.target.value; set(items); } }),
            h('input', { type: 'text', value: it.sub || '', placeholder: 'Detail (e.g. Sold $1.2M)', 'aria-label': `Detail for photo ${i + 1}`, oninput: e => { items[i].sub = e.target.value; set(items); } }))
          : h('span', { class: 'help' }, it.name || `Photo ${i + 1}`),
        h('div', { class: 'row-tools' },
          h('button', { title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onclick: () => { [items[i - 1], items[i]] = [items[i], items[i - 1]]; set(items, 'structure'); render(); } }, icon('up')),
          h('button', { title: 'Move down', 'aria-label': 'Move down', disabled: i === items.length - 1, onclick: () => { [items[i + 1], items[i]] = [items[i], items[i + 1]]; set(items, 'structure'); render(); } }, icon('down')),
          h('button', { title: 'Remove', 'aria-label': 'Remove photo', onclick: () => { items.splice(i, 1); set(items, 'structure'); render(); } }, icon('trash')))));
      const count = h('div', { class: 'help' }, `${items.length} added${f.recommended ? ` · ${f.recommended} recommended` : ''}${f.max ? ` · up to ${f.max}` : ''}`);
      box.replaceChildren(dropZone(`Drop ${f.unit || 'photos'} here or click to upload (you can select several)`, add, choose), items.length ? h('div', { class: 'thumbs' }, rows) : null, count);
    };
    const add = async files => {
      const imgs = files.filter(x => x.type.startsWith('image/'));
      if (imgs.length < files.length) toast('Some files were skipped because they are not images.');
      const items = list().slice();
      for (const file of imgs) items.push({ src: await normalizePhoto(file, 1800), name: file.name, caption: '', sub: '' });
      if (f.max && items.length > f.max) toast(`That's ${items.length} photos. The first ${f.max} will be used; remove some or lengthen the video.`);
      set(items, 'structure');
      render();
    };
    const choose = async () => { const files = await pickFiles({ accept: IMG_ACCEPT, multiple: true }); if (files.length) add(files); };
    render();
    return box;
  },
  stats(f, get, set) {
    return rowsEditor(f, get, set, [{ key: 'value', ph: '24', w: 0.9 }, { key: 'label', ph: 'What it measures', w: 1.4 }], 'Add a number');
  },
  rows(f, get, set) {
    return rowsEditor(f, get, set, [{ key: 'name', ph: 'Name', w: 1.4 }, { key: 'value', ph: 'Value', w: 0.9 }], 'Add a row', true);
  },
  series(f, get, set) {
    return rowsEditor(f, get, set, [{ key: 'label', ph: 'Label (e.g. Jun)', w: 1.2 }, { key: 'value', ph: 'Value', w: 0.9 }], 'Add a data point', true);
  },
  milestones(f, get, set) {
    return rowsEditor(f, get, set, [{ key: 'label', ph: 'Milestone', w: 1.4 }, { key: 'title', ph: 'When (e.g. Day 7)', w: 0.9 }], 'Add a milestone');
  },
  list(f, get, set) {
    const box = h('div', { class: 'rows' });
    const items = () => (Array.isArray(get()) ? get() : []);
    const render = () => {
      const arr = items();
      const ph = Array.isArray(f.placeholder) ? f.placeholder : [];
      box.replaceChildren(
        ...arr.map((v, i) => h('div', { class: 'row' },
          h('input', { type: 'text', value: typeof v === 'string' ? v : v.text || '', placeholder: ph[i] || 'Type an item', 'aria-label': `${f.label} ${i + 1}`, oninput: e => { arr[i] = e.target.value; set(arr); } }),
          tools(arr, i, () => { set(arr, 'structure'); render(); }))),
        (!f.max || arr.length < f.max) ? h('button', { class: 'btn sm add-row', onclick: () => { arr.push(''); set(arr, 'structure'); render(); box.querySelector('.row:last-of-type input')?.focus(); } }, icon('plus'), arr.length ? 'Add another' : 'Add an item') : null,
        !arr.length && ph.length ? h('button', { class: 'btn sm ghost add-row', onclick: () => { set([...ph], 'structure'); render(); } }, 'Use the example items as a starting point') : null);
    };
    render();
    return box;
  },
  callouts(f, get, set, store) {
    const box = h('div', { class: 'uploader' });
    const render = () => {
      const shot = store.state.project.fields.screenshot;
      const src = shot?.src || shot;
      const arr = Array.isArray(get()) ? get() : [];
      if (!src) { box.replaceChildren(h('div', { class: 'help' }, 'Add a screenshot first, then click on it to point at the numbers that matter.')); return; }
      const board = h('div', { class: 'callout-board', title: 'Click to add a callout' }, h('img', { src, alt: 'Screenshot' }),
        ...arr.map((c, i) => h('span', { class: 'pin', style: { left: `${c.x * 100}%`, top: `${c.y * 100}%` } }, String(i + 1))));
      board.addEventListener('click', e => {
        if (f.max && arr.length >= f.max) { toast(`Up to ${f.max} callouts keeps it readable.`); return; }
        const r = board.getBoundingClientRect();
        arr.push({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, label: '' });
        set(arr, 'structure'); render();
        box.querySelector('.row:last-of-type input')?.focus();
      });
      box.replaceChildren(board, h('div', { class: 'rows' }, arr.map((c, i) => h('div', { class: 'row' },
        h('input', { type: 'text', value: c.label || '', placeholder: `Callout ${i + 1} label (e.g. 42% conversion)`, oninput: e => { arr[i].label = e.target.value; set(arr); } }),
        tools(arr, i, () => { set(arr, 'structure'); render(); })))),
      h('div', { class: 'help' }, 'Click the screenshot to drop a numbered callout. Keep labels short.'));
    };
    render();
    store.on(kind => { if (kind === 'structure' && box.isConnected) { /* screenshot may have changed */ } });
    box.refresh = render;
    return box;
  },
};

function rowsEditor(f, get, set, cols, addLabel, pair = false) {
  const box = h('div', { class: 'rows' });
  const items = () => (Array.isArray(get()) ? get() : []);
  const render = () => {
    const arr = items();
    const ph = Array.isArray(f.placeholder) ? f.placeholder : [];
    box.replaceChildren(
      ...arr.map((v, i) => h('div', { class: 'row pair', style: { gridTemplateColumns: `${cols.map(c => `minmax(0, ${c.w}fr)`).join(' ')} auto` } },
        cols.map(c => h('input', { type: 'text', value: v[c.key] ?? '', placeholder: ph[i]?.[c.key] || c.ph, 'aria-label': `${f.label} ${i + 1} ${c.key}`, oninput: e => { arr[i][c.key] = e.target.value; set(arr); } })),
        tools(arr, i, () => { set(arr, 'structure'); render(); }))),
      (!f.max || arr.length < f.max) ? h('button', { class: 'btn sm add-row', onclick: () => { arr.push(Object.fromEntries(cols.map(c => [c.key, '']))); set(arr, 'structure'); render(); box.querySelector('.row:last-of-type input')?.focus(); } }, icon('plus'), addLabel) : null);
    void pair;
  };
  render();
  return box;
}

function tools(arr, i, done) {
  return h('div', { class: 'row-tools' },
    h('button', { title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; done(); } }, icon('up')),
    h('button', { title: 'Remove', 'aria-label': 'Remove', onclick: () => { arr.splice(i, 1); done(); } }, icon('trash')));
}

function dropZone(text, onFiles, onClick) {
  const d = h('button', { type: 'button', class: 'drop', onclick: onClick }, icon('upload'), h('span', null, text));
  dropTarget(d, onFiles);
  return d;
}

export async function readAudio(file) {
  if (!file.type.startsWith('audio/')) { toast('That file is not audio. Use MP3, M4A or WAV.', { error: true }); return null; }
  if (file.size > 25e6) { toast('That audio file is over 25 MB. Trim it or export a smaller MP3.', { error: true }); return null; }
  return fileToDataURL(file);
}

/* ---------- Taskora: Notes Workspace & Slash Commands Engine ---------- */

let nb = { notes: [], cards: [], cur: null };
let view = 'all';
let notesMode = 'right';
let lastDock = 'right';
let lastSaved = 0;
let lastNoteDel = null;

const editor = $('#nText');
const titleEl = $('#ntitle');

function plainOf(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.innerText || '';
}

function titleOf(n) {
  if (n.title) return n.title;
  const first = plainOf(n.html).split('\n').map(s => s.trim()).find(Boolean);
  return first || 'Untitled';
}

function snippetOf(n) {
  const lines = plainOf(n.html).split('\n').map(s => s.trim()).filter(Boolean);
  return (n.title ? lines : lines.slice(1)).join(' ').slice(0, 140) || 'No more text';
}

function persistNotes() {
  store.set(NOTES_KEY, JSON.stringify(nb));
  $('#status').textContent = 'Saved';
}

function loadNotes() {
  try {
    nb = JSON.parse(store.get(NOTES_KEY)) || nb;
  } catch {}
  if (!nb.notes || !nb.notes.length) {
    const old = store.get(OLD_DRAFT) || '';
    const id = 'n' + Date.now();
    nb = {
      notes: [{
        id,
        html: old || '<div>Welcome to your notes</div><div>Write here. Add a tag like /do now on its own line, then tasks below it.</div>',
        updated: Date.now()
      }],
      cards: [],
      cur: id
    };
    store.set(OLD_DRAFT, '');
  }
  if (!nb.cur || !nb.notes.find(n => n.id === nb.cur)) {
    nb.cur = nb.notes[0].id;
  }
  if (!nb.notes.find(n => n.id === 'fmt-guide')) {
    nb.notes.push({ id: 'fmt-guide', title: 'Formatting options', html: FORMAT_PREVIEW, updated: Date.now() - 1 });
  }
}

const curNote = () => nb.notes.find(n => n.id === nb.cur);

function newNote() {
  const id = 'n' + Date.now();
  nb.notes.unshift({ id, html: '', updated: Date.now() });
  nb.cur = id;
  persistNotes();
  setView('all');
  openNote(id);
  titleEl.focus();
}

function openNote(id) {
  nb.cur = id;
  const n = curNote();
  if (!n) return;
  titleEl.value = n.title || '';
  editor.innerHTML = n.html;
  highlightCmds();
  updatePreview();
  renderList();
  renderCrumb();
  persistNotes();
}

function renderCrumb() {
  const n = curNote();
  $('#crumb').textContent = view === 'cards' ? 'Cards' : `All notes › ${n ? titleOf(n) : ''}`;
}

function renderList() {
  const q = ($('#search').value || '').toLowerCase();
  const items = nb.notes.filter(n => !q || plainOf(n.html).toLowerCase().includes(q)).sort((a, b) => b.updated - a.updated);
  $('#nlist').innerHTML = items.length
    ? items.map(n => `<li class="nitem" data-id="${n.id}" aria-current="${n.id === nb.cur}"><b>${esc(titleOf(n))}</b><span>${esc(snippetOf(n))}</span><button class="ndel" data-del="${n.id}" aria-label="Delete note" title="Delete note">✕</button></li>`).join('')
    : '<li class="empty">No notes found</li>';
  $('#tagList').innerHTML = ORDER.map(k => `<button data-box="${k}" title="Type /${Q[k].label.toLowerCase()} on its own line. Lines below it go into ${Q[k].label}"><code>/${Q[k].label.toLowerCase()}</code></button>`).join('');
}

function renderCards() {
  const el = $('#cardView');
  if (!nb.cards.length) {
    el.innerHTML = '<div class="empty">Cards keep important notes one click away. Each card holds one note. Open a note and press "Add to card" to create one.</div>';
    return;
  }
  el.innerHTML = nb.cards.map(c => {
    const n = nb.notes.find(x => x.id === c.noteId);
    if (!n) return '';
    return `<div class="card" data-note="${n.id}" style="position:relative"><button class="cdel" data-card="${c.id}" aria-label="Remove from cards" title="Remove from cards" style="position:absolute;top:6px;right:6px;background:none;border:0;color:var(--muted);padding:2px 5px">✕</button><b>${esc(titleOf(n))}</b><span>${esc(snippetOf(n))}</span></div>`;
  }).join('');
}

function setView(v) {
  view = v;
  document.querySelectorAll('.side [data-view]').forEach(b => b.setAttribute('aria-current', b.dataset.view === v));
  $('#noteView').hidden = v === 'cards';
  $('#cardView').hidden = v !== 'cards';
  $('#listTitle').textContent = v === 'cards' ? 'Cards' : 'All notes';
  if (v === 'cards') renderCards();
  renderCrumb();
  renderList();
}

function addCard() {
  const n = curNote();
  if (!n) return;
  if (nb.cards.find(c => c.noteId === n.id)) return showToast('This note is already on a card', false);
  nb.cards.push({ id: 'c' + Date.now(), noteId: n.id });
  persistNotes();
  showToast('Added to cards', false);
}

function saveCurrent() {
  const n = curNote();
  if (!n) return;
  n.html = editor.innerHTML;
  n.updated = Date.now();
  n.title = titleEl.value.trim();
  persistNotes();
  renderList();
}

function deleteNote(id) {
  const n = id ? nb.notes.find(x => x.id === id) : curNote();
  if (!n) return;
  const idx = nb.notes.indexOf(n);
  nb.notes.splice(idx, 1);
  nb.cards = nb.cards.filter(c => c.noteId !== n.id);
  lastRemoved = null;
  lastNoteDel = { n, idx };
  if (!nb.notes.length) nb.notes.push({ id: 'n' + Date.now(), html: '', updated: Date.now() });
  nb.cur = nb.notes[0].id;
  persistNotes();
  openNote(nb.cur);
  setView(view);
  showToast('Note deleted', true);
}

function caretOffset() {
  try {
    const s = getSelection();
    if (!s.rangeCount) return 0;
    const r = s.getRangeAt(0).cloneRange();
    r.selectNodeContents(editor);
    r.setEnd(s.anchorNode, s.anchorOffset);
    return r.toString().length;
  } catch {
    return 0;
  }
}

function placeCaret(n, o) {
  const r = document.createRange();
  r.setStart(n, o);
  r.collapse(true);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
}

function setCaret(off) {
  const w = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let n, acc = 0, last = null;
  while ((n = w.nextNode())) {
    last = n;
    if (acc + n.length >= off) {
      placeCaret(n, off - acc);
      return;
    }
    acc += n.length;
  }
  if (last) placeCaret(last, last.length);
}

function highlightCmds() {
  const focused = document.activeElement === editor;
  const off = focused ? caretOffset() : 0;
  [...editor.childNodes].forEach(node => {
    if (node.nodeType === 3 && node.textContent.trim()) {
      const d = document.createElement('div');
      d.textContent = node.textContent;
      editor.replaceChild(d, node);
    }
  });
  const split = new RegExp('(\\/(?:do now|deep work|delegate|drop)(?=\\s|$))', 'i');
  const all = new RegExp('\\/(?:do now|deep work|delegate|drop)(?=\\s|$)', 'gi');
  [...editor.children].forEach(el => {
    const text = el.textContent || '';
    const want = text.match(all) || [];
    const have = [...el.querySelectorAll('.cmd')].map(s => s.textContent);
    if (JSON.stringify(want) === JSON.stringify(have)) return;
    el.innerHTML = text.split(split).map((p, i) => i % 2 ? `<span class="cmd">${esc(p)}</span>` : esc(p)).join('');
  });
  if (focused) setCaret(off);
}

/* ---------- Scheduling from notes ---------- */
const FORMAT_PREVIEW = '<div><b>Option 1: Word-style ribbon (recommended)</b></div><div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0"><span style="border:1px solid #888;border-radius:8px;padding:4px 10px">Normal</span><span style="border:1px solid #888;border-radius:8px;padding:4px 10px"><b>B</b> <i>I</i> <u>U</u> <s>S</s></span><span style="border:1px solid #888;border-radius:8px;padding:4px 10px">• 1.</span><span style="border:1px solid #888;border-radius:8px;padding:4px 10px">Left Center Right</span></div><div>Related tools sit in one bordered group, with the same height and gap. Easy to scan, like Word.</div><div><br></div><div><b>Option 2: Floating bar on selection</b></div><div>Select text and a small bar appears above it with B, I, link and heading. Clean screen, but harder to discover.</div><div><br></div><div><b>Option 3: Slash menu for tags</b></div><div>Type / on a new line. A menu lists /do now, /deep work, /delegate and /drop, each with its meaning.</div><div><br></div><div><b>Option 4: Floating panel on selection</b></div><div><br></div><div><b>Recommendation:</b> Option 1 for formatting, Option 3 for scheduling. Option 2 only if you want the screen as empty as possible.</div>';

const slash = $('#slash');
let slashItems = [];
let slashIdx = 0;
let slashCtx = null;
const SLASH_DESC = {
  do: 'Urgent and important',
  decide: 'Important, not urgent',
  delegate: 'Urgent, not important',
  delete: 'Neither urgent nor important'
};

function hideSlash() {
  slash.hidden = true;
  slashCtx = null;
}

function renderSlash() {
  slash.innerHTML = slashItems.map((k, i) => `<button data-slash="${k}" aria-selected="${i === slashIdx}"><b>/${Q[k].label.toLowerCase()}</b><span>${SLASH_DESC[k]}</span></button>`).join('');
}

function slashCheck() {
  const s = getSelection();
  const node = s.rangeCount ? s.anchorNode : null;
  if (!node || node.nodeType !== 3 || !editor.contains(node) || !s.isCollapsed) return hideSlash();
  const before = node.textContent.slice(0, s.anchorOffset);
  const m = before.match(/(^|\s)\/([a-z ]*)$/i);
  if (!m) return hideSlash();
  const q = m[2].toLowerCase();
  slashItems = ORDER.filter(k => Q[k].label.toLowerCase().startsWith(q));
  if (!slashItems.length) return hideSlash();
  slashCtx = { node, start: before.length - m[0].length + m[1].length, caret: s.anchorOffset };
  slashIdx = 0;
  renderSlash();
  const r = s.getRangeAt(0).getBoundingClientRect();
  slash.style.left = Math.max(8, r.left) + 'px';
  slash.style.top = (r.bottom + 8) + 'px';
  slash.hidden = false;
}

function chooseSlash(k) {
  if (!slashCtx) return hideSlash();
  const { node, start, caret } = slashCtx;
  const lbl = '/' + Q[k].label.toLowerCase();
  const txt = node.textContent;
  node.textContent = txt.slice(0, start) + lbl + ' ' + txt.slice(caret);
  editor.focus();
  placeCaret(node, start + lbl.length + 1);
  hideSlash();
  highlightCmds();
  saveCurrent();
  updatePreview();
}

function boxFromTag(s) {
  const n = s.toLowerCase().replace(/\s+/g, ' ').trim();
  return ORDER.find(k => Q[k].label.toLowerCase() === n || k === n) || null;
}

function parseNotes(text) {
  const out = { do: [], decide: [], delegate: [], delete: [] };
  const unknown = [];
  const skipped = [];
  let cur = null;
  const split = new RegExp('(\\/(?:do now|deep work|delegate|drop)(?=\\s|$))', 'i');
  const startsTag = new RegExp('^\\/(?:do now|deep work|delegate|drop)(?=\\s|$)', 'i');
  const route = t => {
    const l = t.toLowerCase();
    const u = /urgent|asap|today|deadline/.test(l);
    const imp = /important|priority/.test(l);
    const k = u && imp ? 'do' : imp ? 'decide' : u ? 'delegate' : null;
    if (k) out[k].push(t);
    else skipped.push(t);
  };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('/') && !startsTag.test(line)) {
      unknown.push(line.split(/\s/)[0]);
      cur = null;
      continue;
    }
    const parts = line.split(split);
    const pre = parts[0].replace(/^[-•*]\s*/, '').trim();
    if (pre) {
      if (cur) out[cur].push(pre);
      else route(pre);
    }
    for (let i = 1; i < parts.length; i += 2) {
      const k = boxFromTag(parts[i].slice(1));
      cur = k;
      const t = (parts[i + 1] || '').replace(/^[-•*]\s*/, '').trim();
      if (t) out[k].push(t);
    }
  }
  return { out, unknown, skipped };
}

function updatePreview() {
  const { out, unknown, skipped } = parseNotes(plainOf(editor.innerHTML));
  const total = ORDER.reduce((s, k) => s + out[k].length, 0);
  let h = total
    ? `<b>${total} task${total === 1 ? '' : 's'} ready:</b> ` + ORDER.map(k => `${Q[k].label} ${out[k].length}`).join(' · ')
    : 'No scheduled lines yet. Start a line with a tag, like /do now';
  if (unknown.length) h += `<br><span class="warn">Unknown tag: ${esc(unknown.join(', '))}</span>`;
  if (skipped.length) h += `<br><span class="warn">${skipped.length} line${skipped.length === 1 ? '' : 's'} without a box. Add a tag above them.</span>`;
  $('#nPre').innerHTML = h;
}

function scheduleNote() {
  const { out } = parseNotes(plainOf(editor.innerHTML));
  const now = Date.now();
  let count = 0;
  ORDER.forEach(k => out[k].forEach(title => {
    const id = now + count;
    tasks.push({ id, created: id, q: k, title, due: '', done: false });
    count++;
  }));
  if (!count) return showToast('No tasks found in this note', false);
  saveTasks();
  render();
  showToast(`${count} task${count === 1 ? '' : 's'} scheduled`, false);
}

/* ---------- Panel Docking & Modals ---------- */
function applyMode() {
  const p = $('#notes');
  p.dataset.mode = notesMode;
  document.querySelectorAll('.wctl [data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === notesMode));
  const open = !p.hidden;
  document.body.classList.toggle('dock-left', open && notesMode === 'left');
  document.body.classList.toggle('dock-right', open && notesMode === 'right');
}

function setMode(m) {
  notesMode = m;
  if (m !== 'min') lastDock = m;
  store.set(MODE_KEY, m);
  applyMode();
}

function openNotes() {
  $('#notes').hidden = false;
  applyMode();
  if (!curNote()) newNote();
  openNote(nb.cur);
  setView(view);
  editor.focus();
}

function closeNotes() {
  saveCurrent();
  $('#notes').hidden = true;
  applyMode();
}

function openGuide() {
  $('#guide').hidden = false;
  $('#gDone').focus();
}

function closeGuide() {
  $('#guide').hidden = true;
  store.set(GUIDE_KEY, '1');
}

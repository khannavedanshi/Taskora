/* ---------- Taskora: Eisenhower Matrix & Task Management Engine ---------- */

const KEY = 'taskora-matrix-v1';
const THEME_KEY = 'taskora-theme';
const GUIDE_KEY = 'taskora-guide-seen';
const NOTES_KEY = 'taskora-notes-v2';
const OLD_DRAFT = 'taskora-notes-draft';
const MODE_KEY = 'taskora-notes-mode';

const Q = {
  do: {
    label: 'DO NOW',
    axis: 'Urgent · Important',
    desc: 'Act now. Needs action within 24–48 hours.',
    empty: 'Nothing urgent and important right now.'
  },
  decide: {
    label: 'DEEP WORK',
    axis: 'Not urgent · Important',
    desc: 'Protect time for it. Important, but not urgent.',
    empty: 'Plan the important work before it turns urgent.'
  },
  delegate: {
    label: 'DELEGATE',
    axis: 'Urgent · Not important',
    desc: 'Hand it off, or batch it quickly.',
    empty: 'Hand off urgent tasks that do not need you.'
  },
  delete: {
    label: 'DROP',
    axis: 'Not urgent · Not important',
    desc: 'Drop it or park it. Low value.',
    empty: 'Drop anything that does not matter.'
  }
};

const ORDER = ['do', 'decide', 'delegate', 'delete'];
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayStr = ymd(new Date());
const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };

const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  }
};

let tasks = [];
let drafts = {};
let editId = null;
let focusMode = false;
let lastRemoved = null;
let toastTimer = null;
let lastAdded = null;
let active = 'do';

/* ---------- Matrix tasks logic ---------- */
function seed() {
  return [
    [1, 'do', 'Fix the login bug blocking the demo', todayStr, false],
    [2, 'do', 'Submit the scholarship form', addDays(-1), true],
    [3, 'decide', 'Choose a stack for the side project', addDays(4), false],
    [4, 'decide', 'Plan next month’s learning goals', '', false],
    [5, 'delegate', 'Book the team meeting room', addDays(1), false],
    [6, 'delegate', 'Collect feedback from classmates', '', false],
    [7, 'delete', 'Reorganize old screenshots', '', false]
  ].map(([id, q, title, due, done]) => ({ id, created: id, q, title, due, done }));
}

function loadTasks() {
  try {
    const v = JSON.parse(store.get(KEY));
    tasks = Array.isArray(v) ? v : seed();
  } catch {
    tasks = seed();
  }
}

function saveTasks() {
  store.set(KEY, JSON.stringify(tasks));
}

const dueKey = t => t.due ? Date.parse(t.due + 'T00:00') : 9e15;
const sortTasks = l => [...l].sort((a, b) => a.done - b.done || dueKey(a) - dueKey(b) || a.created - b.created);

function dueBadge(t) {
  if (!t.due) return '';
  const diff = Math.round((Date.parse(t.due + 'T00:00') - Date.parse(todayStr + 'T00:00')) / 864e5);
  let label, cls = '';
  if (diff < 0) {
    label = new Date(t.due + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    cls = t.done ? '' : 'over';
  } else if (diff === 0) {
    label = 'Today';
    cls = 'today';
  } else if (diff === 1) {
    label = 'Tomorrow';
  } else {
    label = new Date(t.due + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return `<span class="due ${cls}">${label}</span>`;
}

function itemHTML(t) {
  if (t.id === editId) {
    return `<li class="task"><div class="erow"><input class="ein" value="${esc(t.title)}" aria-label="Task title"><input type="date" class="ed" value="${t.due || ''}" aria-label="Due date"><button class="ok" data-act="save">Save</button><button class="cancel" data-act="cancel">Cancel</button></div></li>`;
  }
  const opts = ORDER.map(k => `<option value="${k}" ${k === t.q ? 'selected' : ''}>${Q[k].label}</option>`).join('');
  const cls = ['task', t.done ? 'done' : '', t.id === lastAdded ? 'enter' : ''].join(' ');
  return `<li class="${cls}" data-id="${t.id}" tabindex="0"><input type="checkbox" class="cb" ${t.done ? 'checked' : ''} aria-label="Mark complete"><div class="tmain"><span class="tt" title="Double-click to rename">${esc(t.title)}</span>${dueBadge(t)}</div><select class="mv" aria-label="Move to another box">${opts}</select><button class="del" aria-label="Delete task">✕</button></li>`;
}

function quadHTML(q) {
  const items = sortTasks(tasks.filter(t => t.q === q));
  const done = items.filter(t => t.done).length;
  const n = items.length;
  const pct = n ? Math.round(done / n * 100) : 0;
  const list = items.length ? items.map(itemHTML).join('') : `<li class="qempty">${Q[q].empty}</li>`;
  return `<article class="quad ${q}${q === active ? ' active' : ''}" data-q="${q}"><header class="qh"><div><h2>${Q[q].label}</h2><p class="axis">${Q[q].axis}</p><p class="desc">${Q[q].desc}</p></div><span class="qcount">${n - done} open</span></header><div class="qbar"><i style="width:${pct}%"></i></div><ul class="qlist">${list}</ul><div class="qadd"><input class="qin" data-q="${q}" value="${esc(drafts[q] || '')}" placeholder="Add to ${Q[q].label.toLowerCase()}…" aria-label="New task in ${Q[q].label}" autocomplete="off"><input type="date" class="qdate" data-q="${q}" value="${drafts['d' + q] || ''}" aria-label="Due date"><button class="qbtn" data-add="${q}">Add</button></div></article>`;
}

function render() {
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const open = total - done;
  const pct = total ? Math.round(done / total * 100) : 0;
  const seg = ORDER.map((k, i) => {
    const c = tasks.filter(t => t.q === k).length;
    return `<i style="flex:${c};opacity:${[1, 0.7, 0.45, 0.25][i]}" data-tip="${Q[k].label}: ${c}"></i>`;
  }).join('');

  $('#stats').innerHTML = `<div class="stat"><span>Total</span><strong>${total}</strong><div class="seg">${seg}</div></div><div class="stat"><span>Open</span><strong>${open}</strong><small>${total ? 100 - pct : 0}% remaining</small></div><div class="stat"><span>Completed</span><strong>${done}</strong><small>${pct}% of all</small></div><div class="stat"><span>Progress</span><strong>${pct}%</strong><div class="bar"><i style="width:${pct}%"></i></div></div>`;
  $('#matrix').className = 'matrix' + (focusMode ? ' focus' : '');
  $('#matrix').innerHTML = `<button class="corner" id="penBtn" aria-label="Open notes" data-tip="Notes"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button><div class="colhead">Urgent</div><div class="colhead">Not urgent</div><div class="rail top"><span>Important</span></div>${quadHTML('do')}${quadHTML('decide')}<div class="rail bottom"><span>Not important</span></div>${quadHTML('delegate')}${quadHTML('delete')}`;
  $('#focusBtn').setAttribute('aria-pressed', focusMode);
  lastAdded = null;
}

function setActive(q) {
  if (!q || q === active) return;
  active = q;
  document.querySelectorAll('.quad').forEach(el => el.classList.toggle('active', el.dataset.q === q));
}

function addTask(q) {
  const inp = $(`.qin[data-q="${q}"]`);
  const title = (drafts[q] || '').trim();
  if (!title) {
    if (inp) {
      inp.classList.remove('shake');
      void inp.offsetWidth;
      inp.classList.add('shake');
    }
    return;
  }
  const id = Date.now();
  tasks.push({ id, created: id, q, title, due: drafts['d' + q] || '', done: false });
  drafts[q] = '';
  drafts['d' + q] = '';
  lastAdded = id;
  saveTasks();
  render();
  $(`.qin[data-q="${q}"]`)?.focus();
}

function refocus(id) {
  document.querySelector(`.task[data-id="${id}"]`)?.focus({ preventScroll: true });
}

function toggleTask(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  saveTasks();
  render();
  refocus(id);
}

function removeTask(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  lastNoteDel = null;
  lastRemoved = [t];
  tasks = tasks.filter(x => x.id !== id);
  saveTasks();
  render();
  showToast('Task deleted', true);
}

function clearDone() {
  const ids = tasks.filter(t => t.done);
  if (!ids.length) return showToast('Nothing to clear', false);
  lastNoteDel = null;
  lastRemoved = ids;
  tasks = tasks.filter(t => !t.done);
  saveTasks();
  render();
  showToast(`Cleared ${ids.length}`, true);
}

function undo() {
  if (lastNoteDel) {
    const { n, idx } = lastNoteDel;
    nb.notes.splice(Math.min(idx, nb.notes.length), 0, n);
    lastNoteDel = null;
    persistNotes();
    renderList();
    hideToast();
    return;
  }
  if (!lastRemoved) return;
  tasks.push(...lastRemoved);
  lastRemoved = null;
  saveTasks();
  render();
  hideToast();
}

function saveEdit() {
  if (editId === null) return;
  const li = $('.erow')?.closest('.task');
  const t = tasks.find(x => x.id === editId);
  editId = null;
  if (t && li) {
    const v = li.querySelector('.ein').value.trim();
    if (v) {
      t.title = v;
      t.due = li.querySelector('.ed').value;
    }
  }
  saveTasks();
  render();
  if (t) refocus(t.id);
}

function toggleFocus() {
  focusMode = !focusMode;
  render();
}

function applyTheme(m) {
  document.documentElement.dataset.theme = m;
  $('#themeSel').value = m;
}

function showToast(msg, undoable) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${undoable ? '<button id="undoBtn">Undo</button>' : ''}`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 5000);
}

function hideToast() {
  $('#toast').classList.remove('show');
  lastRemoved = null;
  lastNoteDel = null;
}

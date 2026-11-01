/* ---------- Taskora: Global Event Dispatcher & Application Bootstrap ---------- */

document.addEventListener('click', e => {
  const t = e.target;
  if (t.id === 'guide') return closeGuide();
  if (t.closest('#gDone')) return closeGuide();
  if (t.closest('#guideBtn')) return openGuide();
  if (t.closest('#penBtn')) return openNotes();
  if (t.closest('#focusBtn')) return toggleFocus();
  if (t.closest('#clearBtn')) return clearDone();
  if (t.closest('#undoBtn')) return undo();
  
  const add = t.closest('[data-add]');
  if (add) return addTask(add.dataset.add);
  
  const act = t.closest('[data-act]');
  if (act) {
    if (act.dataset.act === 'save') return saveEdit();
    return (editId = null, render());
  }
  
  const del = t.closest('.del');
  if (del) return removeTask(+del.closest('.task').dataset.id);
  
  const qu = t.closest('.quad');
  if (qu && !t.closest('button,input,select')) setActive(qu.dataset.q);
  
  const sb = t.closest('[data-slash]');
  if (sb) {
    chooseSlash(sb.dataset.slash);
    return;
  }
  
  const nd = t.closest('[data-del]');
  if (nd) {
    deleteNote(nd.dataset.del);
    return;
  }
  
  if (t.closest('#delNote')) return deleteNote();
  if (t.closest('#nClose')) return closeNotes();
  
  const wm = t.closest('.wctl [data-mode]');
  if (wm) return setMode(wm.dataset.mode);
  
  if (t.closest('#notes') && notesMode === 'min' && !t.closest('.wctl')) return setMode(lastDock);
  
  const v = t.closest('.side [data-view]');
  if (v) return setView(v.dataset.view);
  
  const tg = t.closest('[data-tag]');
  if (tg) {
    $('#search').value = tg.dataset.tag;
    renderList();
    return;
  }
  
  const bx = t.closest('[data-box]');
  if (bx) {
    const lbl = Q[bx.dataset.box].label.toLowerCase();
    editor.focus();
    document.execCommand('insertText', false, '/' + lbl);
    document.execCommand('insertParagraph');
    saveCurrent();
    highlightCmds();
    return;
  }
  
  if (t.closest('#newNote')) return newNote();
  
  const ni = t.closest('.nitem');
  if (ni) {
    saveCurrent();
    openNote(ni.dataset.id);
    setView('all');
    return;
  }
  
  const cdl = t.closest('.cdel');
  if (cdl) {
    nb.cards = nb.cards.filter(c => c.id !== cdl.dataset.card);
    persistNotes();
    renderCards();
    return;
  }
  
  const cd = t.closest('.card');
  if (cd) {
    openNote(cd.dataset.note);
    setView('all');
    return;
  }
  
  const cmd = t.closest('#fmt [data-cmd]');
  if (cmd) {
    editor.focus();
    document.execCommand(cmd.dataset.cmd, false, cmd.dataset.val || null);
    saveCurrent();
    updatePreview();
    return;
  }
  
  if (t.closest('#cardBtn')) return addCard();
  if (t.closest('#schedBtn')) return scheduleNote();
});

document.addEventListener('mousedown', e => {
  if (e.target.closest('#fmt, .wctl') && !e.target.closest('select')) e.preventDefault();
});

document.addEventListener('mousedown', e => {
  if (!e.target.closest('#slash')) hideSlash();
});

editor.addEventListener('paste', e => {
  e.preventDefault();
  document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text'));
});

document.addEventListener('focusin', e => {
  const qu = e.target.closest?.('.quad');
  if (qu) setActive(qu.dataset.q);
});

document.addEventListener('change', e => {
  if (e.target.id === 'styleSel') {
    editor.focus();
    document.execCommand('formatBlock', false, e.target.value);
    saveCurrent();
    updatePreview();
    return;
  }
  if (e.target.id === 'themeSel') {
    store.set(THEME_KEY, e.target.value);
    applyTheme(e.target.value);
    return;
  }
  const li = e.target.closest('.task');
  if (!li || !li.dataset.id) return;
  if (e.target.classList.contains('cb')) return toggleTask(+li.dataset.id);
  if (e.target.classList.contains('mv')) {
    const t = tasks.find(x => x.id === +li.dataset.id);
    if (t) {
      t.q = e.target.value;
      saveTasks();
      render();
    }
  }
});

document.addEventListener('dblclick', e => {
  const ni = e.target.closest('.nitem');
  if (ni) {
    openNote(ni.dataset.id);
    setView('all');
    titleEl.focus();
    titleEl.select();
    return;
  }
  const tt = e.target.closest('.tt');
  if (!tt) return;
  editId = +tt.closest('.task').dataset.id;
  render();
  const i = $('.ein');
  i?.focus();
  i?.select();
});

document.addEventListener('input', e => {
  if (e.target === editor) {
    highlightCmds();
    slashCheck();
    saveCurrent();
    updatePreview();
    $('#status').textContent = 'Saving…';
    setTimeout(() => { $('#status').textContent = 'Saved'; }, 400);
    return;
  }
  if (e.target === titleEl) {
    saveCurrent();
    return;
  }
  if (e.target.id === 'search') {
    renderList();
    return;
  }
  if (e.target.classList.contains('qin')) drafts[e.target.dataset.q] = e.target.value;
  if (e.target.classList.contains('qdate')) drafts['d' + e.target.dataset.q] = e.target.value;
});

document.addEventListener('keydown', e => {
  const t = e.target;
  if (!slash.hidden && t === editor) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      slashIdx = (slashIdx + 1) % slashItems.length;
      renderSlash();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      slashIdx = (slashIdx - 1 + slashItems.length) % slashItems.length;
      renderSlash();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      chooseSlash(slashItems[slashIdx]);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      hideSlash();
      return;
    }
  }
  if (!$('#guide').hidden) {
    if (e.key === 'Escape') closeGuide();
    return;
  }
  if (!$('#notes').hidden) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeNotes();
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      scheduleNote();
      return;
    }
    return;
  }
  if (t.classList.contains('ein') || t.classList.contains('ed')) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      editId = null;
      render();
    }
    return;
  }
  if ((t.classList.contains('qin') || t.classList.contains('qdate')) && e.key === 'Enter') {
    e.preventDefault();
    return addTask(t.dataset.q);
  }
  if (e.key === 'Escape') {
    if (editId !== null) {
      editId = null;
      render();
      return;
    }
    if (/INPUT|SELECT|TEXTAREA/.test(t.tagName)) t.blur();
    return;
  }
  if (/INPUT|SELECT|TEXTAREA/.test(t.tagName)) return;
  if (e.key === '/') {
    e.preventDefault();
    ($('.qin[data-q="do"]') || $('.qin'))?.focus();
  } else if (e.key === 'f' || e.key === 'F') {
    toggleFocus();
  } else if (e.key === ' ' && t.classList.contains('task')) {
    e.preventDefault();
    toggleTask(+t.dataset.id);
  }
});

/* ---------- Application Bootstrap ---------- */
const sTheme = store.get(THEME_KEY);
applyTheme(sTheme === 'slate' || sTheme === 'light' ? 'slate' : 'dark');

const sMode = store.get(MODE_KEY);
notesMode = ['left', 'right', 'full', 'min'].includes(sMode) ? sMode : 'right';
lastDock = notesMode === 'min' ? 'right' : notesMode;

$('#date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

loadTasks();
loadNotes();
render();

if (store.get(GUIDE_KEY) !== '1') openGuide();

/**
 * Taskora - Global Event Dispatcher & Application Bootstrap
 * 
 * Central event delegation for user interactions across the Priority Matrix
 * and Notes Panel: click actions, keyboard shortcuts, text changes, and startup.
 */

/* ---------- Global Click Event Delegation ---------- */
document.addEventListener('click', async event => {
  const target = event.target;

  // let text="";





  // 1. Guide Modal Controls
  if (target.id === 'guide' || target.closest('#gDone')) {
    closeGuideModal();
    return;
  }
  if (target.closest('#guideBtn')) {
    openGuideModal();
    return;
  }

  // 2. Header & Matrix Top Controls
  if (target.closest('#penBtn')) {
    openNotesPanel();
    return;
  }
  if (target.closest('#focusBtn')) {
    toggleFocus();
    return;
  }
  if (target.closest('#clearBtn')) {
    clearDone();
    return;
  }
  if (target.closest('#undoBtn')) {
    undo();
    return;
  }

  // 3. Quadrant "+ Add" Task Button
  const addButton = target.closest('[data-add]');
  if (addButton) {
    const quadrantKey = addButton.dataset.add;
    const inputElement = document.querySelector(`.qin[data-q="${quadrantKey}"]`);
    const dateElement = document.querySelector(`.qdate[data-q="${quadrantKey}"]`);
    const text = (drafts[quadrantKey] || (inputElement ? inputElement.value : '')).trim();
    const dueDate = drafts['d' + quadrantKey] || (dateElement ? dateElement.value : '') || null;

    if (!text) {
      addTask(quadrantKey);
      return;
    }

    try {
      const reqAdd = await fetch(`${API_URL}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: text,
          deadline: dueDate,
          status: 'pending',
          quadrant: quadrantKey
        })
      });

      const response = await reqAdd.json();
      console.log('Task created on backend:', response);

      addTask(quadrantKey, response._id);
    } catch (error) {
      console.warn('Backend unavailable, creating task locally:', error);
      addTask(quadrantKey);
    }
    return;
  }

  // 4. Inline Edit Save / Cancel Buttons
  const actionButton = target.closest('[data-act]');
  if (actionButton) {
    if (actionButton.dataset.act === 'save') {
      saveEdit();
    } else {
      editId = null;
      render();
    }
    return;
  }

  // 5. Task Delete Button (✕ on task hover)
  const taskDeleteButton = target.closest('.del');
  if (taskDeleteButton) {
    const taskElement = taskDeleteButton.closest('.task');
    if (!taskElement) return;

    const taskId = taskElement.dataset.id;

    if (taskId) {
      // If it is a 24-character hex MongoDB ObjectId, delete from backend
      if (/^[0-9a-fA-F]{24}$/.test(taskId)) {
        try {
          const reqDel = await fetch(`${API_URL}/delete/${taskId}`, {
            method: 'DELETE'
          });
          const delRes = await reqDel.json();
          console.log("del req response is ::", delRes);
        } catch (error) {
          console.warn("Failed to delete task from server:", error);
        }
      }

      removeTask(taskId);
    }
    return;
  }



  // 6. Clicking Quadrant Body Sets It Active
  const quadrantCard = target.closest('.quad');
  const isFormInteractive = target.closest('button, input, select');
  if (quadrantCard && !isFormInteractive) {
    setActive(quadrantCard.dataset.q);
  }

  // 7. Slash Autocomplete Menu Item Click
  const slashItem = target.closest('[data-slash]');
  if (slashItem) {
    selectSlashCommand(slashItem.dataset.slash);
    return;
  }

  // 8. Note Item Delete Button (✕ in notes list)
  const noteDeleteButton = target.closest('[data-del]');
  if (noteDeleteButton) {
    deleteNote(noteDeleteButton.dataset.del);
    return;
  }

  // 9. Notes Panel Close Button (✕ in top bar)
  if (target.closest('#nClose')) {
    closeNotesPanel();
    return;
  }

  // 10. Notes Dock Mode Controls (left, right, full, min)
  const dockModeButton = target.closest('.wctl [data-mode]');
  if (dockModeButton) {
    setDockMode(dockModeButton.dataset.mode);
    return;
  }

  // 11. Clicking Minimized Panel Bar Restores Previous Dock Mode
  const isNotesPanel = target.closest('#notes');
  const isControlClick = target.closest('.wctl');
  if (isNotesPanel && notesMode === 'min' && !isControlClick) {
    setDockMode(lastDock);
    return;
  }

  // 12. Create New Note Button
  if (target.closest('#newNote')) {
    newNote();
    return;
  }

  // 13. Select Note from Notes List
  const noteListItem = target.closest('.nitem');
  if (noteListItem) {
    saveCurrentNote();
    openNote(noteListItem.dataset.id);
    return;
  }

  // 14. Rich-Text Formatting Toolbar Commands (Bold, Italic, List, Align)
  const formattingButton = target.closest('#fmt [data-cmd]');
  if (formattingButton) {
    editor.focus();
    document.execCommand(formattingButton.dataset.cmd, false, formattingButton.dataset.val || null);
    saveCurrentNote();
    updateSchedulingPreview();
    return;
  }

  // 15. Schedule Tagged Tasks into the Matrix
  if (target.closest('#schedBtn')) {
    scheduleNoteTasks();
    return;
  }
});

/* ---------- Mousedown Focus & Popover Dismissal ---------- */
document.addEventListener('mousedown', event => {
  const target = event.target;

  // Prevent toolbar buttons from stealing caret focus from note editor
  if (target.closest('#fmt, .wctl') && !target.closest('select')) {
    event.preventDefault();
  }

  // Close floating slash autocomplete menu when clicking outside
  if (!target.closest('#slash')) {
    hideSlashMenu();
  }
});


/* ---------- Paste Sanitization ---------- */
// Enforces plain-text paste in editor to prevent foreign HTML styles
editor.addEventListener('paste', event => {
  event.preventDefault();
  const clipboardData = event.clipboardData || window.clipboardData;
  const plainText = clipboardData.getData('text');
  document.execCommand('insertText', false, plainText);
});

/* ---------- Focusin Tracking ---------- */
// Highlight the parent quadrant card when any child form control receives focus
document.addEventListener('focusin', event => {
  const parentQuadrant = event.target.closest?.('.quad');
  if (parentQuadrant) {
    setActive(parentQuadrant.dataset.q);
  }
});

/* ---------- Form Input & Select Changes ---------- */
document.addEventListener('change', event => {
  const target = event.target;

  // 1. Text Style Dropdown (Paragraph, Heading 1, 2, 3)
  if (target.id === 'styleSel') {
    editor.focus();
    document.execCommand('formatBlock', false, target.value);
    saveCurrentNote();
    updateSchedulingPreview();
    return;
  }

  // 2. Application Theme Dropdown
  if (target.id === 'themeSel') {
    store.set(THEME_KEY, target.value);
    applyTheme(target.value);
    return;
  }

  const taskElement = target.closest('.task');
  if (!taskElement || !taskElement.dataset.id) return;
  const taskId = taskElement.dataset.id;

  // 3. Task Completion Checkbox
  if (target.classList.contains('cb')) {
    toggleTask(taskId);
    return;
  }

  // 4. Move Task to Another Quadrant Dropdown
  if (target.classList.contains('mv')) {
    const task = tasks.find(item => item.id === taskId);
    if (task) {
      task.q = target.value;
      saveTasks();
      render();

      if (/^[0-9a-fA-F]{24}$/.test(taskId)) {
        fetch(`${API_URL}/update/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quadrant: target.value })
        }).catch(err => console.warn('Failed to update quadrant on server:', err));
      }
    }
  }
});

/* ---------- Double Click to Edit ---------- */
document.addEventListener('dblclick', event => {
  const target = event.target;

  // Double-clicking a note in the list opens it and focuses the title for fast renaming
  const noteListItem = target.closest('.nitem');
  if (noteListItem) {
    openNote(noteListItem.dataset.id);
    titleElement.focus();
    titleElement.select();
    return;
  }

  // Double-clicking a task title opens inline editor
  const taskTitleElement = target.closest('.tt');
  if (!taskTitleElement) return;

  const parentTask = taskTitleElement.closest('.task');
  if (!parentTask) return;

  editId = parentTask.dataset.id;
  render();

  const inlineInput = document.querySelector('.ein');
  if (inlineInput) {
    inlineInput.focus();
    inlineInput.select();
  }
});

/* ---------- Live Input Synchronization ---------- */
document.addEventListener('input', event => {
  const target = event.target;

  // Notes editor live syntax highlighting & autosave
  if (target === editor || editor.contains(target)) {
    highlightSlashCommands();
    checkSlashMenuTrigger();
    saveCurrentNote();
    updateSchedulingPreview();

    const statusElement = document.querySelector('#status');
    if (statusElement) statusElement.textContent = 'Saving…';
    setTimeout(() => {
      if (statusElement) statusElement.textContent = 'Saved';
    }, 400);
    return;
  }

  // Note title autosave
  if (target === titleElement) {
    saveCurrentNote();
    return;
  }

  // Live filter note search list
  if (target.id === 'search') {
    renderList();
    return;
  }

  // Save quadrant task title and due date drafts in memory as object 
  if (target.classList.contains('qin')) {
    drafts[target.dataset.q] = target.value;
  }
  if (target.classList.contains('qdate')) {
    drafts['d' + target.dataset.q] = target.value;
  }
});


/* ---------- Global Keyboard Shortcuts ---------- */
document.addEventListener('keydown', event => {
  const target = event.target;

  // 1. Slash autocomplete dropdown keyboard navigation
  if (!slashMenuElement.hidden && (target === editor || editor.contains(target))) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      slashSelectedIndex = (slashSelectedIndex + 1) % matchingSlashCommands.length;
      renderSlashMenu();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      slashSelectedIndex = (slashSelectedIndex - 1 + matchingSlashCommands.length) % matchingSlashCommands.length;
      renderSlashMenu();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      selectSlashCommand(matchingSlashCommands[slashSelectedIndex]);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      hideSlashMenu();
      return;
    }
  }

  // 2. Escape to close guide modal
  const guideModal = document.querySelector('#guide');
  if (guideModal && !guideModal.hidden) {
    if (event.key === 'Escape') {
      closeGuideModal();
      return;
    }
  }

  // 3. Notes drawer keyboard shortcuts
  const notesPanel = document.querySelector('#notes');
  if (notesPanel && !notesPanel.hidden) {
    // Enter in Title input jumps directly down to editor body
    if (target === titleElement && event.key === 'Enter') {
      event.preventDefault();
      if (window.focusEditor) window.focusEditor();
      else editor.focus();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeNotesPanel();
      return;
    }
    // Ctrl/Cmd + Enter schedules tagged note tasks into the matrix
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      scheduleNoteTasks();
      return;
    }
    return;
  }

  // 4. Inline task editor keys (Enter to save, Esc to cancel)
  const isInlineEdit = target.classList.contains('ein') || target.classList.contains('ed');
  if (isInlineEdit) {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      editId = null;
      render();
    }
    return;
  }

  // 5. Escape to cancel editing or blur active input
  if (event.key === 'Escape') {
    if (editId !== null) {
      editId = null;
      render();
      return;
    }
    if (/INPUT|SELECT|TEXTAREA/.test(target.tagName)) {
      target.blur();
      return;
    }
  }

  // Skip navigation shortcuts if user is typing in a form field
  if (/INPUT|SELECT|TEXTAREA/.test(target.tagName)) return;

  // 7. Quick navigation shortcuts
  if (event.key === '/') {
    // '/' focuses the primary input in the DO NOW quadrant
    event.preventDefault();
    const primaryInput = document.querySelector('.qin[data-q="do"]') || document.querySelector('.qin');
    if (primaryInput) primaryInput.focus();
  } else if (event.key === 'f' || event.key === 'F') {
    // 'F' toggles Focus Mode
    toggleFocus();
  } else if (event.key === ' ' && target.classList.contains('task')) {
    // 'Space' completes the highlighted task
    event.preventDefault();
    toggleTask(target.dataset.id);
  }
});

/* ---------- Application Bootstrap ---------- */

// 1. Initialize user theme preference
const savedTheme = store.get(THEME_KEY);
const initialTheme = (savedTheme === 'slate' || savedTheme === 'light') ? 'slate' : 'dark';
applyTheme(initialTheme);

// 2. Initialize notes panel dock mode
const savedMode = store.get(MODE_KEY);
notesMode = ['left', 'right', 'full', 'min'].includes(savedMode) ? savedMode : 'right';
lastDock = (notesMode === 'min') ? 'right' : notesMode;

// 3. Display current formatted date in top header
const dateElement = document.querySelector('#date');
if (dateElement) {
  dateElement.textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

// 4. Load persisted data and trigger initial UI render
loadTasks();
loadNotes();
if (notebook && notebook.currentNoteId) openNote(notebook.currentNoteId);
render();

// 5. Open onboarding guide modal on first visit
if (store.get(GUIDE_KEY) !== '1') {
  openGuideModal();
}

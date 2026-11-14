/**
 * Taskora - Notes Workspace & Slash Commands Engine
 * 
 * Provides a rich-text scratchpad with live syntax highlighting,
 * slash-tag autocompletion (/do now, /deep work, /delegate, /drop),
 * and automatic parsing to schedule tasks directly into the Eisenhower matrix.
 */

/* ---------- Notebook State & DOM Nodes ---------- */
const notebook = {
  notes: [],
  currentNoteId: null,
  // Getter/setter for backwards compatibility with any legacy cur references
  get cur() { return this.currentNoteId; },
  set cur(value) { this.currentNoteId = value; }
};

// Make notebook globally accessible to matrix undo operations
window.notebook = notebook;
const nb = notebook;

let notesMode = 'right';      // Dock mode: 'left' | 'right' | 'full' | 'min'
let lastDock = 'right';       // Previous dock position prior to minimize
let lastNoteDel = null;       // Cache of recently deleted note for undo

// Primary Editor DOM Elements
const editor = document.querySelector('#nText');
const titleElement = document.querySelector('#ntitle');

/* ---------- Text Extraction & Formatting Helpers ---------- */

/** Extracts clean plain text from an HTML snippet using an off-screen container */
function extractPlainText(htmlString) {
  let source = htmlString || '';
  if (source.includes('note-guide')) {
    const temp = document.createElement('div');
    temp.innerHTML = source;
    temp.querySelectorAll('.note-guide').forEach(el => el.remove());
    source = temp.innerHTML;
  }
  if (editor && editor.innerHTML === htmlString) {
    if (!editor.querySelector('.note-guide')) {
      return editor.innerText || '';
    }
  }
  const container = document.createElement('div');
  container.innerHTML = source.replace(/<\/div>|<br\s*[\/]?>/gi, '\n');
  return container.textContent || '';
}
const plainOf = extractPlainText; // Compatibility alias

/** Resolves note display title: uses explicit title or falls back to first non-empty line */
function getNoteTitle(note) {
  if (!note) return 'Untitled';
  if (note.title && note.title.trim()) return note.title.trim();

  const firstLine = extractPlainText(note.html)
    .split('\n')
    .map(line => line.trim())
    .find(Boolean);

  return firstLine || 'Untitled';
}
const titleOf = getNoteTitle; // Compatibility alias

/** Extracts a short 140-character summary snippet for note list items */
function getNoteSnippet(note) {
  if (!note) return 'No text';
  const lines = extractPlainText(note.html)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const snippetLines = note.title ? lines : lines.slice(1);
  const snippet = snippetLines.join(' ').slice(0, 140);
  return snippet || 'No more text';
}
const snippetOf = getNoteSnippet; // Compatibility alias

/** Returns the currently active note object */
function getCurrentNote() {
  return notebook.notes.find(note => note.id === notebook.currentNoteId);
}
const curNote = getCurrentNote; // Compatibility alias

/* ---------- Notebook Persistence & Lifecycle ---------- */

/** Persists current notebook state to LocalStorage */
function persistNotes() {
  store.set(NOTES_KEY, JSON.stringify(notebook));
  const statusElement = document.querySelector('#status');
  if (statusElement) statusElement.textContent = 'Saved';
}

/** Loads notebook from LocalStorage or creates a starter note */
function loadNotes() {
  try {
    const storedNotebook = JSON.parse(store.get(NOTES_KEY));
    if (storedNotebook && Array.isArray(storedNotebook.notes)) {
      notebook.notes = storedNotebook.notes;
      notebook.currentNoteId = storedNotebook.currentNoteId || storedNotebook.cur || null;
      // Upgrade existing starter guide note if present from previous run
      notebook.notes.forEach(note => {
        if (note.title === 'Welcome to your notes' && (!note.html.includes('contenteditable="false"') || !note.html.includes('note-guide'))) {
          note.html = '<div class="note-guide" contenteditable="false">Welcome to your notes<br>Write here. Add a tag like <code>/do now</code> on its own line, then tasks below it.</div><div><br></div>';
        }
      });
    }
  } catch (error) {
    console.warn('Could not parse stored notes:', error);
  }

  // If notebook is empty, initialize with a welcome guide note
  if (!notebook.notes || notebook.notes.length === 0) {
    const welcomeNoteId = 'n' + Date.now();
    notebook.notes = [{
      id: welcomeNoteId,
      title: 'Welcome to your notes',
      html: '<div class="note-guide" contenteditable="false">Welcome to your notes<br>Write here. Add a tag like <code>/do now</code> on its own line, then tasks below it.</div><div><br></div>',
      updated: Date.now()
    }];
    notebook.currentNoteId = welcomeNoteId;
  }

  // Ensure an active note is always selected
  if (!notebook.currentNoteId || !getCurrentNote()) {
    notebook.currentNoteId = notebook.notes[0].id;
  }
}

/** Creates a brand new empty note and focuses the title */
function newNote() {
  const newNoteId = 'n' + Date.now();
  notebook.notes.unshift({
    id: newNoteId,
    title: '',
    html: '',
    updated: Date.now()
  });
  notebook.currentNoteId = newNoteId;

  persistNotes();
  openNote(newNoteId);
  titleElement.focus();
}

/** Opens and renders a note by ID into the editor */
function openNote(noteId) {
  notebook.currentNoteId = noteId;
  const activeNote = getCurrentNote();
  if (!activeNote) return;

  titleElement.value = activeNote.title || '';
  editor.innerHTML = activeNote.html || '';

  highlightSlashCommands();
  updateSchedulingPreview();
  renderList();
  renderCrumb();
  persistNotes();
}

/** Updates top breadcrumb trail with the active note title */
function renderCrumb() {
  const activeNote = getCurrentNote();
  const crumbElement = document.querySelector('#crumb');
  if (crumbElement) {
    crumbElement.textContent = `All notes › ${getNoteTitle(activeNote)}`;
  }
}

/** Renders notes list with search filtering */
function renderList() {
  const searchInput = document.querySelector('#search');
  const searchQuery = (searchInput ? searchInput.value : '').toLowerCase().trim();

  const filteredNotes = notebook.notes
    .filter(note => {
      if (!searchQuery) return true;
      const plainText = extractPlainText(note.html).toLowerCase();
      const titleText = (note.title || '').toLowerCase();
      return plainText.includes(searchQuery) || titleText.includes(searchQuery);
    })
    .sort((noteA, noteB) => noteB.updated - noteA.updated);

  const notesListElement = document.querySelector('#nlist');
  if (!notesListElement) return;

  if (filteredNotes.length === 0) {
    notesListElement.innerHTML = '<li class="empty">No notes found</li>';
    return;
  }

  notesListElement.innerHTML = filteredNotes.map(note => {
    const isCurrent = note.id === notebook.currentNoteId;
    const activeClass = isCurrent ? ' active' : '';
    return `
      <li class="nitem${activeClass}" data-id="${note.id}">
        <b>${escapeHTML(getNoteTitle(note))}</b>
        <span>${escapeHTML(getNoteSnippet(note))}</span>
        <button class="ndel" data-del="${note.id}" title="Delete note">✕</button>
      </li>
    `;
  }).join('');
}

/** Saves editor contents into active note memory and storage */
function saveCurrentNote() {
  const activeNote = getCurrentNote();
  if (!activeNote) return;

  activeNote.html = editor.innerHTML;
  activeNote.updated = Date.now();
  activeNote.title = titleElement.value.trim();

  persistNotes();
  renderList();
}
const saveCurrent = saveCurrentNote; // Compatibility alias

/** Deletes a note by ID and caches it for undo */
function deleteNote(noteId) {
  const targetNote = noteId
    ? notebook.notes.find(note => note.id === noteId)
    : getCurrentNote();

  if (!targetNote) return;

  const noteIndex = notebook.notes.indexOf(targetNote);
  notebook.notes.splice(noteIndex, 1);

  lastRemoved = null; // Clear opposite task undo pointer
  lastNoteDel = { note: targetNote, index: noteIndex };

  // If all notes were deleted, initialize a blank note
  if (notebook.notes.length === 0) {
    notebook.notes.push({
      id: 'n' + Date.now(),
      title: '',
      html: '',
      updated: Date.now()
    });
  }

  notebook.currentNoteId = notebook.notes[0].id;
  persistNotes();
  openNote(notebook.currentNoteId);
  showToast('Note deleted', true);
}

/* ---------- Contenteditable Caret & Syntax Highlighting ---------- */

/** Calculates character offset of the caret inside the editor */
function getCaretCharacterOffset() {
  try {
    const selection = window.getSelection();
    if (!selection.rangeCount) return 0;

    const clonedRange = selection.getRangeAt(0).cloneRange();
    clonedRange.selectNodeContents(editor);
    clonedRange.setEnd(selection.anchorNode, selection.anchorOffset);
    return clonedRange.toString().length;
  } catch (error) {
    return 0;
  }
}
const caretOffset = getCaretCharacterOffset; // Compatibility alias

/** Positions the caret at a specific DOM text node and offset */
function placeCaretAt(node, offset) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}
const placeCaret = placeCaretAt; // Compatibility alias

/** Restores caret position across nested text nodes by total character offset */
function restoreCaretOffset(targetOffset) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let textNode = null;
  let accumulatedLength = 0;
  let lastNode = null;

  while ((textNode = walker.nextNode())) {
    lastNode = textNode;
    if (accumulatedLength + textNode.length >= targetOffset) {
      placeCaretAt(textNode, targetOffset - accumulatedLength);
      return;
    }
    accumulatedLength += textNode.length;
  }

  if (lastNode) {
    placeCaretAt(lastNode, lastNode.length);
  }
}
const setCaret = restoreCaretOffset; // Compatibility alias

/** Focuses the editor on the active editing line below any starter guide */
function focusEditor() {
  if (!editor) return;
  editor.focus();
  const guide = editor.querySelector('.note-guide');
  if (guide) {
    let nextEditable = guide.nextElementSibling;
    if (!nextEditable) {
      nextEditable = document.createElement('div');
      nextEditable.innerHTML = '<br>';
      editor.appendChild(nextEditable);
    }
    const range = document.createRange();
    range.setStart(nextEditable, 0);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}
window.focusEditor = focusEditor;

// Redirect clicks on non-editable guide straight to the editable editing line below it
if (editor) {
  editor.addEventListener('mousedown', event => {
    if (event.target.closest('.note-guide')) {
      event.preventDefault();
      focusEditor();
    }
  });
}

/**
 * Highlights slash commands (/do now, /deep work, /delegate, /drop)
 * with a styled .cmd tag while preserving the user's cursor position.
 */
function highlightSlashCommands() {
  const isEditorFocused = document.activeElement === editor;
  const originalOffset = isEditorFocused ? getCaretCharacterOffset() : 0;

  // Wrap loose top-level text nodes in <div> blocks
  [...editor.childNodes].forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      const divElement = document.createElement('div');
      divElement.textContent = node.textContent;
      editor.replaceChild(divElement, node);
    }
  });

  const splitPattern = new RegExp('(\\/(?:do now|deep work|delegate|drop)(?=\\s|$))', 'i');
  const allMatchesPattern = new RegExp('\\/(?:do now|deep work|delegate|drop)(?=\\s|$)', 'gi');

  let didMutate = false;
  [...editor.children].forEach(childElement => {
    if (childElement.classList.contains('note-guide')) return;

    const rawText = childElement.textContent || '';
    const desiredMatches = rawText.match(allMatchesPattern) || [];
    const currentMatches = [...childElement.querySelectorAll('.cmd')].map(tag => tag.textContent);

    // If already properly styled, skip DOM mutation to avoid unnecessary reflow
    if (JSON.stringify(desiredMatches) === JSON.stringify(currentMatches)) return;

    didMutate = true;
    childElement.innerHTML = rawText
      .split(splitPattern)
      .map((part, index) => {
        const isMatchedTag = index % 2 === 1;
        return isMatchedTag ? `<span class="cmd">${escapeHTML(part)}</span>` : escapeHTML(part);
      })
      .join('');
  });

  if (isEditorFocused && didMutate) {
    restoreCaretOffset(originalOffset);
  }
}
const highlightCmds = highlightSlashCommands; // Compatibility alias

/* ---------- Slash Commands Autocomplete Menu ---------- */

const slashMenuElement = document.querySelector('#slash');
let matchingSlashCommands = [];
let slashSelectedIndex = 0;
let slashTriggerContext = null;

const SLASH_DESCRIPTIONS = {
  do: 'Urgent and important',
  decide: 'Important, not urgent',
  delegate: 'Urgent, not important',
  delete: 'Neither urgent nor important'
};

/** Closes the slash command dropdown menu */
function hideSlashMenu() {
  slashMenuElement.hidden = true;
  slashTriggerContext = null;
}
const hideSlash = hideSlashMenu; // Compatibility alias

/** Renders matching commands in the floating slash menu */
function renderSlashMenu() {
  slashMenuElement.innerHTML = matchingSlashCommands.map((quadrantKey, index) => {
    const selectedClass = index === slashSelectedIndex ? ' class="selected"' : '';
    return `
      <button data-slash="${quadrantKey}"${selectedClass}>
        <b>/${QUADRANTS[quadrantKey].label.toLowerCase()}</b>
        <span>${SLASH_DESCRIPTIONS[quadrantKey]}</span>
      </button>
    `;
  }).join('');
}
const renderSlash = renderSlashMenu; // Compatibility alias

/** Checks caret position and opens autocomplete menu if user typed '/' */
function checkSlashMenuTrigger() {
  const selection = window.getSelection();
  const anchorNode = selection.rangeCount ? selection.anchorNode : null;

  if (!anchorNode || anchorNode.nodeType !== Node.TEXT_NODE || !editor.contains(anchorNode) || !selection.isCollapsed) {
    return hideSlashMenu();
  }

  const textBeforeCaret = anchorNode.textContent.slice(0, selection.anchorOffset);
  const slashMatch = textBeforeCaret.match(/(^|\s)\/([a-z ]*)$/i);
  if (!slashMatch) return hideSlashMenu();

  const query = slashMatch[2].toLowerCase();
  matchingSlashCommands = ORDER.filter(quadrantKey => {
    const label = QUADRANTS[quadrantKey].label.toLowerCase();
    return label.startsWith(query);
  });

  if (matchingSlashCommands.length === 0) return hideSlashMenu();

  slashTriggerContext = {
    node: anchorNode,
    start: textBeforeCaret.length - slashMatch[0].length + slashMatch[1].length,
    caret: selection.anchorOffset
  };
  slashSelectedIndex = 0;
  renderSlashMenu();

  // Position menu immediately below current caret coordinates
  const caretRect = selection.getRangeAt(0).getBoundingClientRect();
  slashMenuElement.style.left = Math.max(8, caretRect.left) + 'px';
  slashMenuElement.style.top = (caretRect.bottom + 8) + 'px';
  slashMenuElement.hidden = false;
}
const slashCheck = checkSlashMenuTrigger; // Compatibility alias

/** Inserts the chosen slash tag into the editor text at the trigger position and moves to a new line */
function selectSlashCommand(quadrantKey) {
  if (!slashTriggerContext) return hideSlashMenu();

  const { node, start, caret } = slashTriggerContext;
  const tagLabel = '/' + QUADRANTS[quadrantKey].label.toLowerCase();
  const textContent = node.textContent;
  const afterText = textContent.slice(caret);

  // Set current line text to the tag label
  node.textContent = textContent.slice(0, start) + tagLabel;

  // Locate the parent line element safely without calling .closest() on Text nodes
  let parentLine = (node.nodeType === Node.TEXT_NODE) ? node.parentElement : node;
  while (parentLine && parentLine.parentElement !== editor && parentLine !== editor) {
    parentLine = parentLine.parentElement;
  }

  // Create a clean new line directly below the tag
  const newLine = document.createElement('div');
  if (afterText.trim()) {
    newLine.textContent = afterText;
  } else {
    newLine.innerHTML = '<br>';
  }

  if (parentLine && parentLine.nextSibling) {
    editor.insertBefore(newLine, parentLine.nextSibling);
  } else {
    editor.appendChild(newLine);
  }

  hideSlashMenu();
  highlightSlashCommands();

  editor.focus();
  if (newLine.firstChild && newLine.firstChild.nodeType === Node.TEXT_NODE) {
    placeCaretAt(newLine.firstChild, 0);
  } else {
    const range = document.createRange();
    range.setStart(newLine, 0);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  saveCurrentNote();
  updateSchedulingPreview();
}
const chooseSlash = selectSlashCommand; // Compatibility alias

/* ---------- Note-to-Matrix Parser & Scheduler ---------- */

/** Resolves quadrant key ('do'|'decide'|'delegate'|'delete') from tag text */
function getQuadrantFromTag(tagText) {
  const cleanTag = tagText.toLowerCase().replace(/\s+/g, ' ').trim();
  return ORDER.find(quadrantKey => {
    const label = QUADRANTS[quadrantKey].label.toLowerCase();
    return label === cleanTag || quadrantKey === cleanTag;
  }) || null;
}
const boxFromTag = getQuadrantFromTag; // Compatibility alias

/**
 * Parses note text line-by-line:
 * Maps lines below a /tag to that quadrant, or falls back to NLP keywords.
 */
function parseNoteTasks(rawNoteText) {
  const categorizedTasks = { do: [], decide: [], delegate: [], delete: [] };
  const unknownTags = [];
  const skippedLines = [];
  let currentQuadrant = null;

  const tagSplitRegex = new RegExp('(\\/(?:do now|deep work|delegate|drop)(?=\\s|$))', 'i');
  const validTagStartRegex = new RegExp('^\\/(?:do now|deep work|delegate|drop)(?=\\s|$)', 'i');

  // Fallback NLP heuristic when no tag header has been encountered
  const routeByKeywords = text => {
    const lower = text.toLowerCase();
    const isUrgent = /urgent|asap|today|deadline/.test(lower);
    const isImportant = /important|priority/.test(lower);

    if (isUrgent && isImportant) {
      categorizedTasks.do.push(text);
    } else if (isImportant) {
      categorizedTasks.decide.push(text);
    } else if (isUrgent) {
      categorizedTasks.delegate.push(text);
    } else {
      skippedLines.push(text);
    }
  };

  const lines = rawNoteText.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Line starts with an unknown slash command
    if (line.startsWith('/') && !validTagStartRegex.test(line)) {
      unknownTags.push(line.split(/\s/)[0]);
      currentQuadrant = null;
      continue;
    }

    const parts = line.split(tagSplitRegex);
    const textBeforeTag = parts[0].replace(/^[-•*]\s*/, '').trim();

    if (textBeforeTag) {
      if (currentQuadrant) {
        categorizedTasks[currentQuadrant].push(textBeforeTag);
      } else {
        routeByKeywords(textBeforeTag);
      }
    }

    for (let i = 1; i < parts.length; i += 2) {
      const tag = parts[i].slice(1);
      currentQuadrant = getQuadrantFromTag(tag);
      const textAfterTag = (parts[i + 1] || '').replace(/^[-•*]\s*/, '').trim();
      if (textAfterTag && currentQuadrant) {
        categorizedTasks[currentQuadrant].push(textAfterTag);
      }
    }
  }

  return {
    out: categorizedTasks,
    unknown: unknownTags,
    skipped: skippedLines
  };
}
const parseNotes = parseNoteTasks; // Compatibility alias

/** Updates bottom preview bar indicating ready-to-schedule task counts */
function updateSchedulingPreview() {
  const plainText = extractPlainText(editor.innerHTML);
  const { out, unknown, skipped } = parseNoteTasks(plainText);
  const totalTasksReady = ORDER.reduce((sum, key) => sum + out[key].length, 0);

  let previewHTML = '';

  if (totalTasksReady > 0) {
    const summaryItems = ORDER.map(key => `${QUADRANTS[key].label} ${out[key].length}`).join(' · ');
    previewHTML = `<b>${totalTasksReady} task${totalTasksReady === 1 ? '' : 's'} ready:</b> ${summaryItems}`;
  } else {
    previewHTML = 'No scheduled lines yet. Start a line with a tag, like /do now';
  }

  if (unknown.length > 0) {
    previewHTML += `<br><span class="warn">Unknown tag: ${escapeHTML(unknown.join(', '))}</span>`;
  }

  if (skipped.length > 0) {
    previewHTML += `<br><span class="warn">${skipped.length} line${skipped.length === 1 ? '' : 's'} without a box. Add a tag above them.</span>`;
  }

  const previewElement = document.querySelector('#nPre');
  if (previewElement) previewElement.innerHTML = previewHTML;
}
const updatePreview = updateSchedulingPreview; // Compatibility alias

/** Schedules all tagged lines from the active note directly into the matrix */
function scheduleNoteTasks() {
  const plainText = extractPlainText(editor.innerHTML);
  const { out } = parseNoteTasks(plainText);
  const timestamp = Date.now();
  let scheduledCount = 0;

  ORDER.forEach(quadrantKey => {
    out[quadrantKey].forEach(taskTitle => {
      const taskId = timestamp + scheduledCount;
      tasks.push({
        id: taskId,
        created: taskId,
        q: quadrantKey,
        title: taskTitle,
        due: '',
        done: false
      });
      scheduledCount++;
    });
  });

  if (scheduledCount === 0) {
    return showToast('No tasks found in this note', false);
  }

  saveTasks();
  render();
  showToast(`${scheduledCount} task${scheduledCount === 1 ? '' : 's'} scheduled`, false);
}
const scheduleNote = scheduleNoteTasks; // Compatibility alias

/* ---------- Panel Docking & Modals ---------- */

/** Applies layout classes to document.body based on active dock mode */
function applyDockMode() {
  const panelElement = document.querySelector('#notes');
  if (!panelElement) return;

  panelElement.dataset.mode = notesMode;

  document.querySelectorAll('.wctl [data-mode]').forEach(button => {
    button.classList.toggle('active', button.dataset.mode === notesMode);
  });

  const isPanelOpen = !panelElement.hidden;
  document.body.classList.toggle('dock-left', isPanelOpen && notesMode === 'left');
  document.body.classList.toggle('dock-right', isPanelOpen && notesMode === 'right');
}
const applyMode = applyDockMode; // Compatibility alias

/** Updates notes panel dock mode ('left' | 'right' | 'full' | 'min') */
function setDockMode(mode) {
  notesMode = mode;
  if (mode !== 'min') lastDock = mode;
  store.set(MODE_KEY, mode);
  applyDockMode();
}
const setMode = setDockMode; // Compatibility alias

/** Opens notes drawer and focuses the editor */
function openNotesPanel() {
  const panelElement = document.querySelector('#notes');
  if (!panelElement) return;

  panelElement.hidden = false;
  applyDockMode();

  if (!getCurrentNote()) newNote();
  openNote(notebook.currentNoteId);
  focusEditor();
}
const openNotes = openNotesPanel; // Compatibility alias

/** Closes notes drawer and autosaves contents */
function closeNotesPanel() {
  saveCurrentNote();
  const panelElement = document.querySelector('#notes');
  if (panelElement) panelElement.hidden = true;
  applyDockMode();
}
const closeNotes = closeNotesPanel; // Compatibility alias

/** Opens the onboarding guide modal */
function openGuideModal() {
  const guideElement = document.querySelector('#guide');
  if (guideElement) {
    guideElement.hidden = false;
    const gotItButton = document.querySelector('#gDone');
    if (gotItButton) gotItButton.focus();
  }
}
const openGuide = openGuideModal; // Compatibility alias

/** Closes the onboarding guide modal and marks as seen in LocalStorage */
function closeGuideModal() {
  const guideElement = document.querySelector('#guide');
  if (guideElement) guideElement.hidden = true;
  store.set(GUIDE_KEY, '1');
}
const closeGuide = closeGuideModal; // Compatibility alias

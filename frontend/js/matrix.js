/**
 * Taskora - Eisenhower Priority Matrix & Task Management Engine
 * 
 * Implements the 4-quadrant Eisenhower prioritization system:
 * - DO NOW: Urgent & Important
 * - DEEP WORK: Important, Not Urgent
 * - DELEGATE: Urgent, Not Important
 * - DROP: Not Urgent, Not Important
 * 
 * Features: LocalStorage sync, due date badge calculations, task CRUD,
 * progress analytics, inline editing, and undo operations.
 */

/* ---------- Storage Keys & Constants ---------- */
const KEY = 'taskora-matrix-v1';        // LocalStorage key for task collection
const THEME_KEY = 'taskora-theme';       // User theme ('dark' | 'slate')
const GUIDE_KEY = 'taskora-guide-seen';  // Onboarding modal flag
const NOTES_KEY = 'taskora-notes-v2';    // Notes notebook object
const MODE_KEY = 'taskora-notes-mode';   // Notes panel dock mode ('left' | 'right' | 'full' | 'min')

// Backend API Base URL (Render deployment)
const API_URL = 'https://taskora-w46f.onrender.com';

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Eisenhower Quadrant Definitions
 */
const QUADRANTS = {
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

// Quadrant display order
const ORDER = ['do', 'decide', 'delegate', 'delete'];
const Q = QUADRANTS; // Friendly alias for template compatibility

/* ---------- Utility Helpers ---------- */

/** Shorthand querySelector helper */
const $ = selector => document.querySelector(selector);

/** Escapes special HTML characters to prevent XSS injection */
function escapeHTML(str) {
  const entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(str).replace(/[&<>"']/g, char => entityMap[char] || char);
}
const esc = escapeHTML; // Alias

/** Formats a Date object to YYYY-MM-DD */
function formatDateToYMD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const todayStr = formatDateToYMD(new Date());

/** Safe LocalStorage Wrapper with error handling */
const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('Could not read from localStorage:', error);
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn('Could not write to localStorage:', error);
    }
  }
};

/* ---------- Global Application State ---------- */
let tasks = [];          // Active task list
let drafts = {};         // Text & due date drafts keyed by quadrant (e.g. drafts['do'], drafts['ddo'])
let editId = null;       // Task ID currently being edited inline
let focusMode = false;   // Focus mode hides 'delegate' and 'delete' quadrants
let lastRemoved = null;  // Stack of recently deleted tasks for undo restoration
let toastTimer = null;   // Auto-dismiss timer for toast alerts
let lastAdded = null;    // Most recently added task ID (triggers CSS slide-in animation)
let active = 'do';       // Currently selected quadrant

/* ---------- Task Data Persistence ---------- */

/** Loads tasks from LocalStorage or synchronizes with backend */
async function loadTasks() {
  try {
    const storedData = JSON.parse(store.get(KEY));
    tasks = Array.isArray(storedData) ? storedData : [];
  } catch (error) {
    tasks = [];
  }

  // Attempt to fetch fresh tasks from MongoDB backend
  try {
    const response = await fetch(`${API_URL}/todos`);
    if (response.ok) {
      const serverTodos = await response.json();
      if (Array.isArray(serverTodos)) {
        tasks = serverTodos.map(todo => ({
          id: todo._id,
          created: todo.createdAt ? new Date(todo.createdAt).getTime() : Date.now(),
          q: todo.quadrant || 'do',
          title: todo.title,
          due: todo.deadline ? (typeof todo.deadline === 'string' ? todo.deadline.split('T')[0] : new Date(todo.deadline).toISOString().split('T')[0]) : '',
          done: todo.status === 'completed'
        }));
        saveTasks();
        render();
      }
    }
  } catch (error) {
    console.warn('Backend unavailable, running in local mode:', error.message);
  }
}

/** Persists task array to LocalStorage */
function saveTasks() {
  store.set(KEY, JSON.stringify(tasks));
}

/* ---------- Date Sorting & Badge Calculations ---------- */

/**
 * Sorts tasks cleanly:
 * 1. Incomplete tasks appear before completed tasks
 * 2. Earliest due date appears first (undated tasks sort to the bottom)
 * 3. Most recently created tasks appear first
 */
function sortTasks(taskList) {
  return [...taskList].sort((taskA, taskB) => {
    // 1. Completion status
    if (taskA.done !== taskB.done) {
      return taskA.done ? 1 : -1;
    }

    // 2. Due date (tasks without dates go to bottom)
    const timeA = taskA.due ? new Date(taskA.due + 'T00:00').getTime() : Infinity;
    const timeB = taskB.due ? new Date(taskB.due + 'T00:00').getTime() : Infinity;
    if (timeA !== timeB) {
      return timeA - timeB;
    }

    // 3. Creation timestamp
    return taskA.created - taskB.created;
  });
}

/**
 * Returns a styled HTML badge for task due dates:
 * - Overdue: Red badge (if incomplete)
 * - Today: Highlighted badge
 * - Tomorrow / Future: Formatted date label
 */
function dueBadge(task) {
  if (!task.due) return '';

  const dueTimestamp = Date.parse(task.due + 'T00:00');
  const todayTimestamp = Date.parse(todayStr + 'T00:00');
  const differenceInDays = Math.round((dueTimestamp - todayTimestamp) / ONE_DAY_IN_MS);

  let labelText = '';
  let badgeClass = '';

  if (differenceInDays < 0) {
    labelText = new Date(task.due + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    badgeClass = task.done ? '' : 'over';
  } else if (differenceInDays === 0) {
    labelText = 'Today';
    badgeClass = 'today';
  } else if (differenceInDays === 1) {
    labelText = 'Tomorrow';
  } else {
    labelText = new Date(task.due + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  return `<span class="due ${badgeClass}">${labelText}</span>`;
}

/* ---------- HTML Render Template Builders ---------- */

/**
 * Renders HTML for a single task item or its inline edit form
 */
function itemHTML(task) {
  // If this task is being edited inline, render the input form
  if (String(task.id) === String(editId)) {
    return `
      <li class="task">
        <div class="erow">
          <input class="ein" value="${escapeHTML(task.title)}">
          <input type="date" class="ed" value="${task.due || ''}">
          <button class="ok" data-act="save">Save</button>
          <button class="cancel" data-act="cancel">Cancel</button>
        </div>
      </li>
    `;
  }

  // Dropdown options to move task to another quadrant
  const moveOptions = ORDER.map(quadrantKey => {
    const isSelected = quadrantKey === task.q ? 'selected' : '';
    return `<option value="${quadrantKey}" ${isSelected}>${QUADRANTS[quadrantKey].label}</option>`;
  }).join('');

  const classNames = [
    'task',
    task.done ? 'done' : '',
    String(task.id) === String(lastAdded) ? 'enter' : ''
  ].filter(Boolean).join(' ');

  return `
    <li class="${classNames}" data-id="${task.id}" >
      <input type="checkbox" class="cb" ${task.done ? 'checked' : ''}>
      <div class="tmain">
        <span class="tt" title="Double-click to rename">${escapeHTML(task.title)}</span>
        ${dueBadge(task)}
      </div>
      <select class="mv">${moveOptions}</select>
      <button class="del">✕</button>
    </li>
  `;
}

/**
 * Renders HTML for an entire quadrant card (header, progress, tasks, input)
 */
function quadHTML(quadrantKey) {
  const quadrant = QUADRANTS[quadrantKey];
  const quadrantTasks = tasks.filter(task => task.q === quadrantKey);
  const sortedTasks = sortTasks(quadrantTasks);
  const completedCount = quadrantTasks.filter(task => task.done).length;
  const totalCount = quadrantTasks.length;
  const openCount = totalCount - completedCount;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const tasksListHTML = sortedTasks.length > 0
    ? sortedTasks.map(itemHTML).join('')
    : `<li class="qempty">${quadrant.empty}</li>`;

  const activeClass = quadrantKey === active ? ' active' : '';
  const taskDraft = drafts[quadrantKey] || '';
  const dateDraft = drafts['d' + quadrantKey] || '';

  return `
    <article class="quad ${quadrantKey}${activeClass}" data-q="${quadrantKey}">
      <header class="qh">
        <div>
          <h2>${quadrant.label}</h2>
          <p class="axis">${quadrant.axis}</p>
          <p class="desc">${quadrant.desc}</p>
        </div>
        <span class="qcount">${openCount} open</span>
      </header>
      <div class="qbar"><i style="width:${progressPercent}%"></i></div>
      <ul class="qlist">${tasksListHTML}</ul>
      <div class="qadd">
        <input class="qin" data-q="${quadrantKey}" value="${escapeHTML(taskDraft)}" placeholder="Add to ${quadrant.label.toLowerCase()}…" autocomplete="off">
        <input type="date" class="qdate" data-q="${quadrantKey}" value="${dateDraft}">
        <button class="qbtn" data-add="${quadrantKey}">Add</button>
      </div>
    </article>
  `;
}

/**
 * Renders the full user interface: stats bar and 4 quadrants
 */
function render() {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.done).length;
  const openTasks = totalTasks - completedTasks;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Segmented multi-color progress indicator
  const opacities = [1, 0.7, 0.45, 0.25];
  const progressSegmentsHTML = ORDER.map((quadrantKey, index) => {
    const quadrantTaskCount = tasks.filter(task => task.q === quadrantKey).length;
    const opacity = opacities[index];
    return `<i style="flex:${quadrantTaskCount};opacity:${opacity}" data-tip="${QUADRANTS[quadrantKey].label}: ${quadrantTaskCount}"></i>`;
  }).join('');

  // 1. Render Top Analytics Bar
  $('#stats').innerHTML = `
    <div class="stat">
      <span>Total</span>
      <strong>${totalTasks}</strong>
      <div class="seg">${progressSegmentsHTML}</div>
    </div>
    <div class="stat">
      <span>Open</span>
      <strong>${openTasks}</strong>
      <small>${totalTasks > 0 ? 100 - progressPercent : 0}% remaining</small>
    </div>
    <div class="stat">
      <span>Completed</span>
      <strong>${completedTasks}</strong>
      <small>${progressPercent}% of all</small>
    </div>
    <div class="stat">
      <span>Progress</span>
      <strong>${progressPercent}%</strong>
      <div class="bar"><i style="width:${progressPercent}%"></i></div>
    </div>
  `;

  // 2. Render 4 Priority Quadrants
  $('#matrix').className = 'matrix' + (focusMode ? ' focus' : '');
  $('#matrix').innerHTML = `
    <button class="corner" id="penBtn" data-tip="Notes">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
      </svg>
    </button>
    <div class="colhead">Urgent</div>
    <div class="colhead">Not urgent</div>
    <div class="rail top"><span>Important</span></div>
    ${quadHTML('do')}
    ${quadHTML('decide')}
    <div class="rail bottom"><span>Not important</span></div>
    ${quadHTML('delegate')}
    ${quadHTML('delete')}
  `;

  $('#focusBtn').classList.toggle('active', focusMode);
  lastAdded = null;
}

/* ---------- Task Operations & Actions ---------- */

/** Sets the currently highlighted quadrant */
function setActive(quadrantKey) {
  if (!quadrantKey || quadrantKey === active) return;
  active = quadrantKey;
  document.querySelectorAll('.quad').forEach(element => {
    element.classList.toggle('active', element.dataset.q === quadrantKey);
  });
}

/** Adds a new task into the specified quadrant */
function addTask(quadrantKey, customId = null) {

  const inputElement = document.querySelector(`.qin[data-q="${quadrantKey}"]`);
  const taskTitle = (drafts[quadrantKey] || '').trim();

  // If title is empty, trigger a gentle shake animation to prompt user input
  if (!taskTitle) {
    if (inputElement) {
      inputElement.classList.remove('shake');
      // Trigger layout reflow to restart animation
      void inputElement.offsetWidth;
      inputElement.classList.add('shake');
    }
    return;
  }

  const taskId = customId || String(Date.now());
  const dueDate = drafts['d' + quadrantKey] || '';

  tasks.push({
    id: taskId,
    created: Date.now(),
    q: quadrantKey,
    title: taskTitle,
    due: dueDate,
    done: false
  });

  // Reset drafts for this quadrant
  drafts[quadrantKey] = '';
  drafts['d' + quadrantKey] = '';
  lastAdded = taskId;

  saveTasks();
  render();

  // Return focus to input for fast batch entry
  const refreshedInput = document.querySelector(`.qin[data-q="${quadrantKey}"]`);
  if (refreshedInput) refreshedInput.focus();
}

/** Restores keyboard focus to a task by ID */
function refocus(taskId) {
  const taskElement = document.querySelector(`.task[data-id="${taskId}"]`);
  if (taskElement) taskElement.focus({ preventScroll: true });
}

/** Toggles complete / incomplete status of a task */
function toggleTask(taskId) {
  const task = tasks.find(item => String(item.id) === String(taskId));
  if (!task) return;

  task.done = !task.done;
  saveTasks();
  render();
  refocus(taskId);

  if (/^[0-9a-fA-F]{24}$/.test(String(taskId))) {
    fetch(`${API_URL}/update/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: task.done ? 'completed' : 'pending' })
    }).catch(err => console.warn('Failed to update status on server:', err));
  }
}

/** Deletes a single task and caches it for undo */
function removeTask(taskId) {
  const taskToDelete = tasks.find(item => String(item.id) === String(taskId));
  if (!taskToDelete) return;

  lastNoteDel = null; // Clear opposite undo pointer
  lastRemoved = [taskToDelete];
  tasks = tasks.filter(item => String(item.id) !== String(taskId));

  saveTasks();
  render();
  showToast('Task deleted', true);
}

/** Clears all completed tasks from the matrix */
function clearDone() {
  const completedTasks = tasks.filter(task => task.done);
  if (completedTasks.length === 0) {
    showToast('Nothing to clear', false);
    return;
  }

  lastNoteDel = null;
  lastRemoved = completedTasks;
  tasks = tasks.filter(task => !task.done);

  saveTasks();
  render();
  showToast(`Cleared ${completedTasks.length}`, true);
}

/** Reverts the last deletion (restores deleted note or task) */
function undo() {
  // 1. Undo note deletion if available
  if (lastNoteDel) {
    const deletedNote = lastNoteDel.note || lastNoteDel.n;
    const deletedIndex = lastNoteDel.index !== undefined ? lastNoteDel.index : lastNoteDel.idx;
    
    if (deletedNote && window.notebook && Array.isArray(window.notebook.notes)) {
      const targetPosition = Math.min(deletedIndex, window.notebook.notes.length);
      window.notebook.notes.splice(targetPosition, 0, deletedNote);
      lastNoteDel = null;
      if (typeof persistNotes === 'function') persistNotes();
      if (typeof renderList === 'function') renderList();
      hideToast();
      return;
    }
  }

  // 2. Undo task deletion
  if (!lastRemoved || lastRemoved.length === 0) return;

  tasks.push(...lastRemoved);
  lastRemoved = null;

  saveTasks();
  render();
  hideToast();
}

/** Saves inline edits made to task title and date */
function saveEdit() {
  if (editId === null) return;

  const editRowElement = document.querySelector('.erow');
  const targetTask = tasks.find(task => String(task.id) === String(editId));
  editId = null;

  if (targetTask && editRowElement) {
    const titleInputElement = editRowElement.querySelector('.ein');
    const dateInputElement = editRowElement.querySelector('.ed');
    const newTitle = titleInputElement ? titleInputElement.value.trim() : '';

    if (newTitle) {
      targetTask.title = newTitle;
      targetTask.due = dateInputElement ? dateInputElement.value : '';

      if (/^[0-9a-fA-F]{24}$/.test(String(targetTask.id))) {
        fetch(`${API_URL}/update/${targetTask.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: targetTask.title,
            deadline: targetTask.due || null
          })
        }).catch(err => console.warn('Failed to update task edits on server:', err));
      }
    }
  }

  saveTasks();
  render();

  if (targetTask) refocus(targetTask.id);
}

/** Toggles focus mode (hides Delegate and Drop boxes) */
function toggleFocus() {
  focusMode = !focusMode;
  render();
}

/** Updates active theme ('dark' | 'slate') */
function applyTheme(themeName) {
  document.documentElement.dataset.theme = themeName;
  $('#themeSel').value = themeName;
}

/** Displays temporary notification bar with optional undo action */
function showToast(messageText, isUndoable) {
  const toastElement = $('#toast');
  const undoButtonHTML = isUndoable ? '<button id="undoBtn">Undo</button>' : '';
  toastElement.innerHTML = `<span>${escapeHTML(messageText)}</span>${undoButtonHTML}`;
  toastElement.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 5000);
}

/** Dismisses the toast notification bar */
function hideToast() {
  $('#toast').classList.remove('show');
  lastRemoved = null;
  lastNoteDel = null;
}

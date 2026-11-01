# Taskora — Product Requirement & Architecture Document

## 1. Overview
**Taskora** is a minimalist, ultra-fast task management web application powered by the **2×2 Eisenhower Matrix**. It categorizes tasks along two critical axes:
- **Urgency:** Needs action within 24–48 hours vs. Flexible / Not Urgent
- **Importance:** Directly moves core goals forward vs. Low value / routine chores

The application requires **zero build steps** and runs natively on any modern web browser using standard semantic HTML5, CSS3 Custom Properties (Design Tokens), and Modular Vanilla JavaScript.

---

## 2. The 4 Quadrants

| Quadrant Key | Display Label | Axis | Strategy | Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `do` | **DO NOW** | Urgent · Important | Crisis control | Tackle first thing in the morning; sprint until completed. |
| `decide` | **DEEP WORK** | Not urgent · Important | The Golden Quadrant | Proactive strategic blocks (50%+ of daily leverage). |
| `delegate` | **DELEGATE** | Urgent · Not important | Batch & speed run | Hand off or batch in 30-minute afternoon sprints. |
| `delete` | **DROP** | Not urgent · Not important | Eliminate / Backlog | Ruthlessly filter, park, or purge. |

---

## 3. Project Directory Structure

```
Taskora/
├── index.html              # HTML shell & semantic structure
├── css/
│   ├── themes.css          # Design tokens & color palettes (Dark & Light · Slate)
│   └── style.css           # 2×2 matrix grid, notes workspace, typography, media queries
├── js/
│   ├── matrix.js           # Eisenhower matrix model, task CRUD, and sorting engine
│   ├── notes.js            # Notes workspace, slash tags (/do now, etc.), schedule parser
│   └── app.js              # Event dispatcher, keyboard shortcuts, bootstrap init
├── assets/
│   └── favicon.svg         # Violet 2×2 matrix brand mark
└── docs/
    └── PRD.md              # Project specifications & technical documentation
```

---

## 4. Notes Workspace & Slash Tag Commands

The dockable notes panel (toggled via the pencil icon in the matrix corner) allows frictionless thought-capture:
- **Slash Tags:** Typing `/` prompts a contextual tag menu:
  - `/do now` $\rightarrow$ Urgent · Important
  - `/deep work` $\rightarrow$ Not urgent · Important
  - `/delegate` $\rightarrow$ Urgent · Not important
  - `/drop` $\rightarrow$ Not urgent · Not important
- **Tag Highlighting:** Tags format inline as highlighted chips (`.cmd`).
- **Scheduling:** Clicking **Schedule** (or `Ctrl/⌘ + Enter`) parses tagged lines and pushes tasks directly into their corresponding matrix quadrant.

---

## 5. Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `/` | Jump focus to quick-capture task input in the active quadrant |
| `Enter` | Save task / Save inline edit |
| `Esc` | Cancel edit / Close modal / Close notes workspace |
| `Space` | Toggle completion status on focused task |
| `F` | Toggle **Focus Mode** (hides DELEGATE & DROP, displaying only DO NOW & DEEP WORK) |
| `Ctrl/⌘ + Enter` | Schedule tagged lines from the notes workspace into the matrix |

---

## 6. Data Storage & Schema Contract

All user data is persisted in browser `localStorage` under stable versioned keys:

| LocalStorage Key | Type | Description |
| :--- | :--- | :--- |
| `taskora-matrix-v1` | `Array<Task>` | Active and completed tasks array |
| `taskora-notes-v2` | `Object<Notebook>` | Notes array, pinned cards, and active note pointer |
| `taskora-theme` | `String` | Active theme (`"dark"` or `"slate"`) |
| `taskora-notes-mode` | `String` | Panel docking mode (`"left"`, `"right"`, `"full"`, `"min"`) |
| `taskora-guide-seen` | `String` | Flag marking if the onboarding guide has been dismissed |

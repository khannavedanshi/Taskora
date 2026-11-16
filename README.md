# Taskora

A minimalist Eisenhower Matrix task management and markdown notes web application.
Built with Vanilla JavaScript (ES6+), Modern CSS3, Node.js, Express, and MongoDB Atlas.

---

## Overview

Taskora is a full-stack productivity web application designed to help users organize and prioritize tasks effectively. Rather than managing an overwhelming flat to-do list, Taskora organizes work using the Eisenhower Decision Matrix (Urgent vs. Important) alongside a dockable rich-text scratchpad with interactive slash commands.

- DO NOW (Top Left): Urgent and Important - Tasks needing action within 24 to 48 hours.
- DEEP WORK (Top Right): Not Urgent, but Important - Long-term goals, planning, and focus work.
- DELEGATE (Bottom Left): Urgent, but Not Important - Tasks to hand off or batch quickly.
- DROP (Bottom Right): Neither Urgent nor Important - Low-value distractions to eliminate.

---

## Key Features

- 4-Quadrant Priority Matrix: Automatically sorts tasks by completion status, earliest due date, and creation timestamp.
- Cloud and Local Synchronization: Automatically saves tasks to MongoDB Atlas when running with Express, and seamlessly falls back to browser LocalStorage when offline.
- Dockable Scratchpad with Slash Commands: Built-in rich-text notes drawer that can dock left, right, fullscreen, or minimized. Type / to pick a quadrant tag (/do now, /deep work, /delegate, /drop) and click Schedule to send tasks directly into the matrix.
- Theme Switcher: Toggle between Dark Mode and Light Slate Mode with CSS design tokens.
- Focus Mode: Press F to temporarily hide Delegate and Drop boxes, keeping your attention strictly on high-priority work.
- 5-Second Undo Stack: Accidental task deletions can be instantly undone through an interactive toast bar.
- Due Date Badges: Dynamic color badges for Overdue, Today, and Tomorrow deadlines.

---

## How to Use Taskora

### 1. Adding a Task
1. Choose a quadrant card (DO NOW, DEEP WORK, DELEGATE, or DROP).
2. Type your task title in the input field at the bottom of the card.
3. (Optional) Pick a target due date using the date picker.
4. Click the Add button.

### 2. Managing Tasks
- Mark Complete: Click the checkbox next to any task. Completed tasks automatically move to the bottom.
- Edit Title or Date: Double-click any task title to open the inline editor. Edit the text or date and click Save.
- Move to Another Quadrant: Select a new quadrant from the dropdown menu on any task item.
- Delete a Task: Click the X button on the task. An Undo notification will appear at the bottom for 5 seconds.
- Clear All Done: Click the Clear done button in the top header to wipe all completed tasks at once.

### 3. Using the Notes Workspace
1. Click the pencil icon in the top-left corner of the matrix to open the Notes panel.
2. In the note editor, type / to trigger the slash autocomplete menu.
3. Select a quadrant (such as /do now or /deep work) and type your task on that line.
4. Click the Schedule button (or press Ctrl + Enter) to instantly import all tagged lines into your matrix.

---

## Tech Stack

- Frontend: Vanilla JavaScript (ES6+), HTML5, CSS3 (CSS Grid, Flexbox, Custom Properties)
- Backend: Node.js (ES Modules), Express.js
- Database: MongoDB Atlas (Cloud NoSQL), Mongoose ODM
- Tooling: Nodemon, Dotenv, CORS

---

## Project Structure

```
Taskora/
|-- backend/
|   |-- config/
|   |   `-- dbConnection.js    # MongoDB Atlas connection and DNS resolver
|   |-- controllers/
|   |   `-- todoController.js  # CRUD controllers (create, get, update, delete)
|   |-- models/
|   |   `-- todoModel.js       # Mongoose schema with enums and timestamps
|   `-- index.js               # Express application entry and static file server
|
|-- frontend/
|   |-- assets/
|   |   `-- favicon.svg        # Application branding icon
|   |-- css/
|   |   |-- style.css          # Core layouts, matrix grid, dockable panel
|   |   `-- themes.css         # Design tokens for Dark and Slate palettes
|   |-- js/
|   |   |-- app.js             # Event delegation and keyboard shortcuts
|   |   |-- matrix.js          # Eisenhower logic, sorting, state persistence
|   |   `-- notes.js           # Rich-text scratchpad and slash parser
|   `-- index.html             # Single-page semantic UI structure
|
|-- docs/                      # Technical architecture and design specs
|-- .env.example               # Environment variables template
|-- .gitignore                 # Ignored files (node_modules, .env)
|-- package.json               # Dependencies and scripts
`-- README.md                  # Project documentation
```

---

## REST API Endpoints

| Method | Endpoint | Description | Request Body |
| :--- | :--- | :--- | :--- |
| GET | /todos | Fetch all tasks from MongoDB | None |
| POST | /create | Create a new task | { "title": "...", "deadline": "...", "status": "pending", "quadrant": "do" } |
| PATCH | /update/:id | Update status, quadrant, title, or deadline | { "status": "completed" } or { "quadrant": "decide" } |
| DELETE | /delete/:id | Delete a task document by ID | None |

---

## Getting Started

### Prerequisites

- Node.js (version 18 or higher recommended)
- (Optional) A MongoDB Atlas connection string. If you do not have one, the app will automatically run in local offline mode using browser LocalStorage.

### Step-by-Step Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/khannavedanshi/Taskora.git
   cd Taskora
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Copy the example environment template:
   ```bash
   # On macOS / Linux:
   cp .env.example .env

   # On Windows (PowerShell):
   Copy-Item .env.example .env

   # On Windows (CMD):
   copy .env.example .env
   ```

   Open `.env` in any text editor and paste your MongoDB connection URI:
   ```env
   PORT=3000
   MONGO_URI=your_mongodb_connection_string_here
   ```

4. Start the server:
   ```bash
   # Development mode (with auto-restart on changes):
   npm run dev

   # Production mode:
   npm start
   ```

5. Launch the application:
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```
   Both the frontend user interface and backend API run together seamlessly on port 3000.

---

## Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| F | Toggle Focus Mode (hide low-priority quadrants) |
| / | Focus the input field in the DO NOW box |
| Esc | Cancel active edit, close guide modal, or close notes drawer |
| Space | Complete the highlighted task |
| Ctrl + Enter | Schedule tagged lines from Notes into the Matrix |

---

## Author

Vedanshi Khanna
GitHub: https://github.com/khannavedanshi

---

## License

This project is licensed under the ISC License.


import cors from "cors";


// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

// Import the Express web framework
import express from 'express';

// Import the database connection function from config folder
import connectDB from './config/dbConnection.js';

// Import built-in path utilities for ES modules
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve current directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import controller functions
import { createTodo, deleteTodo, getTodos, updateTodo } from './controllers/todoController.js';

// Connect to MongoDB database before handling requests use await here
await connectDB();

// Initialize the Express application
const app = express();

// Set the port number
const PORT = process.env.PORT || 3000;

app.use(cors());

// Parse incoming JSON request bodies
app.use(express.json());

// Serve frontend static assets (CSS, JS, images)
app.use(express.static(path.join(__dirname, '../frontend')));

// GET route to fetch all tasks
app.get('/todos', getTodos);

// POST route to create a task
app.post('/create', createTodo);

// PATCH route to update a task by ID (status, quadrant, title, deadline)
app.patch('/update/:id', updateTodo);

// DELETE route to delete a task by ID (supports URL parameter or request body)
app.delete('/delete/:id', deleteTodo);

// Root route to serve the frontend single-page application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});


// Start the server and listen on the specified port
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

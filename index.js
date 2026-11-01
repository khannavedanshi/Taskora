// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

// Import the Express web framework
import express from 'express';

// Import the database connection function from config folder
import connectDB from './config/dbConnection.js';

// Import controller functions
import { createTodo, deleteTodo } from './controllers/todoController.js';

// Connect to MongoDB database before handling requests use await here
await connectDB();

// Initialize the Express application
const app = express();

// Set the port number
const PORT = process.env.PORT || 3000;

// Parse incoming JSON request bodies
app.use(express.json());

// POST route to create a task
app.post('/create', createTodo);

// DELETE route to delete a task by ID (supports URL parameter or request body)
app.delete('/delete/:id', deleteTodo);


// Start the server and listen on the specified port
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

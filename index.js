// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

// Import the Express web framework
import express from 'express';

// Import the database connection function from config folder
import connectDB from './config/dbConnection.js';

// Import controller function
import { createTodo } from './controllers/todoController.js';

// Connect to MongoDB database before handling requests
connectDB();

// Initialize the Express application
const app = express();

// Set the port number
const PORT = process.env.PORT || 3000;

// Parse incoming JSON request bodies
app.use(express.json());

// POST route to create a task
app.post('/create', createTodo);

// Start the server and listen on the specified port
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

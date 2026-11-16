// Import mongoose to validate ObjectId
import mongoose from 'mongoose';
// Import the Todo model
import Todo from '../models/todoModel.js';

// Controller function to handle task creation
export const createTodo = async (req, res) => {
  try {
    // Extract task fields from the request body
    const { title, deadline, status, quadrant } = req.body;

    // Check if title was provided
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    // Create a new task document in MongoDB
    const newTodo = await Todo.create({
      title,
      deadline: deadline || null,
      status: status || 'pending',
      quadrant: quadrant || 'do',
    });

    // Send back the created task with 201 Created status
    res.status(201).json(newTodo);
  } catch (error) {
    // Send back error message with 500 Server Error status
    res.status(500).json({ message: error.message });
  }
};

// Controller function to fetch all tasks from MongoDB
export const getTodos = async (req, res) => {
  try {
    const todos = await Todo.find().sort({ createdAt: 1 });
    res.status(200).json(todos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Controller function to update a task (status, quadrant, title, deadline)
export const updateTodo = async (req, res) => {
  try {
    const id = req.params.id || req.body.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid task ID format' });
    }

    const { title, deadline, status, quadrant } = req.body;
    const updateData = {};

    if (title !== undefined) updateData.title = title;
    if (deadline !== undefined) updateData.deadline = deadline;
    if (status !== undefined) updateData.status = status;
    if (quadrant !== undefined) updateData.quadrant = quadrant;

    const updatedTodo = await Todo.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

    if (!updatedTodo) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(200).json(updatedTodo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




// Controller function to handle task deletion
export const deleteTodo = async (req, res) => {
  try {
    // Get the task ID from URL parameters or request body
    const id = req.params.id || req.body.id;

    // Check if ID was provided
    if (!id) {
      return res.status(400).json({ message: 'Task ID is required' });
    }

    // Validate that the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid task ID format' });
    }

    // Find and delete the task document in MongoDB
    const deletedTodo = await Todo.findByIdAndDelete(id);

    // Check if the task was found
    if (!deletedTodo) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Send back success message and the deleted task
    res.status(200).json({ message: 'Task deleted successfully', deletedTodo });
  } catch (error) {
    // Send back error message with 500 Server Error status
    res.status(500).json({ message: error.message });
  }
};

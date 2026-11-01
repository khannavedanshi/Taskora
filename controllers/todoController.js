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

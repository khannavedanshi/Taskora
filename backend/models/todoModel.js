// Import mongoose to define database schema
import mongoose from 'mongoose';

// Define the schema for a task
const todoSchema = new mongoose.Schema(
  {
    // Task title/description
    title: {
      type: String,
      required: true,
      trim: true,
    },
    // Optional deadline date
    deadline: {
      type: Date,
      default: null,
    },
    // Task status: pending or completed
    status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'pending',
    },
    // Eisenhower Matrix box: do, decide, delegate, delete
    quadrant: {
      type: String,
      enum: ['do', 'decide', 'delegate', 'delete'],
      default: 'do',
    },
  },
  {
    // Automatically manage createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// Create and export the Todo model
const Todo = mongoose.model('Todo', todoSchema);
export default Todo;

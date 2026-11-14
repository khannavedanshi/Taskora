// Import mongoose library to interact with MongoDB
import mongoose from 'mongoose';
// Import built-in DNS module to resolve network addresses
import dns from 'dns';

// Set Google Public DNS to prevent querySrv ECONNREFUSED errors
dns.setServers(['8.8.8.8', '8.8.4.4']);

// Function to establish connection with MongoDB
const connectDB = async () => {
  try {
    // Connect to MongoDB database
    const conn = await mongoose.connect(process.env.MONGO_URI);
    // conn.connection.host stores the database host address where MongoDB is connected
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // error.message contains the text description of why the connection failed
    console.error(`MongoDB Connection Error: ${error.message}`);
  }
};

// Export the connection function
export default connectDB;

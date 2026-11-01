// Import the Express web framework
import express from 'express';

// Initialize the Express application
const app = express();

// Set the port number
const PORT = process.env.PORT || 3000;

// Parse incoming JSON request bodies
app.use(express.json());

// Simple GET route to test if the server is working

// console.log("before request");
// app.get('/', (req, res) => {
//    console.log("get req is executed before reply");
//   // res.send('true');
//   res.send('HELLO MEWWY CHRISMAS');
//   console.log("i am executed after reply");
// });




// Start the server and listen on the specified port
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

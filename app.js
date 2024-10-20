const express = require('express');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require("dotenv")
dotenv.config()

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY;

mongoose.set('strictQuery', false);

const uri = process.env.MONGO_URI;




mongoose.connect(uri,{'dbName':'SocialDB'});

const User = mongoose.model('User', { username: String, email: String, password: String });
const Post = mongoose.model('Post', { userId: mongoose.Schema.Types.ObjectId, text: String });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: SECRET_KEY, resave: false, saveUninitialized: true, cookie: { secure: false } }));


// Function to authenticate JWT token
function authenticateJWT(req, res, next) {
    const token = req.session.token;
  
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
  
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  }

// Function to require authorization
function requireAuth(req, res, next) {
    const token = req.session.token;
    if (!token) return res.redirect('/login');
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      req.user = decoded;
      next();
    } catch (error) {
      return res.redirect('/login');
    }
  }



// HTML Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/post', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'post.html')));
app.get('/index', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html'), { username: req.user.username }));


// Handle User registration
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
  
    try {
      const existingUser = await User.findOne({ $or: [{ username }, { email }] });
  
      if (existingUser) return res.status(400).json({ message: 'User already exists' });
  
      const newUser = new User({ username, email, password });
      await newUser.save();
  
      const token = jwt.sign({ userId: newUser._id, username: newUser.username }, SECRET_KEY, { expiresIn: '1h' });
      req.session.token = token;
  
      res.send({"message":`The user ${username} has been added`});
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });


// Handle User Login
// app.post('/login', async (req, res) => {
//     let { username, password } = req.body;

//     console.log(typeof(username));
    
    
//     try {
//       const user = await User.findOne({ username, password });
  
//       if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  
//       const token = jwt.sign({ userId: user._id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
//       req.session.token = token;
  
//       res.redirect({"mesage":`${user.username} has logged in`});
//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ message: 'Internal Server Error' });
//     }
//   });

// Handle User Login
app.post('/login', async (req, res) => {
    let { username, password } = req.body;
  
    console.log(typeof(username)); // For debugging, should be a string
    
    try {
      // Find the user in the database
      const user = await User.findOne({ username, password });
    
      if (!user) {
        // If the user is not found, send an unauthorized response
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    
      // Generate a JWT token
      const token = jwt.sign(
        { userId: user._id, username: user.username },
        SECRET_KEY,
        { expiresIn: '1h' }
      );
      
      // Store the token in the session
      req.session.token = token;
    
      // Respond with a success message
      res.json({ message: `${user.username} has logged in`, token });
    } catch (error) {
      console.error(error);
      // Send a 500 Internal Server Error response
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  

// Handle request to create new Post
app.post('/posts', authenticateJWT, (req, res) => {
    const { text } = req.body;
  
    if (!text || typeof text !== 'string') return res.status(400).json({ message: 'Please provide valid post content' });
  
    const newPost = { userId: req.user.userId, text };
    posts.push(newPost);
  
    res.status(201).json({ message: 'Post created successfully' });
  });


// Handle Update the post request
app.put('/posts/:postId', authenticateJWT, (req, res) => {
  const postId = parseInt(req.params.postId);
  const { text } = req.body;

  const postIndex = posts.findIndex((post) => post.id === postId && post.userId === req.user.userId);

  if (postIndex === -1) return res.status(404).json({ message: 'Post not found' });

  posts[postIndex].text = text;

  res.json({ message: 'Post updated successfully', updatedPost: posts[postIndex] });
});


// Handle Delete Posts
app.delete('/posts/:postId', authenticateJWT, (req, res) => {
    const postId = parseInt(req.params.postId);
  
    const postIndex = posts.findIndex((post) => post.id === postId && post.userId === req.user.userId);
  
    if (postIndex === -1) return res.status(404).json({ message: 'Post not found' });
  
    const deletedPost = posts.splice(postIndex, 1)[0];
  
    res.json({ message: 'Post deleted successfully', deletedPost });
  });



// Logout user
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) console.error(err);
      res.redirect('/login');
    });
  });

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

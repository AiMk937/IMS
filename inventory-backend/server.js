const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env file

const app = express();

// Middleware to parse incoming form data
app.use(express.urlencoded({ extended: true })); // Parses URL-encoded data from forms
app.use(express.json()); // Parses JSON data from requests

// Set EJS as the template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (CSS, JS, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
const MONGO_URI =
  process.env.MONGO_URI ||
  ';

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
  })
  .then(() => console.log('MongoDB Connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit the process if connection fails
  });

// Routes for handling inventory-related requests
const itemRoutes = require('./routes/itemRoutes');
app.use('/items', itemRoutes);

// Routes for invoice generation
const invoiceRoutes = require('./routes/invoiceRoutes');
app.use('/invoice', invoiceRoutes);

// Root route for redirecting to inventory list
app.get('/', (req, res) => {
  res.redirect('/items');
});

// Handle unknown routes (404)
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack);
  res.status(500).send('Internal Server Error');
});

// Start the server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

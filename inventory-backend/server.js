const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env file

const app = express();

// -------------------------------
// Middleware Setup
// -------------------------------
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded form data
app.use(express.json()); // Parse JSON data from requests
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files (CSS, JS, images)

// -------------------------------
// Template Engine Setup
// -------------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// -------------------------------
// MongoDB Connection
// -------------------------------
const MONGO_URI = process.env.MONGO_URI || 
  'mongodb+srv://aimaanjkhaan:Arshee2597@cluster1.1ycsg.mongodb.net/?retryWrites=true&w=majority';

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
  })
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1); // Exit the process if connection fails
  });

// -------------------------------
// Routes
// -------------------------------

// Home Route
const homeRoutes = require('./routes/homeRoutes');
app.use('/', homeRoutes);

// Item Management Routes
const itemRoutes = require('./routes/itemRoutes');
app.use('/items', itemRoutes);

// Invoice Management Routes
const invoiceRoutes = require('./routes/invoiceRoutes');
app.use('/invoice', invoiceRoutes);

// Packaging Material Routes
const packagingMaterialRoutes = require('./routes/PackagingMaterialRoutes');
app.use('/packaging', packagingMaterialRoutes);

// Profit Analysis Routes
const profitRoutes = require('./routes/profitRoutes');
app.use('/', profitRoutes);

// -------------------------------
// Handle Unknown Routes (404)
// -------------------------------
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// -------------------------------
// Global Error Handler
// -------------------------------
app.use((err, req, res, next) => {
  console.error('❌ Global Error Handler:', err.stack);
  res.status(500).send('Internal Server Error');
});

// -------------------------------
// Start Server
// -------------------------------
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

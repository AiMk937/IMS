const express = require('express');
const router = express.Router();
const Item = require('../models/item'); // Import Item model
const multer = require('multer');
const path = require('path');

// Multer configuration for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads'); // Save files to 'public/uploads'
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Add timestamp to file name
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 }, // Limit file size to 100 KB
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|gif/; // Allowed file types
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png, gif) are allowed.'));
    }
  },
});

// Route: List all items (Inventory List)
router.get('/', async (req, res) => {
  try {
    const items = await Item.find(); // Fetch all items from the database
    res.render('inventory/list', { items }); // Render the EJS view and pass items
  } catch (err) {
    console.error('Error fetching items:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Route: Show form to add a new item
router.get('/add', (req, res) => {
  res.render('inventory/add'); // Render the EJS form for adding an item
});

// Route: Add a new item
router.post('/add', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('Error uploading image:', err);
      return res.status(400).send('Error: Invalid file upload. Ensure the file is an image and less than 100 KB.');
    }
    next();
  });
}, async (req, res) => {
  const {
    name,
    description,
    costPrice,
    sellingPrice,
    quantity,
    sku = '', // Default to empty string if not provided
    category = '', // Default to empty string if not provided
    reorderLevel = 0, // Default to 0 if not provided
  } = req.body;

  try {
    const image = req.file ? `/uploads/${req.file.filename}` : null; // Save file path if image exists

    // Debugging: Log the form input and file details
    console.log('Form Data:', {
      name,
      description,
      costPrice,
      sellingPrice,
      quantity,
      sku,
      category,
      reorderLevel,
    });
    if (req.file) {
      console.log('Uploaded File Info:', req.file);
    } else {
      console.log('No file uploaded.');
    }

    const newItem = new Item({
      name,
      description,
      costPrice: parseFloat(costPrice),
      sellingPrice: parseFloat(sellingPrice),
      quantity: parseInt(quantity, 10),
      sku,
      category,
      reorderLevel: parseInt(reorderLevel, 10),
      image,
    });

    await newItem.save(); // Save the new item to the database
    console.log('New item successfully added to the database:', newItem); // Debugging: Log the saved item
    res.redirect('/items'); // Redirect back to the inventory list
  } catch (err) {
    console.error('Error adding item:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;

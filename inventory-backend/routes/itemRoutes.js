const express = require('express');
const router = express.Router();
const Item = require('../models/item'); // Import Item model
const multer = require('multer');

// Multer configuration for image uploads (store in memory)
const storage = multer.memoryStorage(); // Store files in memory as buffers
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 }, // Limit file size to 100 KB
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|gif/; // Allowed file types
    const extname = fileTypes.test(file.originalname.toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png, gif) are allowed.'));
    }
  },
});

// Route: List all items
router.get('/', async (req, res) => {
  try {
    const selectedCategory = req.query.category || ''; // Get selected category from query
    const categories = ['Beauty Products', 'Clips','Clothing', 'Clutchers', 'Electronics', 'Hairbands', 'Headbands', 'Caps', 'Scrunchie', 'Toys', 'Other'].sort(); // Predefined categories

    let query = {}; // Query object to filter items

    if (selectedCategory) {
      query.category = selectedCategory; // Filter by category if provided
    }

    // Fetch items with optional category filter
    const items = await Item.find(query);

    // Convert image buffer to Base64 for each item
    const itemsWithImages = items.map((item) => ({
      ...item._doc, // Spread the existing item fields
      imageBase64: item.image
        ? `data:${item.image.contentType};base64,${item.image.data.toString('base64')}`
        : null, // Convert image to Base64 or null if no image
    }));

    res.render('inventory/list', { items: itemsWithImages, categories, selectedCategory }); // Pass items with Base64 images to the view
  } catch (err) {
    console.error('Error fetching items:', err);
    res.status(500).send('Internal Server Error');
  }
});


// Route: Show add page for a new item
router.get('/add', (req, res) => {
  // Predefined categories
  const categories = ['Beauty Products','Clips', 'Clothing', 'Clutchers', 'Electronics', 'Hairbands', 'Headbands', 'Caps', 'Scrunchie', 'Toys', 'Other'].sort();
  res.render('inventory/add', { item: {}, categories }); // Pass categories to the EJS view
});

// Route: Add a new item
router.post('/add', upload.single('image'), async (req, res) => {
  const {
    name,
    description,
    costPrice,
    sellingPrice,
    quantity,
    sku = '',
    category = '',
    reorderLevel = 0,
  } = req.body;

  try {
    const newItem = new Item({
      name,
      description,
      costPrice: parseFloat(costPrice),
      sellingPrice: parseFloat(sellingPrice),
      quantity: parseInt(quantity, 10),
      sku,
      category,  // Store the selected or custom category
      reorderLevel: parseInt(reorderLevel, 10),
    });

    // Add image if uploaded
    if (req.file) {
      newItem.image = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      };
    }

    await newItem.save(); // Save the new item to the database
    console.log(`New item added: ${newItem.name}`);
    res.redirect('/items'); // Redirect back to the inventory list
  } catch (err) {
    console.error('Error adding new item:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Route: Show edit page for an item
router.get('/edit/:id', async (req, res) => {
  const { id } = req.params;
  const categories = ['Beauty Products', 'Clips', 'Clothing', 'Clutchers', 'Electronics', 'Hairbands', 'Headbands', 'Caps', 'Scrunchie', 'Toys', 'Other'].sort(); // Predefined categories

  console.log('Editing item with ID:', id); // Debugging log

  try {
    const item = await Item.findById(id); // Fetch the item by ID
    if (!item) {
      return res.status(404).send('Item not found');
    }

    // Convert image buffer to Base64 for display
    const itemWithImage = {
      ...item._doc,
      imageBase64: item.image && item.image.data && item.image.contentType
        ? `data:${item.image.contentType};base64,${item.image.data.toString('base64')}`
        : null,
    };

    // Pass the item and categories to the view
    res.render('inventory/edit', { item: itemWithImage, categories });
  } catch (err) {
    console.error('Error fetching item for edit:', err.message); // Log error
    res.status(500).send('Internal Server Error');
  }
});
// Route: Update an item
router.post('/edit/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    costPrice,
    sellingPrice,
    quantity,
    sku = '',
    category = '',
    reorderLevel = 0,
  } = req.body;

  try {
    const updateData = {
      name,
      description,
      costPrice: parseFloat(costPrice),
      sellingPrice: parseFloat(sellingPrice),
      quantity: parseInt(quantity, 10),
      sku,
      category,
      reorderLevel: parseInt(reorderLevel, 10),
    };

    // Replace image if a new one is uploaded
    if (req.file) {
      updateData.image = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      };
    }

    const updatedItem = await Item.findByIdAndUpdate(id, updateData, { new: true }); // Update the item
    if (!updatedItem) {
      return res.status(404).send('Item not found for updating.');
    }

    console.log(`Item with ID ${id} successfully updated.`);
    res.redirect('/items'); // Redirect back to the inventory list
  } catch (err) {
    console.error('Error updating item:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Route: Delete an item
router.get('/delete/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const item = await Item.findByIdAndDelete(id); // Find item by ID and delete
    if (!item) {
      return res.status(404).send('Item not found');
    }

    console.log(`Item with ID ${id} successfully deleted.`);
    res.redirect('/items'); // Redirect back to the inventory list
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;

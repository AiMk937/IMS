const express = require('express');
const router = express.Router();
const Item = require('../models/item'); // Import Item model
const multer = require('multer');

// Multer configuration for image uploads (store in memory)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 }, // Limit file size to 100 KB
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|gif/;
    const extname = fileTypes.test(file.originalname.toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png, gif) are allowed.'));
    }
  },
});

// Predefined categories
const predefinedCategories = [
  'Beauty Products',
  'Bracelet',
  'Clips',
  'Clothing',
  'Clutchers',
  'Electronics',
  'Hairbands',
  'Headbands',
  'Caps',
  'Scrunchie',
  'Toys',
  'Other',
].sort();

// Route: List all items with pagination
router.get('/', async (req, res) => {
  try {
    const selectedCategory = req.query.category || ''; // Get selected category from query
    const search = req.query.search || ''; // Get search query from query string
    const page = parseInt(req.query.page, 10) || 1; // Get current page from query string, default to 1
    const perPage = 10; // Number of items per page
    const categories = [
      'Beauty Products',
      'Bracelet',
      'Clips',
      'Clothing',
      'Clutchers',
      'Electronics',
      'Hairbands',
      'Headbands',
      'Caps',
      'Scrunchie',
      'Toys',
      'Other',
    ].sort();

    let query = {}; // Query object to filter items

    if (selectedCategory) {
      query.category = selectedCategory; // Filter by category if provided
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } }, // Case-insensitive search in name
        { description: { $regex: search, $options: 'i' } }, // Case-insensitive search in description
      ];
    }

    // Fetch filtered and paginated items
    const totalItems = await Item.countDocuments(query); // Total count of matching items
    const items = await Item.find(query)
      .skip((page - 1) * perPage) // Skip items for previous pages
      .limit(perPage); // Limit to items per page

    // Convert image buffer to Base64 for each item
    const itemsWithImages = items.map((item) => ({
      ...item._doc,
      imageBase64: item.image
        ? `data:${item.image.contentType};base64,${item.image.data.toString('base64')}`
        : null,
    }));

    const totalPages = Math.ceil(totalItems / perPage); // Calculate total pages

    res.render('inventory/list', {
      items: itemsWithImages,
      categories,
      selectedCategory,
      search,
      currentPage: page, // Pass the current page to the template
      totalPages, // Pass the total pages to the template
    });
  } catch (err) {
    console.error('Error fetching items:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Route: Show add page for a new item
router.get('/add', (req, res) => {
  res.render('inventory/add', { item: {}, categories: predefinedCategories });
});

// Route: Add a new item
router.post('/add', upload.single('image'), async (req, res) => {
  const { name, description, costPrice, sellingPrice, quantity, sku = '', category = '', reorderLevel = 0 } = req.body;

  try {
    const newItem = new Item({
      name,
      description,
      costPrice: parseFloat(costPrice),
      sellingPrice: parseFloat(sellingPrice),
      quantity: parseInt(quantity, 10),
      sku,
      category,
      reorderLevel: parseInt(reorderLevel, 10),
    });

    if (req.file) {
      newItem.image = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      };
    }

    await newItem.save();
    console.log(`New item added: ${newItem.name}`);
    res.redirect('/items');
  } catch (err) {
    console.error('Error adding new item:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Route: Show edit page for an item
router.get('/edit/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).send('Item not found');
    }

    const itemWithImage = {
      ...item._doc,
      imageBase64: item.image
        ? `data:${item.image.contentType};base64,${item.image.data.toString('base64')}`
        : null,
    };

    res.render('inventory/edit', { item: itemWithImage, categories: predefinedCategories });
  } catch (err) {
    console.error('Error fetching item for edit:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Route: Update an item
router.post('/edit/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { name, description, costPrice, sellingPrice, quantity, sku = '', category = '', reorderLevel = 0 } = req.body;

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

    if (req.file) {
      updateData.image = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      };
    }

    const updatedItem = await Item.findByIdAndUpdate(id, updateData, { new: true });
    if (!updatedItem) {
      return res.status(404).send('Item not found for updating.');
    }

    console.log(`Item with ID ${id} successfully updated.`);
    res.redirect('/items');
  } catch (err) {
    console.error('Error updating item:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Route: Delete an item
router.get('/delete/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const item = await Item.findByIdAndDelete(id);
    if (!item) {
      return res.status(404).send('Item not found');
    }

    console.log(`Item with ID ${id} successfully deleted.`);
    res.redirect('/items');
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;

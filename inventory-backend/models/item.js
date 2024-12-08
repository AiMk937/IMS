const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' }, // Default to empty string
  costPrice: { type: Number, required: true },
  sellingPrice: { type: Number, required: true },
  quantity: { type: Number, required: true },
  sku: { type: String, default: '' }, // Default to empty string
  category: { type: String, default: '' }, // Default to empty string
  reorderLevel: { type: Number, default: 0 }, // Default to 0
  image: { type: String, default: null } // Default to null if no image is provided
});

module.exports = mongoose.model('Item', itemSchema);

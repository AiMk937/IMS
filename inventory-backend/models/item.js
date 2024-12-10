const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    costPrice: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    quantity: { type: Number, required: true },
    sku: { type: String, required: true, unique: true }, // Add unique constraint
    category: { type: String },
    reorderLevel: { type: Number },
    image: { data: Buffer, contentType: String }, // Store binary image data
  },
  { timestamps: true } // Enable createdAt and updatedAt fields
);

module.exports = mongoose.model('Item', itemSchema);

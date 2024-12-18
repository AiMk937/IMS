const mongoose = require('mongoose');

const ecommerceOrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  platform: { type: String, enum: ['Amazon', 'Flipkart', 'Meesho'], required: true },
  platformCharges: { type: Number, default: 0 },
  GSTCharges: { type: Number, default: 0 },
  shippingCharges: { type: Number, default: 0 },
  products: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
      quantity: { type: Number, required: true },
      sellingPrice: { type: Number, required: true }, // Custom price entered for the product
    },
  ],
  packagingMaterials: [
    {
      packagingId: { type: mongoose.Schema.Types.ObjectId, ref: 'PackagingMaterial' },
      quantity: { type: Number, required: true },
    },
  ],
  totalAmount: { type: Number, default: 0 },
  profit: { type: Number, default: 0 }, // Add profit field
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('EcommerceOrder', ecommerceOrderSchema);

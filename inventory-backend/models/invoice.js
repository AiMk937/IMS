const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  buyer: {
    name: { type: String, required: true },
    address: { type: String, required: true },
    contactNumber: { type: String, required: true },
  },
  items: [
    {
      itemId: mongoose.Schema.Types.ObjectId,
      name: String,
      description: String,
      quantity: Number,
      price: Number,
      total: Number,
    },
  ],
  packagingDetails: [
    {
      materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'PackagingMaterial' },
      name: String,
      quantityUsed: Number,
      cost: Number,
    },
  ],
  shippingCharges: {
    type: Number,
    default: 0, // Default value if no shipping charges are provided
    required: true,
  },
  shippingPayer: {
    type: String,
    enum: ['seller', 'customer'],
    required: true,
  },
  packagingCost: { type: Number, default: 0 },
  totalAmount: Number,
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Invoice', invoiceSchema);

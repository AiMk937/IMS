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
  totalAmount: Number,
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Invoice', invoiceSchema);

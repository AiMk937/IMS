// models/Order.js
const mongoose = require('mongoose');
const PackagingMaterial = require('./PackagingMaterial');

const orderSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  items: [
    {
      itemId: mongoose.Schema.Types.ObjectId,
      quantity: Number,
      price: Number,
      total: Number,
    },
  ],
  totalAmount: {
    type: Number,
    required: true,
  },
  packagingMaterials: [
    {
      materialId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PackagingMaterial',
        required: true,
      },
      quantityUsed: {
        type: Number,
        required: true,
      },
      cost: {
        type: Number,
        required: true,
      },
      volumetricWeight: {
        type: Number,
        required: true,
      },
    },
  ],
  totalPackagingCost: {
    type: Number,
    default: 0,
  },
  finalTotalCost: {
    type: Number,
    required: true,
  },
  date: { type: Date, default: Date.now },
});

orderSchema.pre('save', function(next) {
  // Calculate total packaging cost before saving
  const totalPackagingCost = this.packagingMaterials.reduce(
    (acc, material) => acc + material.cost * material.quantityUsed,
    0
  );
  this.totalPackagingCost = totalPackagingCost;
  this.finalTotalCost = this.totalAmount + totalPackagingCost;
  next();
});

module.exports = mongoose.model('Order', orderSchema);

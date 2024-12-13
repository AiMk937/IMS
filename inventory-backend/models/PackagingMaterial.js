// models/PackagingMaterial.js
const mongoose = require('mongoose');

// Function to calculate volumetric weight
const calculateVolumetricWeight = (length, width, height) => {
  // Assuming the formula for volumetric weight is based on the formula:
  // (length x width x height) / 5000 (for kg)
  return (length * width * height) / 5000; // Returns volumetric weight in kilograms
};

const packagingMaterialSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ['box', 'shipping box', 'shipping bag', 'plastic'],
    required: true,
  },
  cost: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: false,
  },
  dimensions: {
    length: {
      type: Number,
      required: function () {
        return this.category === 'shipping box'; // Only required for shipping box
      },
    },
    width: {
      type: Number,
      required: function () {
        return this.category === 'shipping box'; // Only required for shipping box
      },
    },
    height: {
      type: Number,
      required: function () {
        return this.category === 'shipping box'; // Only required for shipping box
      },
    },
    volumetricWeight: {
      type: Number,
      default: function () {
        // Calculate volumetric weight if it's a shipping box
        if (this.category === 'shipping box') {
          return calculateVolumetricWeight(this.dimensions.length, this.dimensions.width, this.dimensions.height);
        }
        return 0; // No volumetric weight for other categories
      },
    },
  },
  quantity: {
    type: Number,
    required: true,
    default: 0, // Default quantity is 0, update it as needed
  },
  reorderLevel: {
    type: Number,
    required: true,
    default: 10, // Default reorder level is 10
  },
});

module.exports = mongoose.model('PackagingMaterial', packagingMaterialSchema);

const express = require('express');
const router = express.Router();
const EcommerceOrder = require('../models/e-commerce');
const Item = require('../models/item');
const PackagingMaterial = require('../models/PackagingMaterial');

// GET: View all e-commerce orders with optional platform filtering
router.get('/view', async (req, res) => {
  try {
    const { platform } = req.query;
    const filter = platform && platform !== 'All' ? { platform } : {};

    const orders = await EcommerceOrder.find(filter)
      .populate('products.productId')
      .populate('packagingMaterials.packagingId');

    res.render('ecommerce/viewOrders', { orders, selectedPlatform: platform || 'All' });
  } catch (err) {
    console.error('❌ Error loading orders:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

// GET: Add E-commerce Order Page
router.get('/add', async (req, res) => {
  try {
    const items = await Item.find();
    const packagingMaterials = await PackagingMaterial.find();

    res.render('ecommerce/addOrder', { items, packagingMaterials });
  } catch (err) {
    console.error('❌ Error loading add order page:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/add-order', async (req, res) => {
  try {
    const {
      orderNumber,
      platform,
      platformCharges,
      GSTCharges,
      shippingCharges,
      products,
      packagingMaterials,
    } = req.body;

    let totalAmount = 0; // Total selling price for the order
    let totalCost = 0;   // Total cost price (products + packaging materials)
    let totalProfit = 0; // Profit = Total Selling Price - Total Cost - Charges

    // Process products
    const processedProducts = [];
    for (const product of products) {
      const { productId, quantity, sellingPrice } = product;

      const item = await Item.findById(productId);
      if (!item) throw new Error(`Product with ID ${productId} not found.`);

      const quantitySold = Number(quantity);
      const totalSellingPrice = Number(sellingPrice); // Total price for all quantities
      if (quantitySold <= 0 || totalSellingPrice <= 0) {
        throw new Error(`Invalid selling price or quantity for product: ${item.name}`);
      }

      const unitSellingPrice = totalSellingPrice / quantitySold; // Per unit price
      const costPrice = item.costPrice || 0;

      if (item.quantity < quantitySold) {
        throw new Error(`Insufficient stock for product: ${item.name}`);
      }

      item.quantity -= quantitySold;
      await item.save();

      // Update totals
      totalAmount += totalSellingPrice;
      totalCost += costPrice * quantitySold;

      processedProducts.push({
        productId,
        quantity: quantitySold,
        sellingPrice: totalSellingPrice, // Total price for all quantities
      });
    }

    // Process packaging materials
    const processedPackaging = [];
    for (const packaging of packagingMaterials) {
      const { packagingId, quantity } = packaging;

      const material = await PackagingMaterial.findById(packagingId);
      if (!material) throw new Error(`Packaging material with ID ${packagingId} not found.`);

      const quantityUsed = Number(quantity);
      if (quantityUsed <= 0) {
        throw new Error(`Invalid quantity for packaging material: ${material.name}`);
      }

      const materialCost = material.cost || 0; // Cost per unit of packaging material
      totalCost += materialCost * quantityUsed; // Add to total cost

      material.quantity -= quantityUsed;
      await material.save();

      processedPackaging.push({
        packagingId,
        quantity: quantityUsed,
      });
    }

    // Final profit calculation
    const charges = Number(platformCharges) + Number(GSTCharges) + Number(shippingCharges);
    totalProfit = totalAmount - totalCost - charges;

    // Save the order
    const newOrder = new EcommerceOrder({
      orderNumber,
      platform,
      platformCharges: Number(platformCharges),
      GSTCharges: Number(GSTCharges),
      shippingCharges: Number(shippingCharges),
      products: processedProducts,
      packagingMaterials: processedPackaging,
      totalAmount: totalAmount.toFixed(2),
      profit: totalProfit.toFixed(2),
    });

    await newOrder.save();
    console.log('✅ E-commerce order saved successfully!');
    res.redirect('/ecommerce/view');
  } catch (err) {
    console.error('❌ Error saving order:', err.message);
    res.status(500).send(`Error: ${err.message}`);
  }
});

// GET: Edit E-commerce Order Page
router.get('/edit/:id', async (req, res) => {
  try {
    const order = await EcommerceOrder.findById(req.params.id)
      .populate('products.productId')
      .populate('packagingMaterials.packagingId');
    const items = await Item.find();
    const packagingMaterials = await PackagingMaterial.find();

    res.render('ecommerce/editOrder', { order, items, packagingMaterials });
  } catch (err) {
    console.error('❌ Error loading edit page:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/edit/:id', async (req, res) => {
  try {
    const {
      platform,
      platformCharges,
      GSTCharges,
      shippingCharges,
      products,
      packagingMaterials,
    } = req.body;

    let totalAmount = 0; // Total selling price for the order
    let totalCost = 0;   // Total cost price (products + packaging materials)
    let totalProfit = 0; // Profit = Total Selling Price - Total Cost - Charges

    const updatedProducts = [];

    // Process updated products
    for (const product of products) {
      const { productId, quantity, sellingPrice } = product;

      const item = await Item.findById(productId);
      if (!item) throw new Error(`Product with ID ${productId} not found.`);

      const quantitySold = Number(quantity) || 0;
      const totalSellingPrice = Number(sellingPrice) || 0; // Total price for all quantities
      if (quantitySold <= 0 || totalSellingPrice <= 0) {
        throw new Error(`Invalid selling price or quantity for product: ${item.name}`);
      }

      const unitSellingPrice = totalSellingPrice / quantitySold; // Per unit price
      const productCostPrice = Number(item.costPrice) || 0;

      totalAmount += totalSellingPrice; // Add to total selling price
      totalCost += productCostPrice * quantitySold; // Add to total cost

      updatedProducts.push({
        productId,
        quantity: quantitySold,
        sellingPrice: totalSellingPrice, // Total price for all quantities
      });
    }

    // Process updated packaging materials
    const updatedPackaging = [];
    for (const packaging of packagingMaterials) {
      const { packagingId, quantity } = packaging;

      const material = await PackagingMaterial.findById(packagingId);
      if (!material) throw new Error(`Packaging material with ID ${packagingId} not found.`);

      const quantityUsed = Number(quantity) || 0;
      if (quantityUsed <= 0) {
        throw new Error(`Invalid quantity for packaging material: ${material.name}`);
      }

      const materialCost = material.cost || 0; // Cost per unit of packaging material
      totalCost += materialCost * quantityUsed; // Add to total cost

      updatedPackaging.push({
        packagingId,
        quantity: quantityUsed,
      });
    }

    // Final profit calculation
    const charges = Number(platformCharges) + Number(GSTCharges) + Number(shippingCharges);
    totalProfit = totalAmount - totalCost - charges;

    // Update the order
    await EcommerceOrder.findByIdAndUpdate(req.params.id, {
      platform,
      platformCharges: Number(platformCharges),
      GSTCharges: Number(GSTCharges),
      shippingCharges: Number(shippingCharges),
      products: updatedProducts,
      packagingMaterials: updatedPackaging,
      totalAmount: totalAmount.toFixed(2),
      profit: totalProfit.toFixed(2),
    });

    console.log('✅ E-commerce order updated successfully!');
    res.redirect('/ecommerce/view');
  } catch (err) {
    console.error('❌ Error updating e-commerce order:', err.message);
    res.status(500).send(`Error: ${err.message}`);
  }
});

// POST: Delete E-commerce Order
router.post('/delete/:id', async (req, res) => {
  try {
    await EcommerceOrder.findByIdAndDelete(req.params.id);
    res.redirect('/ecommerce/view');
  } catch (err) {
    console.error('❌ Error deleting order:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;

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

// POST: Save E-commerce Order
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

    let totalAmount = 0;
    let totalProfit = 0;

    // Process products and deduct stock
    const processedProducts = [];
    for (const product of products) {
      const { productId, quantity, sellingPrice } = product;

      const item = await Item.findById(productId);
      if (!item) throw new Error(`Product with ID ${productId} not found.`);

      const quantitySold = Number(quantity);
      const sellingPriceValue = Number(sellingPrice);
      const costPrice = item.costPrice || 0;

      if (item.quantity < quantitySold) {
        throw new Error(`Insufficient stock for product: ${item.name}`);
      }

      item.quantity -= quantitySold;
      await item.save();

      // Total amount and profit
      totalAmount += sellingPriceValue * quantitySold;
      totalProfit += (sellingPriceValue - costPrice) * quantitySold;

      processedProducts.push({
        productId,
        quantity: quantitySold,
        sellingPrice: sellingPriceValue,
      });
    }

    // Process packaging materials and deduct stock
    const processedPackaging = [];
    for (const packaging of packagingMaterials) {
      const { packagingId, quantity } = packaging;

      const material = await PackagingMaterial.findById(packagingId);
      if (!material) throw new Error(`Packaging material with ID ${packagingId} not found.`);

      const quantityUsed = Number(quantity);
      if (material.quantity < quantityUsed) {
        throw new Error(`Insufficient stock for packaging material: ${material.name}`);
      }

      material.quantity -= quantityUsed;
      await material.save();

      processedPackaging.push({
        packagingId,
        quantity: quantityUsed,
      });
    }

    // Subtract platform, GST, and shipping charges from profit
    const charges = Number(platformCharges) + Number(GSTCharges) + Number(shippingCharges);
    totalProfit -= charges;

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

// POST: Update E-commerce Order
// POST: Update E-commerce Order
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

    let totalAmount = 0;
    let totalCost = 0; // To calculate profit
    const updatedProducts = [];

    // Process updated products
    for (const product of products) {
      const { productId, quantity, sellingPrice } = product;

      // Fetch item details for cost price
      const item = await Item.findById(productId);
      if (!item) throw new Error(`Product with ID ${productId} not found.`);

      const quantitySold = Number(quantity) || 0;
      const productSellingPrice = Number(sellingPrice) || 0;
      const productCostPrice = Number(item.costPrice) || 0;

      totalAmount += productSellingPrice * quantitySold; // Total Selling Price
      totalCost += productCostPrice * quantitySold; // Total Cost Price

      updatedProducts.push({
        productId,
        quantity: quantitySold,
        sellingPrice: productSellingPrice,
      });
    }

    // Calculate charges
    const platformChargesNum = Number(platformCharges) || 0;
    const GSTChargesNum = Number(GSTCharges) || 0;
    const shippingChargesNum = Number(shippingCharges) || 0;

    // Calculate profit
    const profit = totalAmount - totalCost - platformChargesNum - GSTChargesNum - shippingChargesNum;

    // Update the order
    await EcommerceOrder.findByIdAndUpdate(req.params.id, {
      platform,
      platformCharges: platformChargesNum,
      GSTCharges: GSTChargesNum,
      shippingCharges: shippingChargesNum,
      products: updatedProducts,
      packagingMaterials,
      totalAmount: totalAmount.toFixed(2),
      profit: profit.toFixed(2),
    });

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

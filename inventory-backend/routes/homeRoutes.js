const express = require('express');
const router = express.Router();
const Invoice = require('../models/invoice');
const Item = require('../models/item'); // Ensure Item model is imported for fetching cost price

router.get('/', async (req, res) => {
  try {
    const invoices = await Invoice.find();

    let totalRevenue = 0;
    let totalProfit = 0;
    let totalExpenses = 0;

    const monthlyData = {};

    for (const invoice of invoices) {
      const packagingCost = invoice.packagingCost || 0;
      const shippingCharges = invoice.shippingCharges || 0;
      const miscCharges = 20; // Example misc charges per invoice
      const invoiceExpenses = packagingCost + shippingCharges + miscCharges;

      totalExpenses += invoiceExpenses;
      totalRevenue += invoice.totalAmount;

      let invoiceProfit = 0;

      // Calculate profit for each item
      for (const item of invoice.items) {
        const dbItem = await Item.findById(item.itemId); // Fetch cost price from Item model
        const costPrice = dbItem ? dbItem.costPrice || 0 : 0; // Default costPrice to 0 if not found

        const sellingPrice = item.price; // Selling price per item
        const quantity = item.quantity;

        // Item Profit = (Selling Price - Cost Price) * Quantity
        invoiceProfit += (sellingPrice - costPrice) * quantity;
      }

      // Deduct invoice-specific expenses from profit
      invoiceProfit -= invoiceExpenses;
      totalProfit += invoiceProfit;

      // Aggregate data for monthly graphs
      const month = new Date(invoice.date).toLocaleString('default', { month: 'short' });
      if (!monthlyData[month]) monthlyData[month] = { revenue: 0, profit: 0 };

      monthlyData[month].revenue += invoice.totalAmount;
      monthlyData[month].profit += invoiceProfit;
    }

    // Prepare data for charts
    const monthlyLabels = Object.keys(monthlyData);
    const monthlyRevenue = monthlyLabels.map((month) => monthlyData[month].revenue.toFixed(2));
    const monthlyProfit = monthlyLabels.map((month) => monthlyData[month].profit.toFixed(2));

    res.render('home', {
      totalRevenue: totalRevenue.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      monthlyLabels,
      monthlyRevenue,
      monthlyProfit
    });
  } catch (err) {
    console.error('Error loading home page:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;

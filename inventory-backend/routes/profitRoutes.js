const express = require('express');
const router = express.Router();
const Invoice = require('../models/invoice');
const Item = require('../models/item'); // Import Item model for fetching cost price

// Route: Profit Dashboard Page
router.get('/profit', async (req, res) => {
  try {
    const invoices = await Invoice.find();

    let totalRevenue = 0;
    let totalProfit = 0;
    let totalPackagingCost = 0;
    let totalShippingCharges = 0;
    let totalMiscCharges = 0;
    let totalCostPrice = 0; // Cost Price of all items sold

    const monthlyData = {};
    const productSales = {};

    // Process each invoice
    for (const invoice of invoices) {
      const miscCharges = 20; // Fixed miscellaneous charges
      const shippingCharges = invoice.shippingCharges || 0;
      const packagingCost = invoice.packagingCost || 0;

      let invoiceProfit = 0;

      for (const item of invoice.items) {
        const dbItem = await Item.findById(item.itemId);
        const costPrice = dbItem ? dbItem.costPrice || 0 : 0;
        const sellingPrice = item.price;
        const quantity = item.quantity;

        totalCostPrice += costPrice * quantity;
        invoiceProfit += (sellingPrice - costPrice) * quantity;

        // Track top-selling products
        if (!productSales[item.name]) productSales[item.name] = 0;
        productSales[item.name] += quantity;
      }

      invoiceProfit -= miscCharges + shippingCharges + packagingCost;

      totalRevenue += invoice.totalAmount;
      totalProfit += invoiceProfit;
      totalPackagingCost += packagingCost;
      totalShippingCharges += shippingCharges;
      totalMiscCharges += miscCharges;

      const month = new Date(invoice.date).toLocaleString('default', { month: 'short' });
      if (!monthlyData[month]) monthlyData[month] = { revenue: 0, profit: 0 };
      monthlyData[month].revenue += invoice.totalAmount;
      monthlyData[month].profit += invoiceProfit;
    }

    const monthlyLabels = Object.keys(monthlyData);
    const monthlyRevenue = monthlyLabels.map((month) => monthlyData[month].revenue.toFixed(2));
    const monthlyProfit = monthlyLabels.map((month) => monthlyData[month].profit.toFixed(2));

    // Top 10 products
    const topProducts = Object.entries(productSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    res.render('inventory/profit', {
      totalRevenue: totalRevenue.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
      totalCostPrice: totalCostPrice.toFixed(2),
      totalExpenses: (totalPackagingCost + totalShippingCharges + totalMiscCharges + totalCostPrice).toFixed(2),
      totalPackagingCost: totalPackagingCost.toFixed(2),
      totalShippingCharges: totalShippingCharges.toFixed(2),
      totalMiscCharges: totalMiscCharges.toFixed(2),
      monthlyLabels,
      monthlyRevenue,
      monthlyProfit,
      topProducts,
    });
  } catch (err) {
    console.error('Error generating profit page:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;

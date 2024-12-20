const express = require('express');
const router = express.Router();
const Invoice = require('../models/invoice');
const EcommerceOrder = require('../models/e-commerce');
const Item = require('../models/item');
const excelJS = require('exceljs');

// Helper function to filter data by date range
const filterByDateRange = (data, dateRange) => {
  const now = new Date();
  return data.filter((entry) => {
    const entryDate = new Date(entry.date);
    switch (dateRange) {
      case 'today':
        return entryDate.toDateString() === now.toDateString();
      case 'week':
        const weekStart = new Date();
        weekStart.setDate(now.getDate() - now.getDay());
        return entryDate >= weekStart && entryDate <= now;
      case 'month':
        return entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear();
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        return entryDate >= quarterStart && entryDate <= now;
      case 'year':
        return entryDate.getFullYear() === now.getFullYear();
      default:
        return true; // No filtering for 'lifetime'
    }
  });
};

router.get('/profit', async (req, res) => {
  try {
    const { dateRange = 'lifetime' } = req.query;

    const invoices = filterByDateRange(await Invoice.find(), dateRange);
    const ecommerceOrders = filterByDateRange(await EcommerceOrder.find().populate('products.productId'), dateRange);

    let totalRevenue = 0,
      totalProfit = 0,
      totalCostPrice = 0;
    let totalPackagingCost = 0,
      totalShippingCharges = 0,
      totalMiscCharges = 0;

    let ecommerceTotalRevenue = 0,
      ecommerceTotalProfit = 0,
      ecommerceTotalCostPrice = 0;
    let ecommerceTotalGST = 0,
      ecommerceTotalPlatformCharges = 0,
      ecommerceTotalShippingCharges = 0,
      ecommerceTotalPackagingCharges = 0;

    const monthlyData = {},
      ecommerceMonthlyData = {};
    const productSales = {},
      ecommerceProductSales = {};

    // General Sales Calculation
    for (const invoice of invoices) {
      const miscCharges = 20;
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

    // E-commerce Sales Calculation
    for (const order of ecommerceOrders) {
      let orderProfit = 0;
      let orderCostPrice = 0;

      for (const product of order.products) {
        const costPrice = product.productId.costPrice || 0;
        const sellingPrice = product.sellingPrice || 0;
        const quantity = product.quantity;

        orderCostPrice += costPrice * quantity;
        orderProfit += (sellingPrice - costPrice) * quantity;

        if (!ecommerceProductSales[product.productId.name]) ecommerceProductSales[product.productId.name] = 0;
        ecommerceProductSales[product.productId.name] += quantity;
      }

      ecommerceTotalRevenue += order.totalAmount;
      ecommerceTotalGST += order.GSTCharges || 0;
      ecommerceTotalPlatformCharges += order.platformCharges || 0;
      ecommerceTotalShippingCharges += order.shippingCharges || 0;
      ecommerceTotalPackagingCharges += order.packagingCharges || 0;

      // Subtract all applicable fees to calculate profit
      orderProfit -= order.GSTCharges || 0;
      orderProfit -= order.platformCharges || 0;
      orderProfit -= order.shippingCharges || 0;
      orderProfit -= order.packagingCharges || 0;

      ecommerceTotalProfit += orderProfit;
      ecommerceTotalCostPrice += orderCostPrice;

      const month = new Date(order.date).toLocaleString('default', { month: 'short' });
      if (!ecommerceMonthlyData[month]) ecommerceMonthlyData[month] = { revenue: 0, profit: 0 };
      ecommerceMonthlyData[month].revenue += order.totalAmount;
      ecommerceMonthlyData[month].profit += orderProfit;
    }

    // Preparing data for charts
    const monthlyLabels = Object.keys(monthlyData);
    const monthlyRevenue = monthlyLabels.map((month) => monthlyData[month].revenue);
    const monthlyProfit = monthlyLabels.map((month) => monthlyData[month].profit);

    const ecommerceMonthlyLabels = Object.keys(ecommerceMonthlyData);
    const ecommerceMonthlyRevenue = ecommerceMonthlyLabels.map((month) => ecommerceMonthlyData[month].revenue);
    const ecommerceMonthlyProfit = ecommerceMonthlyLabels.map((month) => ecommerceMonthlyData[month].profit);

    // Top 10 Products
    const topProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topEcommerceProducts = Object.entries(ecommerceProductSales).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Render the page
    res.render('inventory/profit', {
      dateRange,
      totalRevenue,
      totalProfit,
      totalCostPrice,
      totalPackagingCost,
      totalShippingCharges,
      totalMiscCharges,
      totalExpenses: totalPackagingCost + totalShippingCharges + totalMiscCharges,
      ecommerceTotalRevenue,
      ecommerceTotalProfit,
      ecommerceTotalCostPrice,
      ecommerceTotalPlatformCharges,
      ecommerceTotalGST,
      ecommerceTotalShippingCharges,
      ecommerceTotalPackagingCharges,
      ecommerceTotalExpenses: ecommerceTotalPlatformCharges + ecommerceTotalGST + ecommerceTotalShippingCharges + ecommerceTotalPackagingCharges,
      monthlyLabels,
      monthlyRevenue,
      monthlyProfit,
      topProducts,
      ecommerceMonthlyLabels,
      ecommerceMonthlyRevenue,
      ecommerceMonthlyProfit,
      topEcommerceProducts,
    });
  } catch (err) {
    console.error('Error generating profit page:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;

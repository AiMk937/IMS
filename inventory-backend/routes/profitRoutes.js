const express = require('express');
const router = express.Router();
const Invoice = require('../models/invoice');
const EcommerceOrder = require('../models/e-commerce');
const Item = require('../models/item'); // Import Item model

router.get('/profit', async (req, res) => {
  try {
    const invoices = await Invoice.find();
    const ecommerceOrders = await EcommerceOrder.find().populate('products.productId');

    let totalRevenue = 0, totalProfit = 0, totalCostPrice = 0;
    let totalPackagingCost = 0, totalShippingCharges = 0, totalMiscCharges = 0;

    let ecommerceTotalRevenue = 0, ecommerceTotalProfit = 0, ecommerceTotalCostPrice = 0;
    let ecommerceTotalGST = 0, ecommerceTotalPlatformCharges = 0, ecommerceTotalShippingCharges = 0, ecommerceTotalPackagingCharges = 0;

    const monthlyData = {}, ecommerceMonthlyData = {};
    const productSales = {}, ecommerceProductSales = {};

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
  totalRevenue: totalRevenue || 0,
  totalProfit: totalProfit || 0,
  totalCostPrice: totalCostPrice || 0,
  totalPackagingCost: totalPackagingCost || 0,
  totalShippingCharges: totalShippingCharges || 0,
  totalMiscCharges: totalMiscCharges || 0,
  totalExpenses: (totalPackagingCost + totalShippingCharges + totalMiscCharges) || 0, // General Sales Expenses

  ecommerceTotalRevenue: ecommerceTotalRevenue || 0,
  ecommerceTotalProfit: ecommerceTotalProfit || 0,
  ecommerceTotalCostPrice: ecommerceTotalCostPrice || 0,
  ecommerceTotalPlatformCharges: ecommerceTotalPlatformCharges || 0,
  ecommerceTotalGST: ecommerceTotalGST || 0,
  ecommerceTotalShippingCharges: ecommerceTotalShippingCharges || 0,
  ecommerceTotalPackagingCharges: ecommerceTotalPackagingCharges || 0,
  ecommerceTotalExpenses: (ecommerceTotalPlatformCharges + ecommerceTotalGST + ecommerceTotalShippingCharges + ecommerceTotalPackagingCharges) || 0, // E-commerce Sales Expenses

  monthlyLabels: monthlyLabels || [],
  monthlyRevenue: monthlyRevenue || [],
  monthlyProfit: monthlyProfit || [],
  topProducts: topProducts || [],
  ecommerceMonthlyLabels: ecommerceMonthlyLabels || [],
  ecommerceMonthlyRevenue: ecommerceMonthlyRevenue || [],
  ecommerceMonthlyProfit: ecommerceMonthlyProfit || [],
  topEcommerceProducts: topEcommerceProducts || [],
});

  } catch (err) {
    console.error('Error generating profit page:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;

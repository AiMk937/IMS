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
      const miscCharges = 20; // Fixed miscellaneous charges
      const shippingCharges = invoice.shippingCharges || 0; // Default shippingCharges to 0
      const packagingCost = invoice.packagingCost || 0; // Default packagingCost to 0

      let invoiceProfit = 0;

      for (const item of invoice.items) {
        const dbItem = await Item.findById(item.itemId);
        const costPrice = dbItem ? dbItem.costPrice || 0 : 0; // Cost price from database
        const sellingPrice = item.price; // Selling price in the invoice
        const quantity = item.quantity; // Quantity sold

        // Calculate item profit
        totalCostPrice += costPrice * quantity; // Accumulate total cost price
        invoiceProfit += (sellingPrice - costPrice) * quantity; // Add item profit

        // Track product sales for summary
        if (!productSales[item.name]) productSales[item.name] = 0;
        productSales[item.name] += quantity;
      }

      // Adjust profit for shipping cost based on who pays
      if (invoice.shippingPayer === 'seller') {
        invoiceProfit -= shippingCharges; // Deduct shipping charges if the seller pays
      }

      // Deduct additional fixed costs
      invoiceProfit -= miscCharges + packagingCost;

      // Update cumulative totals
      totalRevenue += invoice.totalAmount;
      totalProfit += invoiceProfit;
      totalPackagingCost += packagingCost;
      totalShippingCharges += shippingCharges;
      totalMiscCharges += miscCharges;

      // Monthly data aggregation
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


// Export General Sales Data
router.get('/export/general', async (req, res) => {
  try {
    const { type = 'lifetime', year, month, quarter, startDate, endDate } = req.query;

    const invoices = await Invoice.find();

    // Filter invoices by date range
    let filteredInvoices = invoices;
    if (type === 'month' && year && month) {
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      filteredInvoices = filterByDateRange(invoices, firstDay, lastDay);
    } else if (type === 'quarter' && year && quarter) {
      const quarters = {
        1: [new Date(year, 0, 1), new Date(year, 3, 0)],
        2: [new Date(year, 3, 1), new Date(year, 6, 0)],
        3: [new Date(year, 6, 1), new Date(year, 9, 0)],
        4: [new Date(year, 9, 1), new Date(year, 12, 0)],
      };
      filteredInvoices = filterByDateRange(invoices, ...quarters[quarter]);
    } else if (type === 'year' && year) {
      const firstDay = new Date(year, 0, 1);
      const lastDay = new Date(year, 11, 31);
      filteredInvoices = filterByDateRange(invoices, firstDay, lastDay);
    } else if (type === 'range' && startDate && endDate) {
      filteredInvoices = filterByDateRange(invoices, startDate, endDate);
    }

    const workbook = new excelJS.Workbook();
    const worksheet = workbook.addWorksheet('General Sales');

    // Define Columns
    worksheet.columns = [
      { header: 'Invoice Number', key: 'invoiceNumber', width: 15 },
      { header: 'Buyer Name', key: 'buyerName', width: 25 },
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Shipping Charges', key: 'shippingCharges', width: 20 },
      { header: 'Packaging Cost', key: 'packagingCost', width: 20 },
      { header: 'Total Quantity Sold', key: 'totalQuantity', width: 20 },
      { header: 'Number of Unique Items', key: 'uniqueItems', width: 20 },
      { header: 'Cost Price Total', key: 'totalCostPrice', width: 20 },
      { header: 'Sale Price Total', key: 'totalSalePrice', width: 20 },
      { header: 'Profit', key: 'profit', width: 15 },
    ];

    // Add Rows
    for (const invoice of filteredInvoices) {
      let totalCostPrice = 0;
      let totalSalePrice = 0;
      let totalQuantity = 0;
      let uniqueItems = invoice.items.length;

      for (const item of invoice.items) {
        const dbItem = await Item.findById(item.itemId);
        const costPrice = dbItem ? dbItem.costPrice || 0 : 0;
        const salePrice = item.price || 0;

        totalCostPrice += costPrice * item.quantity;
        totalSalePrice += salePrice * item.quantity;
        totalQuantity += item.quantity;
      }

      const profit = totalSalePrice - totalCostPrice - (invoice.shippingCharges || 0) - (invoice.packagingCost || 0);

      worksheet.addRow({
        invoiceNumber: invoice.invoiceNumber,
        buyerName: invoice.buyer.name,
        date: invoice.date.toISOString().split('T')[0],
        shippingCharges: invoice.shippingCharges || 0,
        packagingCost: invoice.packagingCost || 0,
        totalQuantity,
        uniqueItems,
        totalCostPrice,
        totalSalePrice,
        profit,
      });
    }

    // Response Headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="General_Sales_Details.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error exporting general sales:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

// Export E-commerce Sales Data
router.get('/export/ecommerce', async (req, res) => {
  try {
    const { type = 'lifetime', year, month, quarter, startDate, endDate } = req.query;

    const ecommerceOrders = await EcommerceOrder.find().populate('products.productId');

    // Filter orders by date range
    let filteredOrders = ecommerceOrders;
    if (type === 'month' && year && month) {
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      filteredOrders = filterByDateRange(ecommerceOrders, firstDay, lastDay);
    } else if (type === 'quarter' && year && quarter) {
      const quarters = {
        1: [new Date(year, 0, 1), new Date(year, 3, 0)],
        2: [new Date(year, 3, 1), new Date(year, 6, 0)],
        3: [new Date(year, 6, 1), new Date(year, 9, 0)],
        4: [new Date(year, 9, 1), new Date(year, 12, 0)],
      };
      filteredOrders = filterByDateRange(ecommerceOrders, ...quarters[quarter]);
    } else if (type === 'year' && year) {
      const firstDay = new Date(year, 0, 1);
      const lastDay = new Date(year, 11, 31);
      filteredOrders = filterByDateRange(ecommerceOrders, firstDay, lastDay);
    } else if (type === 'range' && startDate && endDate) {
      filteredOrders = filterByDateRange(ecommerceOrders, startDate, endDate);
    }

    const workbook = new excelJS.Workbook();
    const worksheet = workbook.addWorksheet('E-commerce Sales');

    // Define Columns
    worksheet.columns = [
      { header: 'Order Number', key: 'orderNumber', width: 30 },
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Shipping Charges', key: 'shippingCharges', width: 20 },
      { header: 'Packaging Charges', key: 'packagingCharges', width: 20 },
      { header: 'GST Charges', key: 'gstCharges', width: 20 },
      { header: 'Platform Charges', key: 'platformCharges', width: 20 },
      { header: 'Total Quantity Sold', key: 'totalQuantity', width: 20 },
      { header: 'Number of Unique Items', key: 'uniqueItems', width: 20 },
      { header: 'Cost Price Total', key: 'totalCostPrice', width: 20 },
      { header: 'Sale Price Total', key: 'totalSalePrice', width: 20 },
      { header: 'Profit', key: 'profit', width: 15 },
    ];

    // Add Rows
    for (const order of filteredOrders) {
      let totalCostPrice = 0;
      let totalSalePrice = 0;
      let totalQuantity = 0;
      let uniqueItems = order.products.length;

      for (const product of order.products) {
        const costPrice = product.productId.costPrice || 0;
        const salePrice = product.sellingPrice || 0;

        totalCostPrice += costPrice * product.quantity;
        totalSalePrice += salePrice * product.quantity;
        totalQuantity += product.quantity;
      }

      const profit =
        totalSalePrice -
        totalCostPrice -
        (order.GSTCharges || 0) -
        (order.platformCharges || 0) -
        (order.shippingCharges || 0) -
        (order.packagingCharges || 0);

      worksheet.addRow({
        orderNumber: order.orderNumber || 'N/A', // Updated field
        date: order.date.toISOString().split('T')[0],
        shippingCharges: order.shippingCharges || 0,
        packagingCharges: order.packagingCharges || 0,
        gstCharges: order.GSTCharges || 0,
        platformCharges: order.platformCharges || 0,
        totalQuantity,
        uniqueItems,
        totalCostPrice,
        totalSalePrice,
        profit,
      });
    }

    // Response Headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Ecommerce_Sales_Details.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error exporting e-commerce sales:', err.message);
    res.status(500).send('Internal Server Error');
  }
});


module.exports = router;
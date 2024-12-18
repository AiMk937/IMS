const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Item = require('../models/item');
const Invoice = require('../models/invoice'); // Import the Invoice model

// Route: Render invoice generation page
router.get('/', async (req, res) => {
  try {
    // Fetch all items from the database
    const items = await Item.find();

    // Convert image buffer to Base64 for display
    const itemsWithImages = items.map((item) => ({
      ...item._doc,
      imageBase64: item.image
        ? `data:${item.image.contentType};base64,${item.image.data.toString('base64')}`
        : null,
    }));

    // Add the current date for the invoice generation page
    const formattedDate = new Date().toLocaleDateString('en-GB'); // Format as DD/MM/YYYY

    // Render the invoice generation page and pass the items with base64 image and formatted date
    res.render('inventory/invoice', { items: itemsWithImages, formattedDate });
  } catch (err) {
    console.error('Error loading invoice page:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Route: Generate an invoice
router.post('/generate', async (req, res) => {
  const { invoiceData, buyerDetails, shippingCharges } = req.body;

  console.log('Received Request Body:', req.body);

  // Validate buyer details
  if (
    !buyerDetails ||
    typeof buyerDetails.name !== 'string' ||
    typeof buyerDetails.address !== 'string' ||
    typeof buyerDetails.contactNumber !== 'string'
  ) {
    return res.status(400).json({ error: 'Buyer details are incomplete or invalid.' });
  }

  // Validate invoice data
  if (!invoiceData || !Array.isArray(invoiceData) || invoiceData.length === 0) {
    return res.status(400).json({ error: 'No items provided for invoice.' });
  }

  // Validate shipping charges
  const parsedShippingCharges = parseFloat(shippingCharges) || 0;
  if (isNaN(parsedShippingCharges) || parsedShippingCharges < 0) {
    return res.status(400).json({ error: 'Invalid shipping charges.' });
  }
  console.log('Parsed Shipping Charges:', parsedShippingCharges);

  try {
    // Fetch items from the database based on itemIds
    const itemIds = invoiceData.map((data) => data.itemId);
    const items = await Item.find({ _id: { $in: itemIds } });

    if (!items || items.length === 0) {
      return res.status(404).json({ error: 'None of the requested items are available in the inventory.' });
    }

    // Prepare the invoice items and calculate total
    let totalAmount = 0;
    const invoiceItems = [];

    for (const item of items) {
      const matchingData = invoiceData.find((data) => data.itemId === item._id.toString());
      const quantity = parseInt(matchingData?.quantity, 10);

      if (!quantity || quantity <= 0) {
        throw new Error(`Invalid quantity for item ${item.name}`);
      }

      // Check if the inventory has enough quantity
      if (item.quantity < quantity) {
        throw new Error(`Not enough quantity for item ${item.name}. Available: ${item.quantity}`);
      }

      const total = quantity * item.sellingPrice;
      totalAmount += total;

      // Add to invoice items
      invoiceItems.push({
        itemId: item._id,
        name: item.name,
        description: item.description,
        quantity,
        price: item.sellingPrice,
        total,
      });

      // Update the item's quantity in the database
      try {
        item.quantity -= quantity;
        await item.save(); // Save the updated item back to the database
      } catch (err) {
        console.error(`Error updating item ${item.name}:`, err.message);
        throw new Error(`Failed to update item ${item.name}.`);
      }
    }

    // Add shipping charges to total
    totalAmount += parsedShippingCharges;

    // Fetch the last invoice number and increment
    const lastInvoice = await Invoice.findOne().sort({ _id: -1 }).select('invoiceNumber');
    const nextInvoiceNumber = lastInvoice
      ? String(parseInt(lastInvoice.invoiceNumber, 10) + 1).padStart(5, '0')
      : '00001';

    // Save the invoice to the database
    const newInvoice = new Invoice({
      invoiceNumber: nextInvoiceNumber,
      buyer: buyerDetails,
      items: invoiceItems,
      totalAmount,
      shippingCharges: parsedShippingCharges,
    });

    await newInvoice.save();

    // Format the date for the invoice
    const formattedDate = new Date(newInvoice.date).toLocaleDateString('en-GB'); // Format as DD/MM/YYYY

    // Generate HTML for the invoice
    const invoiceHtml = `
      <div style="text-align: center; margin-bottom: 20px;">
        <h2>AK GLOBAL</h2>
        <p>Flat no. 5 New Light Building, Kalina, Mumbai. 400029</p>
        <p>Contact: 7738255001 | Email: akglobal937@gmail.com</p>
      </div>
      <hr>
      <div style="margin-bottom: 20px;">
        <h4>Invoice Number: ${nextInvoiceNumber}</h4>
        <h6>Date: ${formattedDate}</h6>
        <h4>Bill To:</h4>
        <p>
          Name: ${buyerDetails.name} <br>
          Address: ${buyerDetails.address} <br>
          Contact Number: ${buyerDetails.contactNumber}
        </p>
      </div>
      <table class="table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Quantity</th>
            <th>Price</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${invoiceItems
            .map(
              (item) => `
            <tr>
              <td>${item.name}</td>
              <td>${item.description || 'N/A'}</td>
              <td>${item.quantity}</td>
              <td>₹${item.price.toFixed(2)}</td>
              <td>₹${item.total.toFixed(2)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="text-align: right;"><strong>Subtotal:</strong></td>
            <td>₹${(totalAmount - parsedShippingCharges).toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="4" style="text-align: right;"><strong>Shipping Charges:</strong></td>
            <td>₹${parsedShippingCharges.toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="4" style="text-align: right;"><strong>Total:</strong></td>
            <td>₹${totalAmount.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      <hr>
      <p>Thank you for your purchase!</p>
    `;

    // Send the generated invoice HTML as the response
    res.status(200).send(invoiceHtml);
  } catch (err) {
    console.error('Error generating invoice:', err.message);
    res.status(500).json({ error: `Failed to generate invoice: ${err.message}` });
  }
});

// Route: View all invoices
router.get('/view', async (req, res) => {
  try {
    // Fetch all invoices from the database
    const invoices = await Invoice.find().sort({ date: -1 }); // Sort by most recent

    // Calculate profit for each invoice
    const invoicesWithProfit = await Promise.all(
      invoices.map(async (invoice) => {
        const miscCharges = 20; // Fixed miscellaneous charges
        const shippingCharges = invoice.shippingCharges || 0; // Default shippingCharges to 0
        const packagingCost = invoice.packagingCost || 0; // Default packagingCost to 0

        let totalProfit = 0;

        // Calculate profit for each item in the invoice
        for (const item of invoice.items) {
          // Fetch the item from the database to get the Cost Price
          const dbItem = await Item.findById(item.itemId);

          if (dbItem) {
            const sellingPrice = item.price; // Selling price in the invoice
            const costPrice = dbItem.costPrice || 0; // Fetch cost price from database
            const quantity = item.quantity;

            const itemProfit = (sellingPrice - costPrice) * quantity; // Profit per item
            totalProfit += itemProfit;
          }
        }

        // Subtract miscellaneous charges, shipping charges, and packaging cost from total profit
        totalProfit -= miscCharges + shippingCharges + packagingCost;

        return {
          ...invoice._doc,
          formattedDate: new Date(invoice.date).toLocaleDateString('en-GB'),
          shippingCharges: shippingCharges.toFixed(2),
          packagingCost: packagingCost.toFixed(2),
          profit: totalProfit.toFixed(2), // Attach calculated profit
        };
      })
    );

    // Pass invoices with calculated profit to the template
    res.render('inventory/invoices', { invoices: invoicesWithProfit });
  } catch (err) {
    console.error('Error fetching invoices:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

// Route: View specific invoice
router.get('/view/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send('Invalid invoice ID.');
    }

    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return res.status(404).send('Invoice not found');
    }

    // Calculate Subtotal
    const subtotal = invoice.items.reduce((sum, item) => sum + item.total, 0);
    const shippingCharges = invoice.shippingCharges || 0; // Default to 0 if not defined
    const totalAmount = subtotal + shippingCharges;

    const formattedDate = new Date(invoice.date).toLocaleDateString('en-GB');

    res.render('inventory/invoiceDetails', {
      invoice,
      formattedDate,
      subtotal: subtotal.toFixed(2),
      shippingCharges: shippingCharges.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
    });
  } catch (err) {
    console.error('Error fetching invoice:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;

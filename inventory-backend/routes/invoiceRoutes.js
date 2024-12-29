const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Item = require('../models/item');
const Invoice = require('../models/invoice'); // Import the Invoice model
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Route: Render invoice generation page
router.get('/', async (req, res) => {
  try {
    const items = await Item.find();
    const itemsWithImages = items.map((item) => ({
      ...item._doc,
      imageBase64: item.image
        ? `data:${item.image.contentType};base64,${item.image.data.toString('base64')}`
        : null,
    }));

    const formattedDate = new Date().toLocaleDateString('en-GB');
    res.render('inventory/invoice', { items: itemsWithImages, formattedDate });
  } catch (err) {
    console.error('Error loading invoice page:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Route: Generate an invoice
router.post('/generate', async (req, res) => {
  const { invoiceData, buyerDetails, shippingCharges, shippingPayer } = req.body;

  // Validate buyer details and invoice data
  if (!buyerDetails || !Array.isArray(invoiceData) || invoiceData.length === 0) {
    return res.status(400).json({ error: 'Invalid invoice data or buyer details.' });
  }

  try {
    // Fetch items from the database
    const itemIds = invoiceData.map((item) => item.itemId);
    const items = await Item.find({ _id: { $in: itemIds } });

    let subtotal = 0;
    const invoiceItems = [];

    for (const item of items) {
      const invoiceItem = invoiceData.find((i) => i.itemId === item._id.toString());
      if (!invoiceItem) continue;

      const quantity = parseInt(invoiceItem.quantity, 10);

      // Check if there's sufficient stock
      if (quantity > item.quantity) {
        return res
          .status(400)
          .json({ error: `Insufficient stock for ${item.name}. Available: ${item.quantity}` });
      }

      const total = quantity * item.sellingPrice;
      subtotal += total;

      invoiceItems.push({
        itemId: item._id,
        name: item.name,
        description: item.description,
        quantity,
        price: item.sellingPrice,
        total,
      });

      // Deduct stock
      item.quantity -= quantity;
      await item.save();
    }

    // Determine shipping charges based on the payer
    let adjustedShippingCharges = parseFloat(shippingCharges) || 0;
    let totalAmount = subtotal;

    if (shippingPayer === 'customer') {
      totalAmount += adjustedShippingCharges; // Add shipping charges to total if customer pays
    } else if (shippingPayer === 'seller') {
      adjustedShippingCharges = 0; // Set shipping charges to 0 if seller pays
    }

    // Fetch the last invoice number
    const lastInvoice = await Invoice.findOne().sort({ _id: -1 }).select('invoiceNumber');
    const nextInvoiceNumber = lastInvoice
      ? String(parseInt(lastInvoice.invoiceNumber.match(/\d+/)[0], 10) + 1).padStart(5, '0')
      : '00001';

    // Save the invoice to the database
    const newInvoice = new Invoice({
      invoiceNumber: `INV-${nextInvoiceNumber}`,
      buyer: buyerDetails,
      items: invoiceItems,
      totalAmount,
      shippingCharges: adjustedShippingCharges,
      shippingPayer,
    });

    await newInvoice.save();

    // Send invoice as HTML response
    res.status(200).send(`
      <div style="text-align: center; margin-bottom: 20px;">
        <h2>AK GLOBAL</h2>
        <p>Flat no. 5 New Light Building, Kalina, Mumbai. 400029</p>
        <p>Contact: 7738255001 | Email: akglobal937@gmail.com</p>
      </div>
      <hr>
      <h4>Invoice Number: ${newInvoice.invoiceNumber}</h4>
      <p>Date: ${new Date().toLocaleDateString('en-GB')}</p>
      <h4>Bill To:</h4>
      <p>
        Name: ${buyerDetails.name}<br>
        Address: ${buyerDetails.address}<br>
        Contact: ${buyerDetails.contactNumber}
      </p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr>
            <th>Name</th>
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
              <td>${item.quantity}</td>
              <td>₹${item.price.toFixed(2)}</td>
              <td>₹${item.total.toFixed(2)}</td>
            </tr>`
        )
        .join('')}
        </tbody>
      </table>
      <div style="text-align: right;">
        <p><strong>Subtotal:</strong> ₹${subtotal.toFixed(2)}</p>
        <p><strong>Shipping Charges:</strong> ${shippingPayer === 'seller' ? '<span style="text-decoration: line-through;">₹' + shippingCharges + '</span> Free Shipping' : `₹${adjustedShippingCharges.toFixed(2)}`
      }</p>
        <h4><strong>Total:</strong> ₹${totalAmount.toFixed(2)}</h4>
      </div>
      <hr>
      <div style="text-align: center; margin-top: 20px;">
        <p>Thank you for your purchase!</p>
        <p>If you have any questions, contact us at akglobal937@gmail.com</p>
        <p><b>Customer Self Declaration:</b> The goods sold are intended for personal use and not for resale.</p>
      </div>
    `);
  } catch (err) {
    console.error('Error generating invoice:', err.message);
    res.status(500).json({ error: 'Failed to generate invoice.' });
  }
});

// Route: View all invoices
router.get('/view', async (req, res) => {
  try {
    const { search = '', date = '', page = 1 } = req.query; // Get query parameters
    const perPage = 10; // Define items per page

    // Build filter object
    let filter = {};
    if (search) {
      filter['buyer.name'] = { $regex: search, $options: 'i' }; // Case-insensitive search
    }
    if (date) {
      const dateStart = new Date(date);
      const dateEnd = new Date(date);
      dateEnd.setDate(dateEnd.getDate() + 1); // Include the full day
      filter.date = { $gte: dateStart, $lt: dateEnd };
    }

    // Fetch filtered and paginated invoices
    const invoices = await Invoice.find(filter)
      .sort({ date: -1 }) // Sort by most recent
      .skip((page - 1) * perPage) // Pagination offset
      .limit(perPage); // Pagination limit

    const totalCount = await Invoice.countDocuments(filter); // Total number of filtered invoices
    const totalPages = Math.ceil(totalCount / perPage);

    // Calculate profit for each invoice
    const invoicesWithProfit = await Promise.all(
      invoices.map(async (invoice) => {
        const miscCharges = 20; // Fixed miscellaneous charges
        const packagingCost = invoice.packagingCost || 0; // Default packagingCost to 0
        const shippingCharges = invoice.shippingCharges || 0; // Default shippingCharges to 0
        let totalProfit = 0;

        // Calculate profit for each item in the invoice
        for (const item of invoice.items) {
          const dbItem = await Item.findById(item.itemId);
          if (dbItem) {
            const sellingPrice = item.price; // Selling price in the invoice
            const costPrice = dbItem.costPrice || 0; // Cost price from database
            const quantity = item.quantity;

            // Calculate item profit
            const itemProfit = (sellingPrice - costPrice) * quantity;
            totalProfit += itemProfit;
          }
        }

        // Deduct shipping charges if the seller is paying
        if (invoice.shippingPayer === 'seller') {
          totalProfit -= shippingCharges; // Deduct shipping charges if the seller pays
        }

        // Deduct miscellaneous and packaging costs
        totalProfit -= miscCharges + packagingCost;

        // Return invoice with formatted data
        return {
          ...invoice._doc,
          formattedDate: new Date(invoice.date).toLocaleDateString('en-GB'),
          profit: totalProfit.toFixed(2), // Attach calculated profit
        };
      })
    );

    // Render the view with calculated invoices
    res.render('inventory/invoices', {
      invoices: invoicesWithProfit,
      search,
      date,
      currentPage: Number(page),
      totalPages,
    });
  } catch (err) {
    console.error('Error fetching invoices:', err.message);
    res.status(500).send('Internal Server Error');
  }
});


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
    const shippingCharges = invoice.shippingPayer === 'seller' ? 'Free Shipping' : `₹${invoice.shippingCharges.toFixed(2)}`;
    const totalAmount = invoice.shippingPayer === 'customer'
      ? subtotal + invoice.shippingCharges
      : subtotal;

    const formattedDate = new Date(invoice.date).toLocaleDateString('en-GB');

    res.render('inventory/invoiceDetails', {
      invoice,
      formattedDate,
      subtotal: subtotal.toFixed(2),
      shippingCharges,
      totalAmount: totalAmount.toFixed(2),
    });
  } catch (err) {
    console.error('Error fetching invoice:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

// Route: Edit an invoice
router.get('/edit/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send('Invalid invoice ID.');
    }

    const invoice = await Invoice.findById(id).populate('items.itemId');

    if (!invoice) {
      return res.status(404).send('Invoice not found');
    }

    const items = await Item.find(); // Fetch all items for dropdown in edit form

    res.render('inventory/editInvoice', { invoice, items });
  } catch (err) {
    console.error('Error fetching invoice for edit:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/edit/:id', async (req, res) => {
  const { id } = req.params;
  const { buyerDetails, invoiceData, shippingCharges, shippingPayer } = req.body;

  try {
    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return res.status(404).send('Invoice not found');
    }

    // Revert stock for old invoice items
    for (const item of invoice.items) {
      await Item.findByIdAndUpdate(item.itemId, {
        $inc: { quantity: item.quantity },
      });
    }

    // Prepare new invoice items and update stock
    let totalAmount = 0;
    const updatedItems = [];

    for (const data of invoiceData) {
      const item = await Item.findById(data.itemId);

      if (!item || item.quantity < data.quantity) {
        throw new Error(`Not enough stock for item ${item.name}`);
      }

      item.quantity -= data.quantity;
      await item.save();

      const total = item.sellingPrice * data.quantity;
      totalAmount += total;

      updatedItems.push({
        itemId: item._id,
        name: item.name,
        quantity: data.quantity,
        price: item.sellingPrice,
        total,
      });
    }

    totalAmount += parseFloat(shippingCharges);

    // Update invoice details
    invoice.buyer = buyerDetails;
    invoice.items = updatedItems;
    invoice.shippingCharges = parseFloat(shippingCharges);
    invoice.shippingPayer = shippingPayer; // Save shipping payer
    invoice.totalAmount = totalAmount;

    await invoice.save();

    res.redirect('/invoice/view');
  } catch (err) {
    console.error('Error editing invoice:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

// Route: Delete an invoice
router.get('/delete/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return res.status(404).send('Invoice not found');
    }

    // Revert stock for deleted invoice items
    for (const item of invoice.items) {
      await Item.findByIdAndUpdate(item.itemId, {
        $inc: { quantity: item.quantity },
      });
    }

    await Invoice.findByIdAndDelete(id);

    res.redirect('/invoice/view');
  } catch (err) {
    console.error('Error deleting invoice:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/download-label/:id', async (req, res) => {
  try {
    const invoiceId = req.params.id;

    // Fetch the invoice details from the database
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).send('Invoice not found.');
    }

    const buyer = {
      name: invoice.buyer.name.toUpperCase(),
      address: invoice.buyer.address,
      contactNumber: invoice.buyer.contactNumber,
    };

    // Create a descriptive filename
    const fileName = `Invoice-${invoice.invoiceNumber}_${buyer.name}.pdf`;

    // Create a PDF document
    const doc = new PDFDocument({
      size: 'A4', // Page size A4
      margins: { top: 100, left: 50, right: 50, bottom: 50 }, // Adjusted margins for alignment
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Pipe the PDF to the response
    doc.pipe(res);

    // Adjust vertical positioning for centering
    const pageHeight = doc.page.height;
    const contentStartY = (pageHeight - 300) / 2; // Dynamically calculated to center content vertically

    // Add "SPEED POST" title
    doc
      .fontSize(34)
      .font('Helvetica-Bold')
      .text('SPEED POST', { align: 'center' })
      .moveDown(1.5);

    // Add "To" Section
    doc
      .fontSize(32) // Font size for headings
      .font('Helvetica-Bold')
      .text('TO:', 125, ) // Left-aligned at x = 50
      .moveDown(0.5);

    doc
      .fontSize(30) // Font size for buyer details
      .font('Helvetica')
      .text(`${buyer.name}`, 150) // Left-aligned at x = 50
      .text(`${buyer.address}`, 150)
      .text(`Phone: ${buyer.contactNumber}`, 150)
      .moveDown(2);

    // Add "From" Section
    doc
      .fontSize(28)
      .font('Helvetica-Bold')
      .text('From:', 50) // Left-aligned at x = 50
      .moveDown(0.5);

    doc
      .fontSize(24) // Smaller font size for sender details
      .font('Helvetica')
      .text('Aisha Khan', 50)
      .text('Flat No. 5 New Light Building, Church Road, Kalina, Santacruz East,', 50)
      .text('Mumbai, Maharashtra, 400029', 50)
      .text('Phone: +91-7738255001', 50);

    // Finalize the document
    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while generating the shipping label.');
  }
});

module.exports = router;

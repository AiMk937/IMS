const express = require('express');
const router = express.Router();
const Item = require('../models/item');

router.post('/invoice/generate', async (req, res) => {
  const { invoiceData } = req.body;

  if (!invoiceData || invoiceData.length === 0) {
    return res.status(400).send('No items provided for invoice.');
  }

  try {
    // Log invoiceData to verify its structure
    console.log('Invoice Data:', invoiceData);

    // Find the items in the database based on itemIds in the invoiceData
    const items = await Item.find({ _id: { $in: invoiceData.map(data => data.itemId) } });

    // Log the retrieved items
    console.log('Items found:', items);

    if (items.length === 0) {
      return res.status(404).send('No items found in the inventory for the given IDs.');
    }

    let total = 0;
    const invoiceItems = items.map(item => {
      const quantity = invoiceData.find(data => data.itemId === item._id.toString()).quantity;
      const subtotal = quantity * item.sellingPrice;
      total += subtotal;

      return { ...item._doc, quantity, subtotal };
    });

    const invoiceHtml = `
      <table class="table">
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
              item => `
            <tr>
              <td>${item.name}</td>
              <td>${item.description}</td>
              <td>${item.quantity}</td>
              <td>₹${item.sellingPrice.toFixed(2)}</td>
              <td>₹${item.subtotal.toFixed(2)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" class="text-end">Total:</td>
            <td>₹${total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    `;

    res.send(invoiceHtml);
  } catch (err) {
    console.error('Error generating invoice:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const PackagingMaterial = require('../models/PackagingMaterial'); // Import the PackagingMaterial model
const Invoice = require('../models/invoice'); // Corrected import path for Invoice model


// Route: Show packaging materials
router.get('/', async (req, res) => {
  try {
    const materials = await PackagingMaterial.find(); // Fetch all packaging materials
    res.render('inventory/packaging', { materials }); // Render the packaging materials page
  } catch (err) {
    console.error('Error fetching packaging materials:', err);
    res.status(500).send('Internal Server Error');
  }
});


// Route: Show the form to add a new packaging material
router.get('/add-packaging', (req, res) => {
  res.render('inventory/addPackagingMaterial'); // Render the 'addPackagingMaterial' page
});

router.post('/add-packaging', async (req, res) => {
  const { name, category, cost, description, quantity, reorderLevel, dimensions } = req.body;
  console.log('Form Data Received:', req.body);
  try {
    // Check if the required fields are provided
    if (!name || !category || !cost || !quantity || !reorderLevel) {
      return res.status(400).send('All fields are required.');
    }

    // Ensure that fields like cost, quantity, and reorderLevel are valid numbers
    const parsedCost = parseFloat(cost);
    const parsedQuantity = parseInt(quantity, 10);
    const parsedReorderLevel = parseInt(reorderLevel, 10);

    if (isNaN(parsedCost) || isNaN(parsedQuantity) || isNaN(parsedReorderLevel)) {
      return res.status(400).send('Please provide valid numeric values for cost, quantity, and reorder level.');
    }

    // Process dimensions only if the category is shipping box
    let parsedDimensions = {};
    if (category === 'shipping box') {
      parsedDimensions = {
        length: parseFloat(dimensions?.length || '0'),
        width: parseFloat(dimensions?.width || '0'),
        height: parseFloat(dimensions?.height || '0')
      };
      if (isNaN(parsedDimensions.length) || isNaN(parsedDimensions.width) || isNaN(parsedDimensions.height)) {
        return res.status(400).send('Please provide valid dimensions for shipping box.');
      }
    }

    const newPackagingMaterial = new PackagingMaterial({
      name,
      category,
      cost: parsedCost,
      description,
      quantity: parsedQuantity,
      reorderLevel: parsedReorderLevel,
      dimensions: parsedDimensions // Include dimensions if it's a shipping box
    });

    await newPackagingMaterial.save(); // Save the new packaging material to the database
    console.log(`New packaging material added: ${newPackagingMaterial.name}`);
    res.redirect('/packaging'); // Redirect to the packaging list page
  } catch (err) {
    console.error('Error adding new packaging material:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Route: Show the list of all packaging materials
router.get('/', async (req, res) => {
  try {
    const packagingMaterials = await PackagingMaterial.find(); // Fetch all packaging materials
    res.render('inventory/listPackagingMaterial', { packagingMaterials }); // Render the list view
  } catch (err) {
    console.error('Error fetching packaging materials:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Route: Show the form to add packaging to an invoice
router.get('/add-packaging-to-invoice', async (req, res) => {
  try {
    // Fetch all invoices and packaging materials
    const invoices = await Invoice.find();
    const packagingMaterials = await PackagingMaterial.find();

    res.render('inventory/addPackaging', { invoices, packagingMaterials }); // Render the 'addPackaging' page
  } catch (err) {
    console.error('Error fetching invoices or packaging materials:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Route: Submit packaging details for an invoice
router.post('/add-packaging-to-invoice', async (req, res) => {
  const { invoiceId, packagingMaterials } = req.body;

  try {
    // Fetch the selected invoice
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).send('Invoice not found');
    }

    // Update the invoice with selected packaging materials and their quantities
    const packagingDetails = [];
    let totalPackagingCost = 0;

    for (let materialId in packagingMaterials) {
      const quantityUsed = parseInt(packagingMaterials[materialId].quantityUsed);
      const material = await PackagingMaterial.findById(materialId);
      if (material && quantityUsed > 0) {
        const cost = material.cost * quantityUsed;
        totalPackagingCost += cost;
        packagingDetails.push({
          materialId: material._id,
          name: material.name,
          quantityUsed,
          cost
        });
      }
    }

    // Add the packaging details and cost to the invoice (without adding to the total invoice cost)
    invoice.packagingDetails = packagingDetails;
    invoice.packagingCost = totalPackagingCost;

    await invoice.save(); // Save the updated invoice
    console.log(`Packaging details added to invoice ${invoice._id}`);
    res.redirect('/invoices'); // Redirect to the invoices page
  } catch (err) {
    console.error('Error adding packaging to invoice:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;

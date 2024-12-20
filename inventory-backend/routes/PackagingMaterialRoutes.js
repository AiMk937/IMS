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
  console.log('Raw request body:', req.body); // Log the request body
  console.log('Received data:', req.body); // Log the request body
  const { name, category, cost, quantity, reorderLevel, dimensions } = req.body;
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
    // Fetch all invoices with attached packaging details
    const invoices = await Invoice.find({ packagingDetails: { $exists: true, $not: { $size: 0 } } });

    const consolidatedData = invoices.map(invoice => {
      let totalCost = 0;
      let shippingPackagingCount = 0;
      let internalPackagingCount = 0;

      invoice.packagingDetails.forEach(detail => {
        totalCost += detail.cost;

        // Categorize packaging based on category
        if (detail.category === 'shipping box' || detail.category === 'shipping bag') {
          shippingPackagingCount += detail.quantityUsed;
        } else if (detail.category === 'box' || detail.category === 'plastic') {
          internalPackagingCount += detail.quantityUsed;
        }
      });

      return {
        invoiceNumber: invoice.invoiceNumber,
        buyerName: invoice.buyer?.name || 'N/A',
        totalCost: totalCost.toFixed(2),
        shippingPackagingCount,
        internalPackagingCount,
        id: invoice._id,
      };
    });

    const packagingMaterials = await PackagingMaterial.find(); // Fetch all packaging materials

    res.render('inventory/addPackaging', {
      invoices,
      consolidatedData,
      packagingMaterials,
    });
  } catch (err) {
    console.error('Error fetching invoices or packaging materials:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Show edit form for a packaging material
router.get('/edit/:id', async (req, res) => {
  try {
    const material = await PackagingMaterial.findById(req.params.id);
    if (!material) {
      return res.status(404).send('Packaging Material not found');
    }
    res.render('inventory/editPackagingMaterial', { material });
  } catch (err) {
    console.error('Error fetching material for editing:', err);
    res.status(500).send('Internal Server Error');
  }
});

// POST REQUEST FOR EDIT FORM FOR A PACKAGING MATERIAL
router.post('/edit/:id', async (req, res) => {
  const { name, category, cost, quantity, reorderLevel } = req.body;

  try {
    await PackagingMaterial.findByIdAndUpdate(req.params.id, {
      name,
      category,
      cost: parseFloat(cost),
      quantity: parseInt(quantity, 10),
      reorderLevel: parseInt(reorderLevel, 10),
    });

    console.log(`Updated packaging material: ${name}`);
    res.redirect('/packaging'); // Redirect to the materials list page
  } catch (err) {
    console.error('Error updating material:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Route: Delete a packaging material
router.get('/delete/:id', async (req, res) => {
  try {
    const material = await PackagingMaterial.findByIdAndDelete(req.params.id);
    if (!material) {
      return res.status(404).send('Packaging Material not found');
    }
    console.log(`Deleted packaging material: ${material.name}`);
    res.redirect('/packaging'); // Redirect to the materials list page
  } catch (err) {
    console.error('Error deleting material:', err);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/view/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).send('Invoice not found');
    }
    res.render('inventory/viewPackaging', { invoice });
  } catch (err) {
    console.error('Error fetching invoice for view:', err);
    res.status(500).send('Internal Server Error');
  }
});



router.post('/add-packaging-to-invoice', async (req, res) => {
  const { invoiceNumber, packagingMaterials } = req.body;

  try {
    console.log('Received invoiceNumber:', invoiceNumber);

    // Find the invoice by invoiceNumber
    const invoice = await Invoice.findOne({ invoiceNumber });
    if (!invoice) {
      console.error('Invoice not found for Invoice Number:', invoiceNumber);
      return res.status(404).send('Invoice not found. Please select a valid invoice.');
    }

    const packagingDetails = [];
    let totalPackagingCost = 0;

    // Process packagingMaterials
    if (packagingMaterials) {
      for (let materialId in packagingMaterials) {
        const materialData = packagingMaterials[materialId];
        if (materialData.selected === 'true' && materialData.quantityUsed) {
          const quantityUsed = parseInt(materialData.quantityUsed, 10);
          const material = await PackagingMaterial.findById(materialId);

          if (material && quantityUsed > 0) {
            if (material.quantity < quantityUsed) {
              return res.status(400).send(`Not enough stock for ${material.name}`);
            }

            // Deduct the quantity from the packaging material stock
            material.quantity -= quantityUsed;
            await material.save();

            const cost = material.cost * quantityUsed;
            totalPackagingCost += cost;

            packagingDetails.push({
              materialId: material._id,
              name: material.name,
              quantityUsed,
              cost,
            });
          }
        }
      }
    }

    // Update the invoice
    invoice.packagingDetails = packagingDetails;
    invoice.packagingCost = totalPackagingCost;

    await invoice.save();
    console.log('Updated Invoice with Packaging Details:', invoice);

    // Redirect to the packaging view
    res.redirect('/packaging/add-packaging-to-invoice');
  } catch (err) {
    console.error('Error adding packaging to invoice:', err);
    res.status(500).send('Internal Server Error');
  }
});


module.exports = router;

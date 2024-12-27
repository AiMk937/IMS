// Required imports
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const PackagingMaterial = require('../models/PackagingMaterial');
const Invoice = require('../models/invoice');

/**
 * Route: Fetch and display all packaging materials.
 */
router.get('/', async (req, res) => {
  try {
    const materials = await PackagingMaterial.find();
    res.render('inventory/packaging', { materials });
  } catch (err) {
    console.error('Error fetching packaging materials:', err);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Route: Display form to add a new packaging material.
 */
router.get('/add-packaging', (req, res) => {
  res.render('inventory/addPackagingMaterial');
});

/**
 * Route: Add a new packaging material.
 */
router.post('/add-packaging', async (req, res) => {
  const { name, category, cost, quantity, reorderLevel, dimensions } = req.body;

  try {
    // Validate required fields
    if (!name || !category || !cost || !quantity || !reorderLevel) {
      return res.status(400).send('All fields are required.');
    }

    // Parse numeric values and validate dimensions if applicable
    const parsedCost = parseFloat(cost);
    const parsedQuantity = parseInt(quantity, 10);
    const parsedReorderLevel = parseInt(reorderLevel, 10);

    if (isNaN(parsedCost) || isNaN(parsedQuantity) || isNaN(parsedReorderLevel)) {
      return res.status(400).send('Invalid numeric values for cost, quantity, or reorder level.');
    }

    let parsedDimensions = {};
    if (category === 'shipping box') {
      parsedDimensions = {
        length: parseFloat(dimensions?.length || '0'),
        width: parseFloat(dimensions?.width || '0'),
        height: parseFloat(dimensions?.height || '0'),
      };

      if (Object.values(parsedDimensions).some(value => isNaN(value))) {
        return res.status(400).send('Invalid dimensions for shipping box.');
      }
    }

    // Save the new material
    const newMaterial = new PackagingMaterial({
      name,
      category,
      cost: parsedCost,
      quantity: parsedQuantity,
      reorderLevel: parsedReorderLevel,
      dimensions: parsedDimensions,
    });

    await newMaterial.save();
    res.redirect('/packaging');
  } catch (err) {
    console.error('Error adding packaging material:', err);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Route: Delete packaging materials from an invoice.
 */
router.get('/delete/:invoiceId', async (req, res) => {
  const { invoiceId } = req.params;

  try {
    // Find the invoice
    const invoice = await Invoice.findById(invoiceId).populate('packagingDetails.materialId');
    if (!invoice) {
      return res.status(404).send('Invoice not found');
    }

    // Restore the quantity of all packaging materials in this invoice
    for (const detail of invoice.packagingDetails) {
      const packagingMaterial = await PackagingMaterial.findById(detail.materialId._id);
      if (packagingMaterial) {
        packagingMaterial.quantity += detail.quantityUsed;
        await packagingMaterial.save();
      }
    }

    // Clear the packaging details from the invoice
    invoice.packagingDetails = [];
    invoice.packagingCost = 0; // Reset the cost after deletion

    await invoice.save();

    console.log(`Deleted all packaging materials from invoice ${invoiceId}`);
    res.redirect('/packaging/add-packaging-to-invoice');
  } catch (err) {
    console.error('Error deleting packaging materials from invoice:', err);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Route: View a specific invoice by ID.
 */
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

/**
 * Route: Edit packaging materials for an invoice (GET).
 */
router.get('/edit/:invoiceId', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const invoice = await Invoice.findById(invoiceId).populate('packagingDetails.materialId');
    if (!invoice) {
      return res.status(404).send('Invoice not found');
    }

    const packagingMaterials = await PackagingMaterial.find().sort({ category: -1, cost: 1 });
    res.render('inventory/editPackagingMaterial', { invoice, packagingMaterials });
  } catch (err) {
    console.error('Error rendering edit packaging page:', err);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Route: Edit packaging material details (GET).
 */
router.get('/edit-material/:id', async (req, res) => {
  try {
    const material = await PackagingMaterial.findById(req.params.id);
    if (!material) {
      return res.status(404).send('Packaging Material not found');
    }
    res.render('inventory/editPackaging', { material });
  } catch (err) {
    console.error('Error fetching material for edit:', err);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Route: Edit packaging material details (POST).
 */
router.post('/edit-material/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, cost, quantity, reorderLevel, dimensions } = req.body;

  try {
    const material = await PackagingMaterial.findById(id);
    if (!material) {
      return res.status(404).send('Packaging Material not found');
    }

    material.name = name || material.name;
    material.category = category || material.category;
    material.cost = parseFloat(cost) || material.cost;
    material.quantity = parseInt(quantity, 10) || material.quantity;
    material.reorderLevel = parseInt(reorderLevel, 10) || material.reorderLevel;

    if (category === 'shipping box' && dimensions) {
      material.dimensions = {
        length: parseFloat(dimensions?.length || material.dimensions.length),
        width: parseFloat(dimensions?.width || material.dimensions.width),
        height: parseFloat(dimensions?.height || material.dimensions.height),
      };
    }

    await material.save();
    res.redirect('/packaging');
  } catch (err) {
    console.error('Error updating material:', err);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Route: Add packaging materials to an invoice (GET).
 */
router.get('/add-packaging-to-invoice', async (req, res) => {
  try {
    const invoices = await Invoice.find().populate('packagingDetails.materialId');
    const packagingMaterials = await PackagingMaterial.find();

    const consolidatedData = invoices.map((invoice) => {
      // Sum up the total cost of packaging materials in the invoice
      const totalCost = invoice.packagingDetails?.reduce((sum, item) => sum + item.cost, 0) || 0;

      return {
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        buyerName: invoice.buyer?.name || 'Unknown',
        totalCost, // Pass the correctly calculated total cost
        packagingDetails: invoice.packagingDetails,
      };
    });

    res.render('inventory/addPackaging', {
      invoices,
      packagingMaterials,
      consolidatedData,
    });
  } catch (err) {
    console.error('Error fetching invoices or packaging materials:', err);
    res.status(500).send('Internal Server Error');
  }
});


/**
 * Route: Edit packaging materials for an invoice (POST).
 */
router.post('/edit/:invoiceId', async (req, res) => {
  const { invoiceId } = req.params;
  const { materials } = req.body;

  try {
    const invoice = await Invoice.findById(invoiceId).populate('packagingDetails.materialId');
    if (!invoice) {
      return res.status(404).send('Invoice not found');
    }

    // Reset packaging details
    const updatedPackagingDetails = [];
    let totalPackagingCost = 0;

    // Iterate through materials
    for (const materialId in materials) {
      const updates = materials[materialId];
      const material = await PackagingMaterial.findById(materialId);
      if (!material) continue;

      const quantityUsed = parseInt(updates.quantityUsed, 10) || 0;

      if (updates.selected === 'true' && quantityUsed > 0) {
        // Find existing detail if present
        const existingDetail = invoice.packagingDetails.find(
          detail => detail.materialId._id.toString() === materialId
        );

        if (existingDetail) {
          // Update the existing detail
          const stockAdjustment = existingDetail.quantityUsed - quantityUsed;
          if (material.quantity + stockAdjustment < 0) {
            return res.status(400).send(`Not enough stock for ${material.name}`);
          }
          material.quantity += stockAdjustment;
          existingDetail.quantityUsed = quantityUsed;
          existingDetail.cost = material.cost * quantityUsed; // Update cost
          updatedPackagingDetails.push(existingDetail);
        } else {
          // Add a new detail if not already present
          if (material.quantity < quantityUsed) {
            return res.status(400).send(`Not enough stock for ${material.name}`);
          }
          updatedPackagingDetails.push({
            materialId: material._id,
            name: material.name,
            quantityUsed,
            cost: material.cost * quantityUsed,
          });
          material.quantity -= quantityUsed;
        }

        await material.save();
      }
    }

    // Update invoice packaging details and total cost
    invoice.packagingDetails = updatedPackagingDetails;
    totalPackagingCost = updatedPackagingDetails.reduce((sum, item) => sum + item.cost, 0);
    invoice.packagingCost = totalPackagingCost;

    await invoice.save();

    console.log(`Updated packaging materials for Invoice ID: ${invoiceId}`);
    res.redirect(`/packaging/view/${invoiceId}`);
  } catch (err) {
    console.error('Error updating materials for invoice:', err);
    res.status(500).send('Internal Server Error');
  }
});


/**
 * Route: Add packaging materials to an invoice.
 */
router.post('/add-packaging-to-invoice', async (req, res) => {
  const { invoiceId, packagingMaterials } = req.body;

  try {
    if (!invoiceId) return res.status(400).send('Invoice ID is required.');

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return res.status(404).send('Invoice not found.');

    const packagingDetails = [];
    let totalPackagingCost = 0;

    for (const materialId in packagingMaterials) {
      const materialData = packagingMaterials[materialId];
      const quantityUsed = parseInt(materialData.quantityUsed, 10);

      // Fetch the material from the database
      const material = await PackagingMaterial.findById(materialId);

      if (material && materialData.selected === 'true' && quantityUsed > 0) {
        if (material.quantity < quantityUsed) {
          return res.status(400).send(`Not enough stock for ${material.name}`);
        }

        // Update material stock
        material.quantity -= quantityUsed;
        await material.save();

        // Calculate cost correctly
        const cost = material.cost * quantityUsed;
        totalPackagingCost += cost;

        // Add packaging details to the array
        packagingDetails.push({
          materialId: material._id,
          name: material.name,
          quantityUsed,
          cost, // Use calculated cost
        });
      }
    }

    // Update invoice with new packaging details
    invoice.packagingDetails = packagingDetails;
    invoice.packagingCost = totalPackagingCost;
    await invoice.save();

    res.redirect('/packaging/add-packaging-to-invoice');
  } catch (err) {
    console.error('Error adding packaging to invoice:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;

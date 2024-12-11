// Client-side validation for image uploads
document.querySelector('form')?.addEventListener('submit', function (e) {
    const imageInput = document.getElementById('image');
    const file = imageInput?.files[0];
  
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  
      if (!allowedTypes.includes(file.type)) {
        alert('Invalid file type. Please upload an image (JPEG, PNG, GIF).');
        e.preventDefault();
        return;
      }
  
      if (file.size > 100 * 1024) {
        alert('File size must be less than 100 KB.');
        e.preventDefault();
        return;
      }
    }
  });
  
  // Client-side validation for invoice generation
  document.getElementById('generateInvoice').addEventListener('click', async () => {
    const buyerDetails = {
      name: document.getElementById('buyerName').value,
      address: document.getElementById('buyerAddress').value,
      contactNumber: document.getElementById('buyerContact').value,
    };

    if (!buyerDetails.name || !buyerDetails.address || !buyerDetails.contactNumber) {
      alert('Please fill in all buyer details.');
      return;
    }

    const formData = new FormData(document.getElementById('invoiceForm'));
    const selectedItems = formData.getAll('selectedItems');
    if (selectedItems.length === 0) {
      alert('Please select at least one item to generate the invoice.');
      return;
    }

    const invoiceData = [];
    selectedItems.forEach(itemId => {
      const quantity = formData.get(`quantity-${itemId}`);
      if (!quantity || quantity <= 0) {
        alert('Please enter a valid quantity for selected items.');
        return;
      }
      invoiceData.push({ itemId, quantity });
    });

    const response = await fetch('/invoice/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceData, buyerDetails }),
    });

    if (response.ok) {
      const invoiceHtml = await response.text();
      document.getElementById('invoicePreview').style.display = 'block';
      document.getElementById('invoiceContent').innerHTML = invoiceHtml;
    } else {
      alert('Failed to generate invoice.');
    }
  });

  document.getElementById('downloadInvoice').addEventListener('click', () => {
    printDiv('invoiceContent');
  });

  function printDiv(divId) {
    const printWindow = window.open('', '', 'width=800,height=600');
    const divContents = document.getElementById(divId).innerHTML;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Invoice</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
          </style>
        </head>
        <body>
          ${divContents}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  }
  
  // Handle Delete Confirmation for Inventory Items
  document.querySelectorAll('a.btn-danger')?.forEach(button => {
    button.addEventListener('click', event => {
      if (!confirm('Are you sure you want to delete this item?')) {
        event.preventDefault();
      }
    });
  });
  
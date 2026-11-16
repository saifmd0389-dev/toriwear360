import { OrderDetails } from '../types';

/**
 * Generates an official, tax-compliant HTML Tax Invoice for a TORI WEAR customer order.
 */
export function generateInvoiceHtml(order: OrderDetails, fallbackCustomerName?: string): string {
  const customerName = order.shippingAddress?.fullName || fallbackCustomerName || 'Valued Customer';
  const customerPhone = order.shippingAddress?.phone || '+91 98201 45112';
  const customerEmail = order.shippingAddress?.email || 'customer@toriwear.com';
  const addressLine1 = order.shippingAddress?.addressLine1 || 'Main Delivery Address';
  const addressLine2 = order.shippingAddress?.addressLine2 || '';
  const city = order.shippingAddress?.city || 'Visakhapatnam';
  const state = order.shippingAddress?.state || 'Andhra Pradesh';
  const pincode = order.shippingAddress?.pincode || '530018';
  
  const invoiceNo = `INV-${order.orderId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`;
  const orderDate = order.date || new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const invoiceDate = orderDate;

  const items = order.items && order.items.length > 0 ? order.items : [
    {
      product: {
        id: 'item-drop',
        name: 'Shadow Monarch Oversized Streetwear Tee',
        department: 'MEN',
        franchise: 'Solo Leveling',
        price: order.total || 1199,
        originalPrice: 1699,
        rating: 4.9,
        reviewsCount: 142,
        images: ['/assets/toriwear-official-logo.png'],
        description: '240 GSM Combed Bio-Washed Cotton',
        tags: ['Oversized', 'Heavyweight'],
        isNew: true,
      },
      size: 'L',
      color: 'Obsidian Black',
      quantity: 1,
    }
  ];

  // GST calculations (12% apparel rate divided into 6% CGST + 6% SGST)
  const totalAmount = order.total || 0;
  const taxableValue = Math.round((totalAmount / 1.12) * 100) / 100;
  const totalGst = Math.round((totalAmount - taxableValue) * 100) / 100;
  const cgst = Math.round((totalGst / 2) * 100) / 100;
  const sgst = Math.round((totalGst / 2) * 100) / 100;

  const paymentMethodLabel = 
    order.paymentMethod === 'upi' ? `UPI (${order.paymentDetails?.upiId || 'Verified UPI'})` :
    order.paymentMethod === 'card' ? `Credit / Debit Card (•••• ${order.paymentDetails?.cardLast4 || '4242'})` :
    order.paymentMethod === 'netbanking' ? `Net Banking (${order.paymentDetails?.bankName || 'Verified NetBanking'})` :
    'Cash on Delivery (COD)';

  const paymentStatus = order.paymentMethod === 'cod' ? 'PAYMENT ON DELIVERY' : 'PAID IN FULL';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tax Invoice - ${invoiceNo} - TORIWEAR</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #111827;
      background: #f9fafb;
      padding: 24px;
      line-height: 1.5;
      font-size: 13px;
    }
    .invoice-container {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 36px 40px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.04);
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #111827;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .brand-title {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: 0.1em;
      color: #dc2626;
      text-transform: uppercase;
      font-family: monospace, sans-serif;
    }
    .brand-sub {
      font-size: 11px;
      color: #4b5563;
      letter-spacing: 0.05em;
      margin-top: 2px;
      text-transform: uppercase;
      font-weight: 600;
    }
    .invoice-tag {
      text-align: right;
    }
    .invoice-tag h2 {
      font-size: 18px;
      font-weight: 800;
      color: #111827;
      text-transform: uppercase;
    }
    .invoice-tag .badge {
      display: inline-block;
      margin-top: 4px;
      padding: 3px 8px;
      font-size: 11px;
      font-family: monospace;
      font-weight: 700;
      background: #ecfdf5;
      color: #059669;
      border: 1px solid #a7f3d0;
      border-radius: 4px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
      background: #f9fafb;
      padding: 16px 20px;
      border-radius: 8px;
      border: 1px solid #f3f4f6;
    }
    .meta-box h4 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .meta-box p {
      font-size: 13px;
      color: #1f2937;
      margin-bottom: 2px;
    }
    .meta-box .bold {
      font-weight: 700;
    }
    .table-container {
      margin-bottom: 24px;
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    th {
      background: #111827;
      color: #ffffff;
      padding: 10px 12px;
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 12px;
      vertical-align: top;
    }
    .item-title {
      font-weight: 700;
      color: #111827;
      font-size: 13px;
    }
    .item-sub {
      color: #6b7280;
      font-size: 11px;
      margin-top: 2px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 300px;
      gap: 24px;
      margin-bottom: 24px;
    }
    .payment-box {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      background: #ffffff;
    }
    .payment-box h4 {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 700;
      color: #4b5563;
      margin-bottom: 8px;
    }
    .totals-box {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 12px;
      color: #4b5563;
    }
    .total-row.grand {
      border-top: 2px solid #111827;
      margin-top: 8px;
      padding-top: 8px;
      font-size: 15px;
      font-weight: 800;
      color: #111827;
    }
    .footer-note {
      border-top: 1px solid #e5e7eb;
      padding-top: 20px;
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      color: #6b7280;
      font-size: 11px;
    }
    .signature-area {
      text-align: right;
    }
    .signature-box {
      width: 160px;
      height: 48px;
      border-bottom: 1px solid #111827;
      margin-bottom: 4px;
      margin-left: auto;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      font-style: italic;
      color: #111827;
      font-weight: 700;
      font-family: cursive, sans-serif;
    }
    .action-bar {
      margin-top: 24px;
      text-align: center;
    }
    .print-btn {
      background: #dc2626;
      color: #ffffff;
      border: none;
      padding: 10px 24px;
      font-size: 13px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .print-btn:hover {
      background: #b91c1c;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .invoice-container {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
      .action-bar {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header-bar">
      <div>
        <div class="brand-title">TORIWEAR</div>
        <div class="brand-sub">Original Anime Streetwear · 240+ GSM Combed Cotton</div>
        <div style="font-size: 11px; color: #6b7280; margin-top: 6px;">
          TORI WEAR APPAREL PVT. LTD.<br />
          Beach Road Industrial Estate, Visakhapatnam - 530002, Andhra Pradesh, India<br />
          <strong>GSTIN:</strong> 37AAACT1234F1Z5 | <strong>CIN:</strong> U18101AP2026PTC099182
        </div>
      </div>
      <div class="invoice-tag">
        <h2>TAX INVOICE</h2>
        <div style="font-family: monospace; font-size: 13px; font-weight: 700; margin-top: 4px; color: #111827;">${invoiceNo}</div>
        <div class="badge">${paymentStatus}</div>
        <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">Original for Recipient</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-box">
        <h4>Billed & Shipped To:</h4>
        <p class="bold">${customerName}</p>
        <p>${addressLine1}${addressLine2 ? ', ' + addressLine2 : ''}</p>
        <p>${city}, ${state} - ${pincode}</p>
        <p><strong>Phone:</strong> ${customerPhone}</p>
        <p><strong>Email:</strong> ${customerEmail}</p>
        <p style="margin-top: 4px; font-size: 11px; color: #4b5563;"><strong>Place of Supply:</strong> ${state} (Code: 37)</p>
      </div>

      <div class="meta-box">
        <h4>Order & Dispatch Details:</h4>
        <p><strong>Order ID:</strong> <span style="font-family: monospace; font-weight: 700;">${order.orderId}</span></p>
        <p><strong>Order Date:</strong> ${orderDate}</p>
        <p><strong>Invoice Date:</strong> ${invoiceDate}</p>
        <p><strong>Delivery Status:</strong> <span style="font-weight: 700; color: #059669;">${order.status}</span></p>
        <p><strong>Estimated Delivery:</strong> ${order.estimatedDelivery || 'Delivered'}</p>
        <p><strong>Reverse Charge:</strong> No</p>
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th style="width: 36px;">#</th>
            <th>Item Description</th>
            <th style="width: 80px;">HSN/SAC</th>
            <th style="width: 60px;">Size</th>
            <th style="width: 45px; text-align: center;">Qty</th>
            <th style="width: 90px; text-align: right;">Unit Rate</th>
            <th style="width: 90px; text-align: right;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, idx) => {
            const linePrice = item.product?.price || 1199;
            const lineTotal = linePrice * (item.quantity || 1);
            return `
              <tr>
                <td style="color: #6b7280; font-family: monospace;">${idx + 1}</td>
                <td>
                  <div class="item-title">${item.product?.name || 'Tori Wear Original Apparel'}</div>
                  <div class="item-sub">Color: ${item.color || 'Standard'} · Anime Streetwear Series</div>
                </td>
                <td style="font-family: monospace; color: #4b5563;">61091000</td>
                <td style="font-weight: 700; font-family: monospace;">${item.size || 'L'}</td>
                <td style="text-align: center; font-weight: 700;">${item.quantity || 1}</td>
                <td style="text-align: right; font-family: monospace;">₹${linePrice.toFixed(2)}</td>
                <td style="text-align: right; font-weight: 700; font-family: monospace;">₹${lineTotal.toFixed(2)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="summary-grid">
      <div class="payment-box">
        <h4>Payment & Transaction Summary</h4>
        <p style="margin-bottom: 4px;"><strong>Payment Method:</strong> ${paymentMethodLabel}</p>
        <p style="margin-bottom: 4px;"><strong>Payment Status:</strong> <span style="color: #059669; font-weight: 700;">${paymentStatus}</span></p>
        <p style="margin-bottom: 4px;"><strong>Transaction ID:</strong> <span style="font-family: monospace;">TXN-${order.orderId.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}</span></p>
        <p style="margin-top: 10px; font-size: 11px; color: #6b7280;">
          All taxes have been accounted for under GST rules. No additional charges payable on delivery.
        </p>
      </div>

      <div class="totals-box">
        <div class="total-row">
          <span>Gross Subtotal:</span>
          <span style="font-family: monospace;">₹${(order.subtotal || totalAmount).toFixed(2)}</span>
        </div>
        ${order.discount ? `
          <div class="total-row" style="color: #dc2626;">
            <span>Coupon Discount (${order.discountCode || 'APPLIED'}):</span>
            <span style="font-family: monospace;">-₹${order.discount.toFixed(2)}</span>
          </div>
        ` : ''}
        <div class="total-row">
          <span>Taxable Value:</span>
          <span style="font-family: monospace;">₹${taxableValue.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>CGST (6%):</span>
          <span style="font-family: monospace;">₹${cgst.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>SGST (6%):</span>
          <span style="font-family: monospace;">₹${sgst.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>Shipping & Handling:</span>
          <span style="color: #059669; font-weight: 700;">FREE</span>
        </div>
        <div class="total-row grand">
          <span>Grand Total:</span>
          <span style="color: #dc2626;">₹${totalAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <div class="footer-note">
      <div style="max-width: 500px;">
        <p><strong>Declaration:</strong> We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
        <p style="margin-top: 4px;">Customer Care: support@toriwear.com · Returns accepted within 7 days in original condition.</p>
      </div>
      <div class="signature-area">
        <div class="signature-box">Saif (TORI WEAR)</div>
        <div style="font-size: 10px; text-transform: uppercase; font-weight: 700;">Authorized Signatory</div>
      </div>
    </div>

    <div class="action-bar">
      <button class="print-btn" onclick="window.print()">
        🖨️ Print / Save as PDF
      </button>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Downloads the invoice HTML file directly to the customer's machine.
 */
export function downloadInvoiceFile(order: OrderDetails, fallbackCustomerName?: string): void {
  try {
    const htmlContent = generateInvoiceHtml(order, fallbackCustomerName);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `TORIWEAR_Tax_Invoice_${order.orderId}.html`;
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading invoice:', error);
  }
}

/**
 * Opens a print-friendly invoice window allowing immediate printing or PDF export.
 */
export function printInvoiceDirectly(order: OrderDetails, fallbackCustomerName?: string): void {
  try {
    const htmlContent = generateInvoiceHtml(order, fallbackCustomerName);
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.style.visibility = 'hidden';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (frameDoc && printFrame.contentWindow) {
      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();
      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch {
          downloadInvoiceFile(order, fallbackCustomerName);
        } finally {
          setTimeout(() => {
            if (printFrame.parentNode) {
              printFrame.parentNode.removeChild(printFrame);
            }
          }, 1000);
        }
      }, 350);
    } else {
      if (printFrame.parentNode) {
        printFrame.parentNode.removeChild(printFrame);
      }
      downloadInvoiceFile(order, fallbackCustomerName);
    }
  } catch {
    downloadInvoiceFile(order, fallbackCustomerName);
  }
}

export const materials = [
  { id: 'material-vinyl', name: 'Sample vinyl roll', category: 'Vinyl', unit: 'm', rollWidth: '24', rollWidthUnit: 'in', quantity: '8.5', reorderLevel: '5', avgCost: 180, status: 'In stock' },
  { id: 'material-laminate', name: 'Sample laminate roll', category: 'Laminate', unit: 'm', rollWidth: '24', rollWidthUnit: 'in', quantity: '2.5', reorderLevel: '4', avgCost: 95, status: 'Low stock' },
  { id: 'material-tape', name: 'Sample transfer tape', category: 'Tape', unit: 'm', rollWidth: '12', rollWidthUnit: 'in', quantity: '0', reorderLevel: '2', avgCost: 48, status: 'Out of stock' },
  { id: 'material-ink', name: 'Sample ink bottle', category: 'Ink', unit: 'bottle', rollWidth: '—', rollWidthUnit: '', quantity: '18', reorderLevel: '3', avgCost: 320, status: 'In stock' }
];

export const products = [
  {
    id: 'product-sticker', name: 'Sample logo sticker', sku: 'SAMPLE-STK-01', category: 'Sticker', unit: 'pc', sellPrice: 25,
    recipe: [
      { materialId: materials[0].id, materialName: materials[0].name, unit: 'm', qtyPerUnit: 0.08, unitCost: 180, lineCost: 14.4 },
      { materialId: materials[1].id, materialName: materials[1].name, unit: 'm', qtyPerUnit: 0.08, unitCost: 95, lineCost: 7.6 }
    ], unitCost: 22, marginAmount: 3, marginPercent: 12
  },
  {
    id: 'product-label', name: 'Sample product label', sku: 'SAMPLE-LBL-02', category: 'Sticker', unit: 'pc', sellPrice: 18,
    recipe: [{ materialId: materials[0].id, materialName: materials[0].name, unit: 'm', qtyPerUnit: 0.06, unitCost: 180, lineCost: 10.8 }],
    unitCost: 10.8, marginAmount: 7.2, marginPercent: 40
  }
];

export const purchaseOrder = {
  number: 'PO-000042', supplierName: 'Sample Supply Co', status: 'ordered', orderDate: '2026-10-20',
  lines: [
    { materialId: materials[0].id, materialName: materials[0].name, unit: materials[0].unit, qty: '20', receivedQty: '0', unitCost: 180 },
    { materialId: materials[1].id, materialName: materials[1].name, unit: materials[1].unit, qty: '12', receivedQty: '0', unitCost: 95 }
  ], subtotal: 4740
};

export const booking = {
  name: 'Sample window graphics', client: 'Sample Client', date: '2026-10-24', status: 'In progress',
  productQuantity: 12, correctionReason: 'Sample correction reason',
  materials: [
    { materialId: materials[0].id, materialName: materials[0].name, unit: 'm', plannedQuantity: '3.2', usedQuantity: '3.0', wasteQuantity: '0.2' },
    { materialId: materials[1].id, materialName: materials[1].name, unit: 'm', plannedQuantity: '3.2', usedQuantity: '2.9', wasteQuantity: '0.3' }
  ],
  materialCost: 829.5
};

export const payRun = {
  period: '2026-10', employee: 'Sample Team Member', employeeId: 'SAMPLE-001', salaryType: 'monthly', status: 'draft',
  grossPay: 24000, deductions: 1200, netPay: 22800, amountPaid: 0, balance: 22800
};

export const php = (amount) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', maximumFractionDigits: 2
}).format(Number(amount) || 0);

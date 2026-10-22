import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
const prefix = 'sample-checkout-v1';
if (!uri) throw new Error('MONGODB_URI is not configured.');

const schema = new mongoose.Schema({
  resource: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'businessrecords' });
schema.index({ resource: 1, 'data.number': 1 }, { unique: true, partialFilterExpression: { resource: 'purchase-orders' } });
const BusinessRecord = mongoose.model('SampleBusinessRecord', schema, 'businessrecords');
const today = new Date().toISOString().slice(0, 10);
const idOf = (record) => record._id.toString();

async function ensure(resource, key, data) {
  const existing = await BusinessRecord.findOne({ resource, 'data.sampleDataKey': key });
  if (existing) return existing;
  const [record] = await BusinessRecord.create([{ resource, data: { ...data, sampleData: true, sampleDataKey: key } }]);
  return record;
}

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const existing = await BusinessRecord.countDocuments({ 'data.sampleData': true, 'data.sampleDataKey': { $regex: `^${prefix}:` } });
  if (existing) {
    console.log(`Found ${existing} existing sample records. No changes made; this seed is one-time and idempotent.`);
    process.exitCode = 0;
  } else {
    const categoryNames = ['Vinyl & Media', 'Paper & Board', 'Finishing'];
    for (const [i, name] of categoryNames.entries()) await ensure('material-categories', `${prefix}:category:${i + 1}`, { name });

    const supplierSpecs = [
      { key: 'vinyl-supply', name: 'TEST · Metro Print Supply', contact: 'Sample Contact', email: 'test.metro@example.invalid', phone: '000-000-0101', leadTimeDays: 3, notes: 'Clearly marked sample record for system walkthrough.' },
      { key: 'paper-supply', name: 'TEST · Paper & Packaging Co.', contact: 'Sample Contact', email: 'test.paper@example.invalid', phone: '000-000-0102', leadTimeDays: 5, notes: 'Clearly marked sample record for system walkthrough.' }
    ];
    const suppliers = [];
    for (const spec of supplierSpecs) suppliers.push(await ensure('suppliers', `${prefix}:supplier:${spec.key}`, { ...spec, status: 'active', suppliedMaterialIds: [] }));

    const materialSpecs = [
      { key: 'gloss-vinyl', name: 'TEST · Gloss sticker vinyl', category: 'Vinyl & Media', unit: 'm', quantity: 2, avgCost: 85, reorderLevel: 8, supplierIndex: 0 },
      { key: 'clear-laminate', name: 'TEST · Clear laminate film', category: 'Finishing', unit: 'm', quantity: 12, avgCost: 42, reorderLevel: 5, supplierIndex: 0 },
      { key: 'matte-card', name: 'TEST · Matte card stock', category: 'Paper & Board', unit: 'sheet', quantity: 24, avgCost: 6.5, reorderLevel: 10, supplierIndex: 1 }
    ];
    const materials = [];
    for (const spec of materialSpecs) {
      const supplier = suppliers[spec.supplierIndex];
      const data = { name: spec.name, category: spec.category, unit: spec.unit, quantity: spec.quantity, avgCost: spec.avgCost, reorderLevel: spec.reorderLevel, supplierId: idOf(supplier), supplierNameSnapshot: supplier.data.name, active: true };
      const material = await ensure('materials', `${prefix}:material:${spec.key}`, data);
      materials.push(material);
      await ensure('stock-movements', `${prefix}:opening:${spec.key}`, {
        materialId: idOf(material), materialName: material.data.name, type: 'opening', change: spec.quantity,
        balanceAfter: spec.quantity, unitCost: spec.avgCost, totalCost: Math.round(spec.quantity * spec.avgCost * 10000) / 10000,
        referenceType: '', referenceId: '', note: 'TEST DATA · Sample opening balance', date: today,
        idempotencyKey: `${prefix}:opening:${spec.key}`
      });
    }

    for (const supplier of suppliers) {
      const suppliedMaterialIds = materials.filter((material) => material.data.supplierId === idOf(supplier)).map(idOf);
      supplier.data = { ...supplier.data, suppliedMaterialIds }; supplier.markModified('data'); await supplier.save();
    }

    const orderSpecs = [
      { key: 'draft-order', supplierIndex: 0, status: 'draft', lines: [{ materialIndex: 0, qty: 10, unitCost: 85 }, { materialIndex: 1, qty: 6, unitCost: 42 }] },
      { key: 'open-order', supplierIndex: 1, status: 'ordered', lines: [{ materialIndex: 2, qty: 20, unitCost: 6.5 }] }
    ];
    const stamp = Date.now().toString().slice(-8);
    for (const [index, spec] of orderSpecs.entries()) {
      const lines = spec.lines.map((line) => ({ materialId: idOf(materials[line.materialIndex]), qty: line.qty, unitCost: line.unitCost, receivedQty: 0 }));
      const subtotal = Math.round(lines.reduce((sum, line) => sum + line.qty * line.unitCost, 0) * 10000) / 10000;
      await ensure('purchase-orders', `${prefix}:order:${spec.key}`, {
        number: `TEST-PO-${stamp}-${index + 1}`, supplierId: idOf(suppliers[spec.supplierIndex]), status: spec.status,
        orderDate: today, expectedDate: '', lines, subtotal, paidAmount: 0, notes: 'TEST DATA · Editable sample purchase order.', receipts: []
      });
    }

    const productSpecs = [
      { key: 'vinyl-sticker', name: 'TEST · Custom vinyl sticker', sku: `TEST-STK-${stamp}`, category: 'Sticker', unit: 'pc', sellPrice: 150, recipe: [{ materialId: idOf(materials[0]), qtyPerUnit: 0.25 }, { materialId: idOf(materials[1]), qtyPerUnit: 0.2 }] },
      { key: 'paper-tag', name: 'TEST · Printed paper tag', sku: `TEST-TAG-${stamp}`, category: 'Sticker', unit: 'pc', sellPrice: 35, recipe: [{ materialId: idOf(materials[2]), qtyPerUnit: 1 }] }
    ];
    for (const product of productSpecs) await ensure('products', `${prefix}:product:${product.key}`, product);
    console.log('Added editable TEST suppliers, materials with opening movements, purchase orders, categories, and products.');
    console.log('The open sample purchase order is ordered but not received, so you can try partial receipt and see stock and pricing update.');
  }
} catch (error) {
  console.error(`Sample data seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

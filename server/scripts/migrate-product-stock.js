import 'dotenv/config';
import mongoose from 'mongoose';
import { applyStockMovement, toQuantity, toUnitCost } from '../services/inventory.js';

const uri = process.env.MONGODB_URI;
const apply = process.argv.includes('--apply');
if (!uri) {
  console.error('MONGODB_URI is not configured.');
  process.exitCode = 1;
} else {
  const schema = new mongoose.Schema({
    resource: { type: String, required: true }, data: { type: mongoose.Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now }, updatedAt: { type: Date, default: Date.now }
  }, { collection: 'businessrecords' });
  const BusinessRecord = mongoose.model('BusinessRecord', schema);
  try {
    await mongoose.connect(uri);
    const products = await BusinessRecord.find({ resource: 'products', 'data.stock': { $exists: true } }).lean();
    const candidates = products.filter((row) => !row.data.stockMigratedMaterialId && Number(row.data.stock) > 0 && Number.isFinite(Number(row.data.stock)));
    const invalid = products.filter((row) => !row.data.stockMigratedMaterialId && (!Number.isFinite(Number(row.data.stock)) || Number(row.data.stock) < 0));
    console.log(`${apply ? 'Applying' : 'Dry run'}: ${candidates.length} product stock rows to migrate; ${invalid.length} negative stock rows will be skipped.`);
    for (const row of candidates) {
      const name = String(row.data.name || row.data.sku || `Product ${row._id.toString().slice(-6)}`).trim();
      console.log(`${row.data.sku ? `${row.data.sku} · ` : ''}${name}: ${row.data.stock} → Materials`);
      if (!apply) continue;
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const product = await BusinessRecord.findOne({ _id: row._id, resource: 'products' }).session(session);
          if (!product || product.data.stockMigratedMaterialId) return;
          const quantity = toQuantity(product.data.stock, 'Legacy product stock');
          if (quantity <= 0) return;
          const productId = product._id.toString();
          let material = await BusinessRecord.findOne({ resource: 'materials', 'data.migratedFromProductId': productId }).session(session);
          if (!material) {
            const materialData = {
              name: `Legacy stock — ${name}`.slice(0, 120), category: 'Legacy finished goods', unit: String(product.data.stockUnit || 'pcs').trim().toLowerCase().slice(0, 24),
              quantity: 0, avgCost: 0, reorderLevel: 0, supplierId: '', supplierNameSnapshot: '', active: true,
              migratedFromProductId: productId, legacyProductSku: String(product.data.sku || '').slice(0, 120)
            };
            const [created] = await BusinessRecord.create([{ resource: 'materials', data: materialData }], { session });
            material = created;
            const unitCost = toUnitCost(product.data.avgCost ?? product.data.unitCost ?? product.data.cost ?? 0, 'Legacy product unit cost');
            await applyStockMovement(BusinessRecord, session, material._id, {
              type: 'opening', quantity, unitCost, date: new Date().toISOString().slice(0, 10),
              note: `Migrated legacy product stock (${productId}).`, idempotencyKey: `legacy-product-stock:${productId}`,
              extraData: { migratedFromProductId: productId }
            });
          }
          product.data = { ...product.data, stock: 0, stockMigratedMaterialId: material._id.toString() };
          product.markModified('data');
          await product.save({ session });
        });
      } finally { await session.endSession(); }
    }
    if (invalid.length) console.log(`Skipped negative stock rows: ${invalid.map((row) => row.data.sku || row._id.toString()).join(', ')}`);
    if (!apply) console.log('No data changed. Rerun with --apply to perform the migration.');
    else console.log('Migration complete. Re-running will skip migrated products.');
  } catch (error) {
    console.error(`Migration failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

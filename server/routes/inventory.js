import express from 'express';
import {
  InventoryValidationError, MOVEMENT_TYPES, applyStockMovement, toQuantity, toUnitCost,
  validateBusinessDate, validateMaterial
} from '../services/inventory.js';
import { buildReorderSuggestions } from '../services/purchasing.js';

const serialize = (record) => ({ ...record.data, id: record._id.toString(), createdAt: record.createdAt, updatedAt: record.updatedAt });

function parseCsv(source) {
  if (typeof source !== 'string' || !source.trim()) throw new InventoryValidationError('Choose a non-empty CSV file.');
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  const parseLine = (line) => {
    const cells = []; let cell = ''; let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      if (line[i] === '"' && quoted && line[i + 1] === '"') { cell += '"'; i += 1; }
      else if (line[i] === '"') quoted = !quoted;
      else if (line[i] === ',' && !quoted) { cells.push(cell); cell = ''; }
      else cell += line[i];
    }
    if (quoted) throw new InventoryValidationError('CSV contains an unterminated quoted field.');
    cells.push(cell); return cells;
  };
  const header = parseLine(lines.shift()).map((cell) => cell.trim());
  const required = ['id', 'name', 'category', 'unit', 'reorderLevel', 'supplierId', 'active'];
  if (required.some((key) => !header.includes(key))) throw new InventoryValidationError(`CSV must include these columns: ${required.join(', ')}.`);
  if (lines.length > 1000) throw new InventoryValidationError('Import at most 1,000 rows at a time.');
  return lines.map((line) => Object.fromEntries(header.map((key, index) => [key, parseLine(line)[index] ?? ''])));
}

export function createInventoryRouter(BusinessRecord, mongoose) {
  const router = express.Router();
  const fail = (res, error) => res.status(error.status || 500).json({ error: error.message || 'Inventory action failed.' });

  router.get('/categories', async (_req, res) => {
    try {
      const [categoryRecords, materials] = await Promise.all([
        BusinessRecord.find({ resource: 'material-categories' }).sort({ 'data.name': 1 }).lean(),
        BusinessRecord.find({ resource: 'materials' }, { 'data.category': 1 }).lean()
      ]);
      const names = new Map();
      for (const record of categoryRecords) {
        const name = String(record.data?.name ?? '').trim();
        if (name && !names.has(name.toLocaleLowerCase())) names.set(name.toLocaleLowerCase(), { id: record._id.toString(), name, isCustom: true });
      }
      for (const record of materials) {
        const name = String(record.data?.category ?? '').trim();
        if (name && !names.has(name.toLocaleLowerCase())) names.set(name.toLocaleLowerCase(), { id: record._id.toString(), name, isCustom: false });
      }
      res.json([...names.values()].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) { fail(res, error); }
  });

  router.post('/categories', async (req, res) => {
    try {
      const name = String(req.body?.name ?? '').trim();
      if (!name) throw new InventoryValidationError('Enter a category name.');
      if (name.length > 80) throw new InventoryValidationError('Category name must be 80 characters or fewer.');
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const duplicate = await BusinessRecord.findOne({ $or: [
        { resource: 'material-categories', 'data.name': { $regex: `^${escaped}$`, $options: 'i' } },
        { resource: 'materials', 'data.category': { $regex: `^${escaped}$`, $options: 'i' } }
      ] }).lean();
      if (duplicate) throw new InventoryValidationError('That material category already exists.', 409);
      const [record] = await BusinessRecord.create([{ resource: 'material-categories', data: { name } }]);
      res.status(201).json(serialize(record));
    } catch (error) { fail(res, error); }
  });

  router.delete('/categories/:id', async (req, res) => {
    try {
      let categoryName = '';
      if (mongoose.isValidObjectId(req.params.id)) {
        const record = await BusinessRecord.findOneAndDelete({ _id: req.params.id, resource: 'material-categories' });
        if (record) categoryName = record.data?.name;
      }
      if (!categoryName && req.query.name) {
        categoryName = String(req.query.name).trim();
        await BusinessRecord.deleteMany({ resource: 'material-categories', 'data.name': categoryName });
      }
      if (categoryName) {
        await BusinessRecord.updateMany(
          { resource: 'materials', 'data.category': categoryName },
          { $set: { 'data.category': '' } }
        );
      }
      res.status(204).end();
    } catch (error) { fail(res, error); }
  });

  router.get('/', async (req, res) => {
    try {
      const query = { resource: 'materials' };
      if (req.query.active !== undefined) query['data.active'] = req.query.active !== 'false';
      const materials = await BusinessRecord.find(query).sort({ updatedAt: -1 }).lean();
      res.json(materials.map(serialize));
    } catch (error) { fail(res, error); }
  });

  router.get('/reorder-suggestions', async (_req, res) => {
    try {
      const [materials, suppliers, prices] = await Promise.all([
        BusinessRecord.find({ resource: 'materials', 'data.active': { $ne: false } }).lean(),
        BusinessRecord.find({ resource: 'suppliers', 'data.status': { $ne: 'inactive' } }).sort({ 'data.name': 1 }).lean(),
        BusinessRecord.find({ resource: 'supplier-prices' }).sort({ 'data.effectiveDate': -1, createdAt: -1 }).lean()
      ]);
      res.json(buildReorderSuggestions(materials, suppliers, prices));
    } catch (error) { fail(res, error); }
  });

  router.get('/reports', async (_req, res) => {
    try {
      const [materials, movements] = await Promise.all([
        BusinessRecord.find({ resource: 'materials' }).lean(),
        BusinessRecord.find({ resource: 'stock-movements' }).sort({ createdAt: 1, _id: 1 }).lean()
      ]);
      const waste = movements.filter((row) => row.data.type === 'waste').map(serialize);
      const movementBalances = new Map();
      for (const movement of movements) movementBalances.set(movement.data.materialId, Number(movement.data.balanceAfter || 0));
      res.json({
        waste,
        valuation: materials.map((row) => ({ id: row._id.toString(), name: row.data.name, quantity: Number(row.data.quantity || 0), unit: row.data.unit, avgCost: Number(row.data.avgCost || 0), value: Number(row.data.quantity || 0) * Number(row.data.avgCost || 0) })),
        movementCount: movements.length,
        ledgerBalances: materials.map((row) => ({ id: row._id.toString(), name: row.data.name, balance: Number(row.data.quantity || 0), movementBalance: movementBalances.get(row._id.toString()) ?? 0 }))
      });
    } catch (error) { fail(res, error); }
  });

  router.get('/export.csv', async (_req, res) => {
    try {
      const records = await BusinessRecord.find({ resource: 'materials' }).sort({ 'data.name': 1 }).lean();
      const columns = ['id', 'name', 'category', 'unit', 'reorderLevel', 'supplierId', 'active'];
      const cell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
      res.type('text/csv').set('Content-Disposition', 'attachment; filename="materials.csv"').send([columns.join(','), ...records.map(({ _id, data }) => [ _id, ...columns.slice(1).map((key) => data[key]) ].map(cell).join(','))].join('\r\n'));
    } catch (error) { fail(res, error); }
  });

  router.post('/import/preview', async (req, res) => {
    try {
      const rows = parseCsv(req.body?.csv);
      const preview = [];
      for (const [index, row] of rows.entries()) {
        try {
          if (!row.id || !mongoose.isValidObjectId(row.id)) throw new Error('A valid material id is required; imports do not create materials.');
          const current = await BusinessRecord.findOne({ _id: row.id, resource: 'materials' }).lean();
          if (!current) throw new Error('Material id not found.');
          const changes = validateMaterial({ name: row.name, category: row.category, unit: row.unit, reorderLevel: row.reorderLevel, supplierId: row.supplierId, active: row.active === 'true' }, { partial: true });
          if (changes.supplierId) {
            if (!mongoose.isValidObjectId(changes.supplierId) || !await BusinessRecord.exists({ _id: changes.supplierId, resource: 'suppliers' })) throw new Error('Supplier id not found.');
          }
          preview.push({ row: index + 2, id: row.id, name: current.data.name, changes, valid: true });
        } catch (error) { preview.push({ row: index + 2, name: row.name || '', valid: false, error: error.message }); }
      }
      res.json({ rows: preview, valid: preview.filter((row) => row.valid).length, invalid: preview.filter((row) => !row.valid).length });
    } catch (error) { fail(res, error); }
  });

  router.post('/import/apply', async (req, res) => {
    let session;
    try {
      const rows = req.body?.rows;
      if (!Array.isArray(rows) || !rows.length || rows.some((row) => !row.valid || !mongoose.isValidObjectId(row.id) || !row.changes)) throw new InventoryValidationError('Preview and validate every import row before applying changes.');
      if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new InventoryValidationError('Duplicate material ids are not allowed in one import.');
      session = await mongoose.startSession();
      await session.withTransaction(async () => {
        for (const row of rows) {
          const current = await BusinessRecord.findOne({ _id: row.id, resource: 'materials' }).session(session).lean();
          if (!current) throw new InventoryValidationError(`Material ${row.id} no longer exists. Refresh the preview.`, 409);
          const changes = validateMaterial(row.changes, { partial: true });
          if (changes.supplierId && !await BusinessRecord.exists({ _id: changes.supplierId, resource: 'suppliers' }).session(session)) throw new InventoryValidationError('Supplier not found.', 404);
          delete changes.unit;
          await BusinessRecord.updateOne({ _id: row.id, resource: 'materials' }, { $set: Object.fromEntries(Object.entries(changes).map(([key, value]) => [`data.${key}`, value])), $currentDate: { updatedAt: true } }, { session });
        }
      });
      res.json({ applied: rows.length });
    } catch (error) { fail(res, error); }
    finally { await session?.endSession(); }
  });

  router.post('/', async (req, res) => {
    let session;
    try {
      if (Object.hasOwn(req.body || {}, 'quantity') || Object.hasOwn(req.body || {}, 'avgCost')) throw new InventoryValidationError('Use openingQuantity and openingUnitCost to enter starting stock.');
      const materialData = validateMaterial(req.body);
      const openingQuantity = toQuantity(req.body.openingQuantity, 'Opening quantity', { optional: true });
      const openingUnitCost = openingQuantity > 0 ? toUnitCost(req.body.openingUnitCost, 'Opening unit cost') : 0;
      if (materialData.supplierId) {
        if (!mongoose.isValidObjectId(materialData.supplierId)) throw new InventoryValidationError('Supplier ID is invalid.');
        const supplier = await BusinessRecord.findOne({ _id: materialData.supplierId, resource: 'suppliers' }).lean();
        if (!supplier) throw new InventoryValidationError('Supplier not found.', 404);
        materialData.supplierNameSnapshot = supplier.data.name || materialData.supplierNameSnapshot || '';
      }
      session = await mongoose.startSession();
      let createdId;
      await session.withTransaction(async () => {
        const [material] = await BusinessRecord.create([{ resource: 'materials', data: { ...materialData, quantity: 0, avgCost: 0 } }], { session });
        createdId = material._id;
        if (openingQuantity > 0) {
          await applyStockMovement(BusinessRecord, session, material._id, {
            type: 'opening', quantity: openingQuantity, unitCost: openingUnitCost,
            note: String(req.body.openingNote || 'Opening balance').trim().slice(0, 500),
            date: validateBusinessDate(req.body.openingDate), idempotencyKey: `opening:${material._id}`
          });
        }
      });
      const material = await BusinessRecord.findOne({ _id: createdId, resource: 'materials' }).lean();
      res.status(201).json(serialize(material));
    } catch (error) { fail(res, error); }
    finally { await session?.endSession(); }
  });

  router.patch('/:id', async (req, res) => {
    let session;
    try {
      if (!mongoose.isValidObjectId(req.params.id)) throw new InventoryValidationError('Material ID is invalid.');
      const changes = validateMaterial(req.body, { partial: true });
      if (changes.supplierId) {
        if (!mongoose.isValidObjectId(changes.supplierId)) throw new InventoryValidationError('Supplier ID is invalid.');
        const supplier = await BusinessRecord.findOne({ _id: changes.supplierId, resource: 'suppliers' }).lean();
        if (!supplier) throw new InventoryValidationError('Supplier not found.', 404);
        changes.supplierNameSnapshot = supplier.data.name || changes.supplierNameSnapshot || '';
      } else if (Object.hasOwn(changes, 'supplierId')) {
        changes.supplierNameSnapshot = '';
      }
      session = await mongoose.startSession();
      let updatedId;
      await session.withTransaction(async () => {
        const material = await BusinessRecord.findOne({ _id: req.params.id, resource: 'materials' }).session(session);
        if (!material) throw new InventoryValidationError('Material not found.', 404);
        const hasHistory = await BusinessRecord.exists({ resource: 'stock-movements', 'data.materialId': req.params.id }).session(session);
        const fixedFields = ['unit', 'rollWidth', 'rollWidthUnit'];
        if (hasHistory && fixedFields.some((key) => Object.hasOwn(changes, key) && String(changes[key] ?? '') !== String(material.data[key] ?? ''))) {
          throw new InventoryValidationError('Base unit and roll width cannot be changed after stock movements exist.', 409);
        }
        await BusinessRecord.updateOne(
          { _id: req.params.id, resource: 'materials' },
          { $set: Object.fromEntries(Object.entries(changes).map(([key, value]) => [`data.${key}`, value])), $currentDate: { updatedAt: true } },
          { session }
        );
        updatedId = material._id;
      });
      const record = await BusinessRecord.findOne({ _id: updatedId, resource: 'materials' }).lean();
      res.json(serialize(record));
    } catch (error) { fail(res, error); }
    finally { await session?.endSession(); }
  });

  router.delete('/:id', async (req, res) => {
    let session;
    try {
      if (!mongoose.isValidObjectId(req.params.id)) throw new InventoryValidationError('Material ID is invalid.');
      session = await mongoose.startSession();
      await session.withTransaction(async () => {
        const material = await BusinessRecord.findOne({ _id: req.params.id, resource: 'materials' }).session(session);
        if (!material) throw new InventoryValidationError('Material not found.', 404);
        await BusinessRecord.deleteMany({ resource: 'stock-movements', 'data.materialId': req.params.id }).session(session);
        await BusinessRecord.deleteMany({ resource: 'supplier-prices', 'data.materialId': req.params.id }).session(session);
        await BusinessRecord.updateMany(
          { resource: 'suppliers' },
          { $pull: { 'data.suppliedMaterialIds': req.params.id } }
        ).session(session);
        await material.deleteOne({ session });
      });
      res.status(204).end();
    } catch (error) { fail(res, error); }
    finally { await session?.endSession(); }
  });

  router.get('/:id/movements', async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) throw new InventoryValidationError('Material ID is invalid.');
      const materialExists = await BusinessRecord.exists({ _id: req.params.id, resource: 'materials' });
      if (!materialExists) throw new InventoryValidationError('Material not found.', 404);
      const movements = await BusinessRecord.find({ resource: 'stock-movements', 'data.materialId': req.params.id }).sort({ 'data.date': -1, createdAt: -1 }).lean();
      res.json(movements.map(serialize));
    } catch (error) { fail(res, error); }
  });

  router.post('/:id/movements', async (req, res) => {
    let session;
    try {
      if (!mongoose.isValidObjectId(req.params.id)) throw new InventoryValidationError('Material ID is invalid.');
      const type = String(req.body.type || '');
      if (!MOVEMENT_TYPES.has(type)) throw new InventoryValidationError('Choose a supported movement type.');
      const note = String(req.body.note || '').trim();
      if (['waste', 'adjustment'].includes(type) && !note) throw new InventoryValidationError('Add a reason for waste or an adjustment.');
      const idempotencyKey = String(req.body.idempotencyKey || '').trim();
      if (!idempotencyKey || idempotencyKey.length > 120) throw new InventoryValidationError('A valid movement request key is required.');
      const date = validateBusinessDate(req.body.date);
      const referenceId = String(req.body.referenceId || '').trim();
      const referenceType = referenceId ? String(req.body.referenceType || '').trim() : '';
      let reversalOriginal;
      if (type === 'reversal') {
        if (referenceType !== 'reversal' || !mongoose.isValidObjectId(referenceId)) throw new InventoryValidationError('Select the original movement to reverse.');
        const original = await BusinessRecord.findOne({ _id: referenceId, resource: 'stock-movements', 'data.materialId': req.params.id, 'data.type': 'purchase_in' }).lean();
        if (!original) throw new InventoryValidationError('Only a recorded receipt for this material can be reversed.', 404);
        reversalOriginal = original;
        const reversed = await BusinessRecord.exists({ resource: 'stock-movements', 'data.type': 'reversal', 'data.referenceId': referenceId });
        if (reversed) throw new InventoryValidationError('This receipt has already been reversed.', 409);
      }
      if (type === 'purchase_in' && referenceType === 'purchase') {
        if (!mongoose.isValidObjectId(referenceId) || !await BusinessRecord.exists({ _id: referenceId, resource: 'purchases' })) throw new InventoryValidationError('Purchase record not found.', 404);
      }
      session = await mongoose.startSession();
      let result;
      await session.withTransaction(async () => {
        result = await applyStockMovement(BusinessRecord, session, req.params.id, {
          type, quantity: req.body.quantity, countedQuantity: req.body.countedQuantity,
          unitCost: type === 'reversal' ? reversalOriginal.data.unitCost : req.body.unitCost,
          note, date, idempotencyKey, referenceId, referenceType,
          change: type === 'reversal' ? -Number(reversalOriginal.data.change) : req.body.change
        });
      });
      res.status(result.duplicate ? 200 : 201).json(serialize(result.movement));
    } catch (error) {
      if (error?.code === 11000 && req.body?.idempotencyKey) {
        try {
          const existing = await BusinessRecord.findOne({ resource: 'stock-movements', 'data.idempotencyKey': req.body.idempotencyKey }).lean();
          if (existing) return res.json(serialize(existing));
        } catch { /* Preserve the original error response. */ }
      }
      fail(res, error);
    } finally { await session?.endSession(); }
  });

  return router;
}

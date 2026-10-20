import express from 'express';
import {
  InventoryValidationError, MOVEMENT_TYPES, applyStockMovement, toQuantity, toUnitCost,
  validateBusinessDate, validateMaterial
} from '../services/inventory.js';

const serialize = (record) => ({ ...record.data, id: record._id.toString(), createdAt: record.createdAt, updatedAt: record.updatedAt });

export function createInventoryRouter(BusinessRecord, mongoose) {
  const router = express.Router();
  const fail = (res, error) => res.status(error.status || 500).json({ error: error.message || 'Inventory action failed.' });

  router.get('/', async (req, res) => {
    try {
      const query = { resource: 'materials' };
      if (req.query.active !== undefined) query['data.active'] = req.query.active !== 'false';
      const materials = await BusinessRecord.find(query).sort({ updatedAt: -1 }).lean();
      res.json(materials.map(serialize));
    } catch (error) { fail(res, error); }
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
        const hasHistory = await BusinessRecord.exists({ resource: 'stock-movements', 'data.materialId': req.params.id }).session(session);
        if (hasHistory) throw new InventoryValidationError('Materials with stock history cannot be deleted. Mark this material inactive instead.', 409);
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
      if (type === 'reversal') {
        if (referenceType !== 'reversal' || !mongoose.isValidObjectId(referenceId)) throw new InventoryValidationError('Select the original movement to reverse.');
        const original = await BusinessRecord.findOne({ _id: referenceId, resource: 'stock-movements', 'data.materialId': req.params.id, 'data.type': 'purchase_in' }).lean();
        if (!original) throw new InventoryValidationError('Only a recorded receipt for this material can be reversed.', 404);
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
          unitCost: req.body.unitCost, note, date, idempotencyKey, referenceId, referenceType
          , change: req.body.change
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

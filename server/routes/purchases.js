import express from 'express';
import { InventoryValidationError, toUnitCost } from '../services/inventory.js';
import { recordPurchaseReceipt, recordSupplierPrices, reversePurchaseReceipt, validatePurchaseOrder, validateReceipt, validateSupplier } from '../services/purchasing.js';

const serialize = (record) => ({ ...record.data, id: record._id.toString(), createdAt: record.createdAt, updatedAt: record.updatedAt });
const today = () => new Date().toISOString().slice(0, 10);

export function createPurchasesRouter(BusinessRecord, mongoose) {
  const router = express.Router();
  const fail = (res, error) => res.status(error.status || 500).json({ error: error.message || 'Purchase request failed.' });
  const find = (resource, id, session) => {
    const query = BusinessRecord.findOne({ _id: id, resource });
    if (session) query.session(session);
    return query;
  };
  const getSupplier = async (id, session) => {
    if (!mongoose.isValidObjectId(id)) throw new InventoryValidationError('Supplier ID is invalid.');
    const supplier = await find('suppliers', id, session);
    if (!supplier) throw new InventoryValidationError('Supplier not found.', 404);
    return supplier;
  };
  const getOrder = async (id, session) => {
    if (!mongoose.isValidObjectId(id)) throw new InventoryValidationError('Purchase order ID is invalid.');
    const order = await find('purchase-orders', id, session);
    if (!order) throw new InventoryValidationError('Purchase order not found.', 404);
    return order;
  };
  const inTransaction = async (work) => {
    const session = await mongoose.startSession();
    let result;
    try { await session.withTransaction(async () => { result = await work(session); }); }
    finally { await session.endSession(); }
    return result;
  };
  const validateMaterials = async (ids, session) => {
    const unique = [...new Set(ids)];
    const query = BusinessRecord.find({ _id: { $in: unique }, resource: 'materials' });
    if (session) query.session(session);
    const records = await query.lean();
    if (records.length !== unique.length) throw new InventoryValidationError('One or more selected materials do not exist.');
    return records;
  };

  router.get('/suppliers', async (_req, res) => {
    try { const records = await BusinessRecord.find({ resource: 'suppliers' }).sort({ updatedAt: -1 }).lean(); res.json(records.map((record) => ({ ...record.data, id: record._id.toString(), createdAt: record.createdAt, updatedAt: record.updatedAt }))); }
    catch (error) { fail(res, error); }
  });
  router.post('/suppliers', async (req, res) => {
    try {
      const data = validateSupplier(req.body);
      await validateMaterials(data.suppliedMaterialIds);
      const [record] = await BusinessRecord.create([{ resource: 'suppliers', data }]);
      res.status(201).json(serialize(record));
    } catch (error) { fail(res, error); }
  });
  router.patch('/suppliers/:id', async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) throw new InventoryValidationError('Supplier ID is invalid.');
      const supplier = await getSupplier(req.params.id);
      const patch = validateSupplier(req.body, { partial: true });
      if (patch.suppliedMaterialIds) await validateMaterials(patch.suppliedMaterialIds);
      supplier.data = { ...supplier.data, ...patch }; supplier.markModified('data'); await supplier.save();
      res.json(serialize(supplier));
    } catch (error) { fail(res, error); }
  });
  router.get('/suppliers/:id', async (req, res) => {
    try {
      const supplier = await getSupplier(req.params.id);
      const [materials, orders, prices] = await Promise.all([
        BusinessRecord.find({ resource: 'materials', $or: [{ _id: { $in: supplier.data.suppliedMaterialIds || [] } }, { 'data.supplierId': req.params.id }] }).lean(),
        BusinessRecord.find({ resource: 'purchase-orders', 'data.supplierId': req.params.id }).sort({ updatedAt: -1 }).lean(),
        BusinessRecord.find({ resource: 'supplier-prices', 'data.supplierId': req.params.id }).sort({ 'data.effectiveDate': -1, createdAt: -1 }).limit(100).lean()
      ]);
      const priceMaterialIds = [...new Set(prices.map((price) => price.data.materialId))];
      const priceMaterials = await BusinessRecord.find({ _id: { $in: priceMaterialIds }, resource: 'materials' }).lean();
      const priceMaterialNames = new Map(priceMaterials.map((material) => [material._id.toString(), material.data.name]));
      const amountOwed = orders.filter((order) => ['partially_received', 'received', 'paid'].includes(order.data.status)).reduce((sum, order) => {
        const receivedValue = (order.data.lines || []).reduce((lineSum, line) => lineSum + Number(line.receivedQty || 0) * Number(line.unitCost || 0), 0);
        return sum + Math.max(0, receivedValue - Number(order.data.paidAmount || 0));
      }, 0);
      res.json({ supplier: serialize(supplier), materials: materials.map((item) => ({ ...item.data, id: item._id.toString() })), orders: orders.map((item) => ({ ...item.data, id: item._id.toString() })), prices: prices.map((item) => ({ ...item.data, id: item._id.toString(), materialName: priceMaterialNames.get(item.data.materialId) || 'Deleted material' })), amountOwed });
    } catch (error) { fail(res, error); }
  });

  const priceHistory = async (req, latestOnly = false) => {
    const threshold = req.query.thresholdPercent === undefined ? 10 : Number(req.query.thresholdPercent);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 500) throw new InventoryValidationError('Price alert threshold must be from 0 to 500 percent.');
    const filter = { resource: 'supplier-prices' };
    for (const field of ['materialId', 'supplierId']) if (req.query[field]) {
      if (!mongoose.isValidObjectId(req.query[field])) throw new InventoryValidationError(`${field === 'materialId' ? 'Material' : 'Supplier'} ID is invalid.`);
      filter[`data.${field}`] = req.query[field];
    }
    const prices = await BusinessRecord.find(filter).sort({ 'data.effectiveDate': 1, createdAt: 1, _id: 1 }).lean();
    const materialIds = [...new Set(prices.map((row) => row.data.materialId))];
    const supplierIds = [...new Set(prices.map((row) => row.data.supplierId))];
    const [materials, suppliers] = await Promise.all([
      BusinessRecord.find({ _id: { $in: materialIds }, resource: 'materials' }).lean(),
      BusinessRecord.find({ _id: { $in: supplierIds }, resource: 'suppliers' }).lean()
    ]);
    const materialNames = new Map(materials.map((row) => [row._id.toString(), row.data.name]));
    const supplierNames = new Map(suppliers.map((row) => [row._id.toString(), row.data.name]));
    const latestByPair = new Map();
    const tracked = prices.map((row) => {
      const pair = `${row.data.materialId}:${row.data.supplierId}`;
      const previous = latestByPair.get(pair);
      const previousUnitCost = previous ? Number(previous.data.unitCost) : null;
      const unitCost = Number(row.data.unitCost);
      const changePercent = previousUnitCost > 0 ? Math.round(((unitCost - previousUnitCost) / previousUnitCost) * 10000) / 100 : null;
      latestByPair.set(pair, row);
      return { ...row.data, id: row._id.toString(), materialName: materialNames.get(row.data.materialId) || 'Deleted material', supplierName: supplierNames.get(row.data.supplierId) || 'Deleted supplier', previousUnitCost, changePercent, alertThresholdPercent: threshold, costIncreaseAlert: false, createdAt: row.createdAt };
    });
    const latestIds = new Set([...latestByPair.values()].map((row) => row._id.toString()));
    tracked.forEach((row) => { row.costIncreaseAlert = latestIds.has(row.id) && row.changePercent !== null && row.changePercent > threshold; });
    if (latestOnly) {
      return tracked.filter((row) => latestIds.has(row.id));
    }
    return tracked.sort((a, b) => String(b.effectiveDate).localeCompare(String(a.effectiveDate)) || b.createdAt - a.createdAt);
  };
  router.get('/supplier-prices/latest', async (req, res) => {
    try { res.json(await priceHistory(req, true)); } catch (error) { fail(res, error); }
  });
  router.get('/supplier-prices', async (req, res) => {
    try { res.json(await priceHistory(req)); } catch (error) { fail(res, error); }
  });

  router.get('/purchases', async (req, res) => {
    try {
      const filter = { resource: 'purchase-orders' };
      if (req.query.status && !['draft', 'ordered', 'partially_received', 'received', 'paid', 'cancelled'].includes(req.query.status)) throw new InventoryValidationError('Purchase status filter is invalid.');
      if (req.query.status) filter['data.status'] = req.query.status;
      const orders = await BusinessRecord.find(filter).sort({ createdAt: -1 }).lean();
      const supplierIds = [...new Set(orders.map((order) => order.data.supplierId).filter(Boolean))];
      const suppliers = await BusinessRecord.find({ _id: { $in: supplierIds }, resource: 'suppliers' }).lean();
      const names = new Map(suppliers.map((supplier) => [supplier._id.toString(), supplier.data.name]));
      res.json(orders.map((order) => ({ ...order.data, id: order._id.toString(), supplierName: names.get(order.data.supplierId) || 'Unknown supplier', createdAt: order.createdAt, updatedAt: order.updatedAt })));
    } catch (error) { fail(res, error); }
  });
  router.post('/purchases', async (req, res) => {
    try {
      const data = validatePurchaseOrder(req.body);
      const supplier = await getSupplier(data.supplierId);
      if (String(supplier.data.status || 'active').toLowerCase() !== 'active') throw new InventoryValidationError('Choose an active supplier.');
      await validateMaterials(data.lines.map((line) => line.materialId));
      data.status = 'draft'; data.paidAmount = 0; data.receipts = [];
      const counter = await BusinessRecord.findOneAndUpdate({ resource: 'purchase-order-counters', 'data.key': 'purchase-order' }, { $inc: { 'data.value': 1 }, $setOnInsert: { resource: 'purchase-order-counters', 'data.key': 'purchase-order', createdAt: new Date() }, $set: { updatedAt: new Date() } }, { new: true, upsert: true });
      data.number = `PO-${String(counter.data.value).padStart(6, '0')}`;
      const [record] = await BusinessRecord.create([{ resource: 'purchase-orders', data }]);
      res.status(201).json(serialize(record));
    } catch (error) { fail(res, error); }
  });
  router.get('/purchases/:id', async (req, res) => {
    try { res.json(serialize(await getOrder(req.params.id))); }
    catch (error) { fail(res, error); }
  });
  router.delete('/purchases/:id', async (req, res) => {
    try {
      const order = await getOrder(req.params.id);
      const hasReceivedQuantity = order.data.lines?.some((line) => Number(line.receivedQty || 0) > 0);
      const hasReceipts = order.data.receipts?.length > 0;
      if (!['draft', 'cancelled'].includes(order.data.status) || hasReceivedQuantity || hasReceipts) {
        throw new InventoryValidationError('Only draft or cancelled purchase orders with no receipts can be deleted. Orders with receipt history must be kept for audit purposes.', 409);
      }
      await order.deleteOne();
      res.status(204).end();
    } catch (error) { fail(res, error); }
  });
  router.patch('/purchases/:id', async (req, res) => {
    try {
      const order = await getOrder(req.params.id);
      if (order.data.status !== 'draft' || order.data.receipts?.some((receipt) => !receipt.reversedAt)) throw new InventoryValidationError('Only draft purchase orders can be edited.', 409);
      const patch = validatePurchaseOrder(req.body, { partial: true });
      if (patch.supplierId) await getSupplier(patch.supplierId);
      if (patch.lines) await validateMaterials(patch.lines.map((line) => line.materialId));
      order.data = { ...order.data, ...patch }; order.markModified('data'); await order.save();
      res.json(serialize(order));
    } catch (error) { fail(res, error); }
  });
  router.post('/purchases/:id/order', async (req, res) => {
    try {
      const idempotencyKey = String(req.body?.idempotencyKey || req.body?.id || '').trim();
      const result = await inTransaction(async (session) => {
        const order = await getOrder(req.params.id, session);
        if (order.data.status === 'ordered') {
          if (!idempotencyKey || !order.data.orderIdempotencyKey || order.data.orderIdempotencyKey === idempotencyKey) {
            return { ...serialize(order), duplicate: true };
          }
          throw new InventoryValidationError('Only a draft purchase order can be ordered.', 409);
        }
        if (order.data.status !== 'draft') throw new InventoryValidationError('Only a draft purchase order can be ordered.', 409);
        order.data.status = 'ordered';
        if (idempotencyKey) order.data.orderIdempotencyKey = idempotencyKey;
        order.markModified('data');
        await order.save({ session });
        return { ...serialize(order), duplicate: false };
      });
      res.json(result);
    } catch (error) { fail(res, error); }
  });
  router.post('/purchases/:id/cancel', async (req, res) => {
    try {
      const order = await getOrder(req.params.id);
      if (!['draft', 'ordered'].includes(order.data.status) || order.data.lines.some((line) => Number(line.receivedQty || 0) > 0)) throw new InventoryValidationError('This purchase order can no longer be cancelled.', 409);
      order.data.status = 'cancelled'; order.markModified('data'); await order.save(); res.json(serialize(order));
    } catch (error) { fail(res, error); }
  });
  router.post('/purchases/:id/pay', async (req, res) => {
    try {
      const paymentId = String(req.body?.paymentId || req.body?.id || req.body?.idempotencyKey || '').trim();
      if (!paymentId) throw new InventoryValidationError('A payment ID is required.');
      const amount = toUnitCost(req.body?.amount, 'Payment amount', { optional: false });
      if (amount <= 0) throw new InventoryValidationError('Payment amount must be greater than zero.');
      const date = String(req.body?.date || today()).trim();

      const result = await inTransaction(async (session) => {
        const order = await getOrder(req.params.id, session);
        const payments = Array.isArray(order.data.payments) ? [...order.data.payments] : [];
        const prior = payments.find((item) => item.id === paymentId || item.idempotencyKey === paymentId);
        if (prior) {
          if (Math.abs(Number(prior.amount) - amount) > 0.0001) {
            throw new InventoryValidationError('This payment ID was already used with different payment details.', 409);
          }
          return { ...serialize(order), duplicate: true, payment: prior };
        }

        if (!['received', 'paid'].includes(order.data.status)) throw new InventoryValidationError('A purchase can be paid after all items are received.', 409);
        const currentPaid = Number(order.data.paidAmount || 0);
        const subtotal = Number(order.data.subtotal || 0);
        if (currentPaid + amount > subtotal + 0.0001) throw new InventoryValidationError('Payment cannot exceed the remaining balance.');

        const supplier = await find('suppliers', order.data.supplierId, session);
        const supplierName = supplier?.data?.name || 'Supplier';

        let expense = await BusinessRecord.findOne({ resource: 'expenses', 'data.purchasePaymentId': paymentId }).session(session);
        const expenseData = {
          name: `Purchase payment ${order.data.number || order._id} - ${supplierName}`,
          category: 'Purchases',
          amount,
          date,
          purchaseOrderId: order._id.toString(),
          purchasePaymentId: paymentId,
          expenseKind: 'purchase-payment'
        };
        if (expense) {
          expense.data = { ...expense.data, ...expenseData };
          expense.updatedAt = new Date();
          await expense.save({ session });
        } else {
          [expense] = await BusinessRecord.create([{ resource: 'expenses', data: expenseData }], { session });
        }

        const paymentRecord = {
          id: paymentId,
          amount,
          date,
          createdAt: new Date(),
          expenseId: expense._id.toString()
        };
        payments.push(paymentRecord);
        order.data.payments = payments;
        order.data.paidAmount = Math.round(payments.reduce((sum, p) => sum + Number(p.amount || 0), 0) * 10000) / 10000;
        order.data.status = order.data.paidAmount >= subtotal ? 'paid' : 'received';
        order.markModified('data');
        await order.save({ session });

        return { ...serialize(order), duplicate: false, payment: paymentRecord };
      });
      res.json(result);
    } catch (error) { fail(res, error); }
  });
  router.post('/purchases/:id/receive', async (req, res) => {
    try {
      const result = await inTransaction(async (session) => {
        const order = await getOrder(req.params.id, session);
        const requestKey = String(req.body?.idempotencyKey || '').trim();
        const prior = (order.data.receipts || []).find((item) => item.idempotencyKey === requestKey);
        if (prior) return { ...serialize(order), duplicate: true, receipt: prior };
        if (!['ordered', 'partially_received'].includes(order.data.status)) throw new InventoryValidationError('Only ordered purchase orders can receive stock.', 409);
        const receipt = validateReceipt(req.body, order.data.lines);
        const batchId = new mongoose.Types.ObjectId().toString();
        const batch = await recordPurchaseReceipt({ BusinessRecord, session, order, receipt, receiptId: batchId });
        await recordSupplierPrices(BusinessRecord, session, { supplierId: order.data.supplierId, purchaseId: order._id.toString(), receipt, batch });
        order.markModified('data'); await order.save({ session });
        return { ...serialize(order), duplicate: false, receipt: batch };
      });
      res.status(result.duplicate ? 200 : 201).json(result);
    } catch (error) { fail(res, error); }
  });
  router.post('/purchases/:id/receipts/:receiptId/reverse', async (req, res) => {
    try {
      const reason = String(req.body?.reason || '').trim();
      if (!reason || reason.length > 500) throw new InventoryValidationError('Enter a reversal reason up to 500 characters.');
      const result = await inTransaction(async (session) => {
        const order = await getOrder(req.params.id, session);
        const receipt = (order.data.receipts || []).find((item) => item.id === req.params.receiptId);
        if (!receipt) throw new InventoryValidationError('Receipt not found.', 404);
        if (receipt.reversedAt) return { ...serialize(order), duplicate: true };
        if (order.data.status === 'paid') throw new InventoryValidationError('Reverse the payment before reversing a fully paid receipt.', 409);
        await reversePurchaseReceipt({ BusinessRecord, session, order, receipt, reason, date: today() });
        order.markModified('data'); await order.save({ session });
        return { ...serialize(order), duplicate: false };
      });
      res.json(result);
    } catch (error) { fail(res, error); }
  });
  return router;
}

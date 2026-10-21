import { InventoryValidationError, applyStockMovement, toQuantity, toUnitCost, validateBusinessDate } from './inventory.js';

const text = (value, label, max = 160) => {
  const result = String(value ?? '').trim();
  if (result.length > max) throw new InventoryValidationError(`${label} must be ${max} characters or fewer.`);
  return result;
};
const idPattern = /^[a-f\d]{24}$/i;
const roundMoney = (value) => Math.round((value + Number.EPSILON) * 10000) / 10000;

export function validateSupplier(input, { partial = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InventoryValidationError('Supplier data must be an object.');
  const result = {};
  if (!partial || Object.hasOwn(input, 'name')) {
    result.name = text(input.name, 'Supplier name', 120);
    if (!result.name) throw new InventoryValidationError('Enter a supplier name.');
  }
  for (const field of ['contact', 'email', 'phone', 'notes']) if (!partial || Object.hasOwn(input, field)) result[field] = text(input[field], field, field === 'notes' ? 2000 : 160);
  if (!partial || Object.hasOwn(input, 'leadTimeDays')) {
    const raw = input.leadTimeDays;
    const days = raw === '' || raw === null || raw === undefined ? 0 : Number(raw);
    if (!Number.isInteger(days) || days < 0 || days > 3650) throw new InventoryValidationError('Lead time must be a whole number of days from 0 to 3650.');
    result.leadTimeDays = days;
  }
  if (!partial || Object.hasOwn(input, 'status')) {
    result.status = String(input.status ?? 'active').trim().toLowerCase();
    if (!['active', 'inactive'].includes(result.status)) throw new InventoryValidationError('Supplier status must be active or inactive.');
  }
  if (!partial || Object.hasOwn(input, 'suppliedMaterialIds')) {
    const ids = input.suppliedMaterialIds ?? [];
    if (!Array.isArray(ids) || ids.some((id) => !idPattern.test(String(id)))) throw new InventoryValidationError('Choose valid materials supplied by this supplier.');
    result.suppliedMaterialIds = [...new Set(ids.map(String))];
  }
  return result;
}

export function validatePurchaseOrder(input, { partial = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InventoryValidationError('Purchase order data must be an object.');
  const result = {};
  if (!partial || Object.hasOwn(input, 'supplierId')) {
    result.supplierId = String(input.supplierId ?? '');
    if (!idPattern.test(result.supplierId)) throw new InventoryValidationError('Choose a valid supplier.');
  }
  if (!partial || Object.hasOwn(input, 'orderDate')) result.orderDate = validateBusinessDate(input.orderDate || new Date().toISOString().slice(0, 10));
  if (!partial || Object.hasOwn(input, 'expectedDate')) result.expectedDate = input.expectedDate ? validateBusinessDate(input.expectedDate) : '';
  if (!partial || Object.hasOwn(input, 'notes')) result.notes = text(input.notes, 'Notes', 2000);
  if (!partial || Object.hasOwn(input, 'lines')) {
    if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 200) throw new InventoryValidationError('Add between 1 and 200 purchase lines.');
    result.lines = input.lines.map((line) => {
      if (!line || !idPattern.test(String(line.materialId ?? ''))) throw new InventoryValidationError('Choose a valid material for every line.');
      return {
        materialId: String(line.materialId),
        qty: toQuantity(line.qty, 'Ordered quantity', { positive: true }),
        unitCost: toUnitCost(line.unitCost, 'Unit cost'),
        receivedQty: 0
      };
    });
    result.subtotal = roundMoney(result.lines.reduce((sum, line) => sum + line.qty * line.unitCost, 0));
  }
  return result;
}

export function validateReceipt(input, orderLines) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.lines) || !input.lines.length) throw new InventoryValidationError('Add received quantities for at least one material.');
  const accumulated = new Map();
  for (const line of input.lines) {
    if (!line || !idPattern.test(String(line.materialId ?? ''))) throw new InventoryValidationError('Choose a valid material for every received line.');
    const quantity = toQuantity(line.quantity, 'Received quantity', { positive: true });
    const index = Number.isInteger(line.lineIndex) ? line.lineIndex : orderLines.findIndex((item) => item.materialId === String(line.materialId));
    const orderLine = orderLines[index];
    if (!orderLine || orderLine.materialId !== String(line.materialId)) throw new InventoryValidationError('A received material is not on this purchase order.');
    const previous = accumulated.get(index);
    accumulated.set(index, { lineIndex: index, materialId: String(line.materialId), quantity: (previous?.quantity || 0) + quantity });
  }
  const receiveLines = [...accumulated.values()];
  for (const line of receiveLines) {
    const orderLine = orderLines[line.lineIndex];
    if (line.quantity > roundMoney(Number(orderLine.qty) - Number(orderLine.receivedQty || 0))) throw new InventoryValidationError('Received quantity cannot exceed the ordered quantity remaining.');
  }
  const key = text(input.idempotencyKey, 'Receipt key', 120);
  if (!key) throw new InventoryValidationError('A receipt request key is required.');
  const date = input.date ? validateBusinessDate(input.date) : new Date().toISOString().slice(0, 10);
  return { idempotencyKey: key, date, lines: receiveLines };
}

export function purchaseStatus(lines, paidAmount = 0, subtotal = 0) {
  if (Number(subtotal) > 0 && Number(paidAmount) >= Number(subtotal) && lines.every((line) => Number(line.receivedQty || 0) >= Number(line.qty))) return 'paid';
  if (lines.every((line) => Number(line.receivedQty || 0) >= Number(line.qty))) return 'received';
  if (lines.some((line) => Number(line.receivedQty || 0) > 0)) return 'partially_received';
  return 'ordered';
}

export function buildReorderSuggestions(materials, suppliers, prices) {
  const supplierById = new Map(suppliers.filter((row) => String(row.data.status || 'active') !== 'inactive').map((row) => [row._id.toString(), row]));
  const activeSuppliers = [...supplierById.values()].sort((a, b) => String(a.data.name).localeCompare(String(b.data.name)));
  const latestPrices = new Map();
  for (const row of prices.slice().sort((a, b) => String(b.data.effectiveDate).localeCompare(String(a.data.effectiveDate)) || b.createdAt - a.createdAt)) {
    const key = `${row.data.materialId}:${row.data.supplierId}`;
    if (!latestPrices.has(key)) latestPrices.set(key, Number(row.data.unitCost));
  }
  return materials.filter((row) => row.data.active !== false && Number(row.data.quantity || 0) <= Number(row.data.reorderLevel || 0)).map((row) => {
    const materialId = row._id.toString();
    let supplier = supplierById.get(String(row.data.supplierId || ''));
    if (!supplier) supplier = activeSuppliers.find((candidate) => (candidate.data.suppliedMaterialIds || []).includes(materialId));
    const quantity = Number(row.data.quantity || 0);
    const reorderLevel = Number(row.data.reorderLevel || 0);
    const targetQuantity = Math.max(reorderLevel * 2, reorderLevel + 1);
    const supplierId = supplier?._id.toString() || '';
    const latestUnitCost = supplierId ? latestPrices.get(`${materialId}:${supplierId}`) : undefined;
    return {
      ...row.data, id: materialId, preferredSupplierId: supplierId,
      preferredSupplierName: supplier?.data.name || row.data.supplierNameSnapshot || 'No supplier assigned',
      targetQuantity, suggestedQty: Math.round(Math.max(targetQuantity - quantity, 0) * 1000) / 1000,
      latestUnitCost: Number.isFinite(latestUnitCost) ? latestUnitCost : Number(row.data.avgCost || 0)
    };
  }).sort((a, b) => a.preferredSupplierName.localeCompare(b.preferredSupplierName) || a.name.localeCompare(b.name));
}

export function getRecordData(record) { return record?.data || record; }

export async function recordPurchaseReceipt({ BusinessRecord, session, order, receipt, receiptId, applyMovement = applyStockMovement }) {
  const movements = [];
  for (const line of receipt.lines) {
    const orderLine = order.data.lines[line.lineIndex];
    const posted = await applyMovement(BusinessRecord, session, line.materialId, {
      type: 'purchase_in', quantity: line.quantity, unitCost: orderLine.unitCost, date: receipt.date,
      referenceType: 'purchase-order', referenceId: order._id.toString(),
      idempotencyKey: `${receipt.idempotencyKey}:${line.lineIndex}`,
      note: `Received against ${order.data.number}`,
      extraData: { purchaseOrderId: order._id.toString(), receiptKey: receipt.idempotencyKey, lineIndex: line.lineIndex }
    });
    movements.push({ movementId: posted.movement._id.toString(), lineIndex: line.lineIndex, materialId: line.materialId, quantity: line.quantity, unitCost: orderLine.unitCost });
    orderLine.receivedQty = Math.round((Number(orderLine.receivedQty || 0) + line.quantity) * 1000) / 1000;
  }
  const batch = { id: receiptId, idempotencyKey: receipt.idempotencyKey, date: receipt.date, movements, receivedAt: new Date().toISOString() };
  order.data.receipts = [...(order.data.receipts || []), batch];
  order.data.status = purchaseStatus(order.data.lines, order.data.paidAmount, order.data.subtotal);
  return batch;
}

export async function recordSupplierPrices(BusinessRecord, session, { supplierId, purchaseId, receipt, batch }) {
  const rows = batch.movements.map((movement) => ({
    resource: 'supplier-prices',
    data: {
      materialId: movement.materialId, supplierId, unitCost: movement.unitCost,
      effectiveDate: receipt.date, sourcePurchaseId: purchaseId,
      sourceReceiptId: batch.id,
      idempotencyKey: `supplier-price:${purchaseId}:${receipt.idempotencyKey}:${movement.lineIndex}`
    },
    createdAt: new Date(), updatedAt: new Date()
  }));
  if (rows.length) return BusinessRecord.create(rows, { session });
  return [];
}

export async function reversePurchaseReceipt({ BusinessRecord, session, order, receipt, reason, date, applyMovement = applyStockMovement }) {
  const reversalMovementIds = [];
  for (const movementRef of receipt.movements) {
    const query = BusinessRecord.findOne({ _id: movementRef.movementId, resource: 'stock-movements' });
    const original = await query.session(session);
    if (!original) throw new InventoryValidationError('A stock movement for this receipt is missing.', 409);
    const posted = await applyMovement(BusinessRecord, session, movementRef.materialId, {
      type: 'reversal', change: -Number(original.data.change), unitCost: original.data.unitCost, date,
      referenceType: 'purchase-receipt-reversal', referenceId: receipt.id,
      idempotencyKey: `reverse:${original.data.idempotencyKey}`, note: reason,
      extraData: { purchaseOrderId: order._id.toString(), originalMovementId: movementRef.movementId, receiptId: receipt.id }
    });
    reversalMovementIds.push(posted.movement._id.toString());
    const line = order.data.lines[movementRef.lineIndex];
    line.receivedQty = Math.max(0, Math.round((Number(line.receivedQty || 0) - Number(movementRef.quantity)) * 1000) / 1000);
  }
  receipt.reversedAt = new Date().toISOString(); receipt.reversalReason = reason; receipt.reversalMovementIds = reversalMovementIds;
  order.data.status = purchaseStatus(order.data.lines, order.data.paidAmount, order.data.subtotal);
  return reversalMovementIds;
}

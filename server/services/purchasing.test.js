import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReorderSuggestions, recordPurchaseReceipt, recordSupplierPrices, reversePurchaseReceipt, validatePurchaseOrder, validateReceipt } from './purchasing.js';

const materialId = '507f1f77bcf86cd799439011';
function fixture(qty = 0) {
  const state = { stock: qty, movements: [] };
  const order = { _id: { toString: () => '507f191e810c19729de860ea' }, data: {
    number: 'PO-000001', status: 'ordered', paidAmount: 0, subtotal: 20, receipts: [],
    lines: [{ materialId, qty: 10, unitCost: 2, receivedQty: 0 }]
  } };
  const applyMovement = async (_model, _session, id, input) => {
    const change = input.type === 'reversal' ? Number(input.change) : Number(input.quantity);
    state.stock += change;
    const movementId = `movement-${state.movements.length + 1}`;
    const movement = { _id: { toString: () => movementId }, data: { ...input, change, materialId: id } };
    state.movements.push(movement);
    return { movement };
  };
  return { state, order, applyMovement };
}
const receipt = (quantity, idempotencyKey = 'receipt-1') => ({ idempotencyKey, date: '2026-10-21', lines: [{ lineIndex: 0, materialId, quantity }] });

test('receiving a purchase order increases stock and logs the purchase movement', async () => {
  const { state, order, applyMovement } = fixture(3);
  const batch = await recordPurchaseReceipt({ BusinessRecord: {}, session: {}, order, receipt: receipt(4), receiptId: 'batch-1', applyMovement });
  assert.equal(state.stock, 7);
  assert.equal(state.movements.length, 1);
  assert.equal(state.movements[0].data.type, 'purchase_in');
  assert.equal(batch.movements[0].movementId, 'movement-1');
  assert.equal(order.data.lines[0].receivedQty, 4);
  assert.equal(order.data.status, 'partially_received');
});

test('partial receipt records only the received quantity', async () => {
  const { state, order, applyMovement } = fixture(1);
  await recordPurchaseReceipt({ BusinessRecord: {}, session: {}, order, receipt: receipt(2), receiptId: 'batch-1', applyMovement });
  assert.equal(state.stock, 3);
  assert.equal(order.data.lines[0].receivedQty, 2);
  assert.equal(order.data.status, 'partially_received');
});

test('reversing a receipt posts an opposite movement and restores the received quantity', async () => {
  const { state, order, applyMovement } = fixture(0);
  const batch = await recordPurchaseReceipt({ BusinessRecord: {}, session: {}, order, receipt: receipt(5), receiptId: 'batch-1', applyMovement });
  const original = state.movements[0];
  const BusinessRecord = { findOne: () => ({ session: async () => original }) };
  const reversalMovementIds = await reversePurchaseReceipt({ BusinessRecord, session: {}, order, receipt: batch, reason: 'Wrong delivery', date: '2026-10-21', applyMovement });
  assert.equal(state.stock, 0);
  assert.equal(state.movements.length, 2);
  assert.equal(state.movements[1].data.type, 'reversal');
  assert.deepEqual(reversalMovementIds, ['movement-2']);
  assert.equal(order.data.lines[0].receivedQty, 0);
  assert.equal(order.data.status, 'ordered');
});

test('purchase validation rejects invalid IDs and over-receiving', () => {
  assert.throws(() => validatePurchaseOrder({ supplierId: 'nope', orderDate: '2026-10-21', lines: [{ materialId, qty: 1, unitCost: 1 }] }));
  const lines = [{ materialId, qty: 2, receivedQty: 1 }];
  assert.throws(() => validateReceipt({ idempotencyKey: 'x', lines: [{ materialId, quantity: 2 }] }, lines));
  assert.throws(() => validateReceipt({ idempotencyKey: 'x', lines: [{ materialId, quantity: 1 }, { materialId, quantity: 1 }] }, [{ materialId, qty: 1, receivedQty: 0 }]));
});

test('receipt creates a supplier price history row linked to its PO and receipt', async () => {
  let rows;
  const BusinessRecord = { create: async (documents) => { rows = documents; return documents; } };
  const batch = { id: 'receipt-batch-1', movements: [{ materialId, unitCost: 2.5, lineIndex: 0 }] };
  await recordSupplierPrices(BusinessRecord, {}, { supplierId: '507f1f77bcf86cd799439012', purchaseId: '507f191e810c19729de860ea', receipt: receipt(2), batch });
  assert.equal(rows[0].resource, 'supplier-prices');
  assert.equal(rows[0].data.materialId, materialId);
  assert.equal(rows[0].data.unitCost, 2.5);
  assert.equal(rows[0].data.sourcePurchaseId, '507f191e810c19729de860ea');
  assert.equal(rows[0].data.sourceReceiptId, 'receipt-batch-1');
});

test('reorder suggestions use the material reorder level and preferred supplier price', () => {
  const supplierId = '507f1f77bcf86cd799439012';
  const suggestions = buildReorderSuggestions(
    [{ _id: { toString: () => materialId }, data: { name: 'Vinyl', quantity: 2, reorderLevel: 5, avgCost: 3, supplierId } }],
    [{ _id: { toString: () => supplierId }, data: { name: 'Acme', status: 'active' } }],
    [{ data: { materialId, supplierId, unitCost: 4, effectiveDate: '2026-10-20' }, createdAt: new Date() }]
  );
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].suggestedQty, 8);
  assert.equal(suggestions[0].preferredSupplierId, supplierId);
  assert.equal(suggestions[0].latestUnitCost, 4);
});

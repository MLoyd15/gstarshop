import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMaterialCosts, calculateProductCost, validateProduct } from './products.js';

const materialA = '507f1f77bcf86cd799439011';
const materialB = '507f1f77bcf86cd799439012';

test('product cost and margin sum recipe quantities at current material costs', () => {
  const result = calculateProductCost([
    { materialId: materialA, qtyPerUnit: 2 },
    { materialId: materialB, qtyPerUnit: 1 }
  ], new Map([[materialA, 4], [materialB, 3]]), 20);
  assert.equal(result.unitCost, 11);
  assert.equal(result.marginAmount, 9);
  assert.equal(result.marginPercent, 45);
  assert.equal(result.recipe[0].lineCost, 8);
});

test('current material cost prefers the latest supplier price and falls back to average cost', () => {
  const costs = buildMaterialCosts(
    [
      { _id: { toString: () => materialA }, data: { avgCost: 3 } },
      { _id: { toString: () => materialB }, data: { avgCost: 5 } }
    ],
    [
      { data: { materialId: materialA, unitCost: 6, effectiveDate: '2026-10-20' }, createdAt: new Date('2026-10-20') },
      { data: { materialId: materialA, unitCost: 7, effectiveDate: '2026-10-21' }, createdAt: new Date('2026-10-21') }
    ]
  );
  assert.equal(costs.get(materialA), 7);
  assert.equal(costs.get(materialB), 5);
});

test('product validation requires supported categories and unique material recipe lines', () => {
  assert.throws(() => validateProduct({ name: 'Test', sku: 'T1', category: 'Other', unit: 'pc', sellPrice: 10, recipe: [] }));
  assert.throws(() => validateProduct({ name: 'Test', sku: 'T1', category: 'Sticker', unit: 'pc', sellPrice: 10, recipe: [
    { materialId: materialA, qtyPerUnit: 1 }, { materialId: materialA, qtyPerUnit: 2 }
  ] }));
});

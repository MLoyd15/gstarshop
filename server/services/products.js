import { InventoryValidationError, toQuantity, toUnitCost } from './inventory.js';

const idPattern = /^[a-f\d]{24}$/i;
const categories = new Set(['Sticker', 'Cap', 'Mug', 'Tarpaulin']);
const text = (value, label, max = 120) => {
  const result = String(value ?? '').trim();
  if (result.length > max) throw new InventoryValidationError(`${label} must be ${max} characters or fewer.`);
  return result;
};
const round = (value) => Math.round((value + Number.EPSILON) * 10000) / 10000;

export function validateProduct(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InventoryValidationError('Product data must be an object.');
  const name = text(input.name, 'Product name');
  if (!name) throw new InventoryValidationError('Enter a product name.');
  const sku = text(input.sku, 'SKU', 80);
  if (!sku) throw new InventoryValidationError('Enter a SKU.');
  const category = text(input.category, 'Category', 40);
  if (!categories.has(category)) throw new InventoryValidationError('Choose Sticker, Cap, Mug, or Tarpaulin.');
  const unit = text(input.unit, 'Unit', 24).toLowerCase();
  if (!unit) throw new InventoryValidationError('Enter a sales unit.');
  const sellPrice = toUnitCost(input.sellPrice, 'Sell price');
  if (sellPrice <= 0) throw new InventoryValidationError('Sell price must be greater than zero.');
  const sourceRecipe = input.recipe ?? [];
  if (!Array.isArray(sourceRecipe) || sourceRecipe.length > 100) throw new InventoryValidationError('A recipe must have no more than 100 material lines.');
  const used = new Set();
  const recipe = sourceRecipe.map((line, index) => {
    const materialId = String(line?.materialId ?? '');
    if (!idPattern.test(materialId)) throw new InventoryValidationError(`Choose a valid material for recipe line ${index + 1}.`);
    if (used.has(materialId)) throw new InventoryValidationError('A material can appear only once in a product recipe.');
    used.add(materialId);
    return { materialId, qtyPerUnit: toQuantity(line.qtyPerUnit, `Quantity per unit on line ${index + 1}`, { positive: true }) };
  });
  return { name, sku, category, unit, sellPrice, recipe };
}

export function calculateProductCost(recipe, materialCosts, sellPrice) {
  const lines = recipe.map((line) => {
    const cost = Number(materialCosts instanceof Map ? materialCosts.get(line.materialId) : materialCosts[line.materialId]);
    const unitCost = Number.isFinite(cost) && cost >= 0 ? cost : 0;
    return { ...line, unitCost, lineCost: round(Number(line.qtyPerUnit) * unitCost) };
  });
  const unitCost = round(lines.reduce((sum, line) => sum + line.lineCost, 0));
  const price = Number(sellPrice) || 0;
  const marginAmount = round(price - unitCost);
  const marginPercent = price > 0 ? round((marginAmount / price) * 100) : 0;
  return { recipe: lines, unitCost, marginAmount, marginPercent };
}

export function buildMaterialCosts(materials, prices) {
  const latest = new Map();
  const sortTime = (row) => new Date(row.createdAt || 0).getTime();
  for (const row of prices.slice().sort((a, b) => String(b.data.effectiveDate).localeCompare(String(a.data.effectiveDate)) || sortTime(b) - sortTime(a))) {
    if (!latest.has(row.data.materialId)) latest.set(row.data.materialId, Number(row.data.unitCost));
  }
  return new Map(materials.map((row) => {
    const id = row._id.toString();
    return [id, latest.get(id) ?? Number(row.data.avgCost || 0)];
  }));
}

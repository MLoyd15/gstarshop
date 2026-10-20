const QUANTITY_SCALE = 1000;
const MONEY_SCALE = 10000;
const WIDTH_UNITS = new Set(['mm', 'cm', 'm', 'in', 'ft']);
export const MOVEMENT_TYPES = new Set(['opening', 'purchase_in', 'job_use', 'waste', 'adjustment', 'return_in', 'reversal']);

export class InventoryValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'InventoryValidationError';
    this.status = status;
  }
}

export function toQuantity(value, label = 'Quantity', { optional = false, positive = false } = {}) {
  if ((value === '' || value === null || value === undefined) && optional) return 0;
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,3})?$/.test(text)) throw new InventoryValidationError(`${label} must be a non-negative quantity with no more than three decimal places.`);
  const milli = Math.round(Number(text) * QUANTITY_SCALE);
  if (!Number.isSafeInteger(milli)) throw new InventoryValidationError(`${label} is too large.`);
  if (positive && milli <= 0) throw new InventoryValidationError(`${label} must be greater than zero.`);
  return milli / QUANTITY_SCALE;
}

export function toUnitCost(value, label = 'Unit cost', { optional = false } = {}) {
  if ((value === '' || value === null || value === undefined) && optional) return 0;
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,4})?$/.test(text)) throw new InventoryValidationError(`${label} must be a non-negative amount with no more than four decimal places.`);
  const scaled = Math.round(Number(text) * MONEY_SCALE);
  if (!Number.isSafeInteger(scaled)) throw new InventoryValidationError(`${label} is too large.`);
  return scaled / MONEY_SCALE;
}

const optionalText = (value, label, max = 120) => {
  const text = String(value ?? '').trim();
  if (text.length > max) throw new InventoryValidationError(`${label} must be ${max} characters or fewer.`);
  return text;
};

export function validateMaterial(data, { partial = false } = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new InventoryValidationError('Material data must be an object.');
  if (['quantity', 'avgCost', 'stock'].some((key) => Object.hasOwn(data, key))) {
    throw new InventoryValidationError('Quantity and average cost can only be changed through a stock movement.');
  }
  const result = {};
  if (!partial || Object.hasOwn(data, 'name')) {
    result.name = optionalText(data.name, 'Name', 120);
    if (!result.name) throw new InventoryValidationError('Enter a material name.');
  }
  if (!partial || Object.hasOwn(data, 'category')) result.category = optionalText(data.category, 'Category', 80);
  if (!partial || Object.hasOwn(data, 'unit')) {
    result.unit = optionalText(data.unit, 'Base unit', 24).toLowerCase();
    if (!result.unit) throw new InventoryValidationError('Choose a base unit.');
  }
  if (!partial || Object.hasOwn(data, 'rollWidth')) {
    result.rollWidth = toQuantity(data.rollWidth, 'Roll width', { optional: true, positive: true });
  }
  if (!partial || Object.hasOwn(data, 'rollWidthUnit')) {
    result.rollWidthUnit = optionalText(data.rollWidthUnit, 'Roll width unit', 8).toLowerCase();
    if (result.rollWidthUnit && !WIDTH_UNITS.has(result.rollWidthUnit)) throw new InventoryValidationError('Roll width unit must be mm, cm, m, in, or ft.');
  }
  if (result.rollWidth > 0 && !result.rollWidthUnit) throw new InventoryValidationError('Choose a unit for the roll width.');
  if (!partial || Object.hasOwn(data, 'reorderLevel')) result.reorderLevel = toQuantity(data.reorderLevel, 'Reorder level', { optional: true });
  if (!partial || Object.hasOwn(data, 'supplierId')) result.supplierId = optionalText(data.supplierId, 'Supplier ID', 64);
  if (!partial || Object.hasOwn(data, 'supplierNameSnapshot')) result.supplierNameSnapshot = optionalText(data.supplierNameSnapshot, 'Supplier name', 120);
  if (!partial || Object.hasOwn(data, 'active')) {
    result.active = data.active === undefined ? true : data.active === true || data.active === 'true';
  }
  return result;
}

export function validateBusinessDate(value) {
  const date = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new InventoryValidationError('Enter a date in YYYY-MM-DD format.');
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new InventoryValidationError('Enter a valid date.');
  }
  return date;
}

const roundQuantity = (value) => Math.round((value + Number.EPSILON) * QUANTITY_SCALE) / QUANTITY_SCALE;
const roundCost = (value) => Math.round((value + Number.EPSILON) * MONEY_SCALE) / MONEY_SCALE;

export async function applyStockMovement(BusinessRecord, session, materialId, input) {
  const existing = input.idempotencyKey
    ? await BusinessRecord.findOne({ resource: 'stock-movements', 'data.idempotencyKey': input.idempotencyKey }).session(session).lean()
    : null;
  if (existing) return { movement: existing, material: null, duplicate: true };

  const material = await BusinessRecord.findOne({ _id: materialId, resource: 'materials' }).session(session);
  if (!material) throw new InventoryValidationError('Material not found.', 404);
  const oldQuantity = Number(material.data.quantity || 0);
  const oldAverage = Number(material.data.avgCost || 0);
  let change;
  let unitCost = oldAverage;

  if (input.type === 'adjustment') {
    const counted = toQuantity(input.countedQuantity, 'Counted quantity');
    change = roundQuantity(counted - oldQuantity);
    if (!change) throw new InventoryValidationError('The counted quantity matches the current balance.');
  } else if (input.type === 'reversal') {
    change = roundQuantity(Number(input.change));
    if (!change) throw new InventoryValidationError('A reversal must change stock.');
    unitCost = toUnitCost(input.unitCost, 'Unit cost');
  } else {
    const amount = toQuantity(input.quantity, 'Quantity', { positive: true });
    change = ['opening', 'purchase_in', 'return_in'].includes(input.type) ? amount : -amount;
  }

  if (input.type === 'opening') {
    const prior = await BusinessRecord.findOne({ resource: 'stock-movements', 'data.materialId': materialId.toString() }).session(session).lean();
    if (oldQuantity !== 0 || prior) throw new InventoryValidationError('Opening stock can only be recorded before any other movement.', 409);
    unitCost = toUnitCost(input.unitCost, 'Unit cost');
  } else if (input.type === 'purchase_in') {
    unitCost = toUnitCost(input.unitCost, 'Unit cost');
  } else if (input.type === 'return_in' && input.unitCost !== undefined && input.unitCost !== '') {
    unitCost = toUnitCost(input.unitCost, 'Unit cost');
  }

  if (change < 0 && oldQuantity < Math.abs(change)) throw new InventoryValidationError(`Not enough stock. Current balance is ${oldQuantity} ${material.data.unit}.`, 409);
  const newQuantity = roundQuantity(oldQuantity + change);
  let newAverage = oldAverage;
  if (change > 0 && ['opening', 'purchase_in', 'return_in', 'adjustment', 'reversal'].includes(input.type)) {
    newAverage = newQuantity ? roundCost(((oldQuantity * oldAverage) + (change * unitCost)) / newQuantity) : 0;
  }
  const updated = await BusinessRecord.findOneAndUpdate(
    { _id: materialId, resource: 'materials', ...(change < 0 ? { 'data.quantity': { $gte: Math.abs(change) } } : {}) },
    { $inc: { 'data.quantity': change }, $set: { 'data.avgCost': newAverage, updatedAt: new Date() } },
    { new: true, session }
  ).lean();
  if (!updated) throw new InventoryValidationError('Stock changed while this action was being saved. Refresh the material and try again.', 409);

  const now = new Date();
  const movementData = {
    ...(input.extraData || {}),
    materialId: materialId.toString(), materialName: material.data.name, type: input.type,
    change, balanceAfter: newQuantity, unitCost,
    totalCost: roundCost(Math.abs(change) * unitCost),
    referenceType: input.referenceType || '', referenceId: input.referenceId || '',
    note: input.note || '', date: input.date, idempotencyKey: input.idempotencyKey
  };
  const [movement] = await BusinessRecord.create([{ resource: 'stock-movements', data: movementData, createdAt: now, updatedAt: now }], { session });
  return { movement: movement.toObject(), material: updated, duplicate: false };
}

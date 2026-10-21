import express from 'express';
import { InventoryValidationError } from '../services/inventory.js';
import { buildMaterialCosts, calculateProductCost, validateProduct } from '../services/products.js';

export function createProductsRouter(BusinessRecord, mongoose) {
  const router = express.Router();
  const fail = (res, error) => res.status(error.status || 500).json({ error: error.message || 'Product request failed.' });
  const serialize = (record, data) => ({ ...(data || record.data), id: record._id.toString(), createdAt: record.createdAt, updatedAt: record.updatedAt });

  async function currentCosts() {
    const [materials, prices] = await Promise.all([
      BusinessRecord.find({ resource: 'materials' }).lean(),
      BusinessRecord.find({ resource: 'supplier-prices' }).sort({ 'data.effectiveDate': -1, createdAt: -1 }).lean()
    ]);
    return { materials, costs: buildMaterialCosts(materials, prices) };
  }

  async function validateRecipeMaterials(recipe) {
    const ids = [...new Set(recipe.map((line) => line.materialId))];
    if (!ids.length) return [];
    const materials = await BusinessRecord.find({ _id: { $in: ids }, resource: 'materials', 'data.active': { $ne: false } }).lean();
    if (materials.length !== ids.length) throw new InventoryValidationError('One or more recipe materials are unavailable.', 404);
    return materials;
  }

  async function validateSku(sku, excludeId) {
    const rows = await BusinessRecord.find({ resource: 'products' }).select('_id data.sku').lean();
    if (rows.some((row) => row._id.toString() !== excludeId && String(row.data.sku || '').trim().toLowerCase() === sku.toLowerCase())) {
      throw new InventoryValidationError('That SKU is already used by another product.', 409);
    }
  }

  async function enrich(record, materials, costs) {
    const materialById = new Map(materials.map((material) => [material._id.toString(), material]));
    const legacyRecipe = Array.isArray(record.data.recipe) ? record.data.recipe : [];
    const recipe = legacyRecipe.map((line) => {
      const material = materialById.get(String(line.materialId));
      return { ...line, materialName: material?.data.name || 'Deleted material', unit: material?.data.unit || '', unitCost: costs.get(String(line.materialId)) ?? Number(material?.data.avgCost || 0) };
    });
    const sellPrice = Number(record.data.sellPrice ?? record.data.price ?? 0);
    const computed = calculateProductCost(recipe, costs, sellPrice);
    return serialize(record, {
      ...record.data,
      sellPrice,
      recipe: computed.recipe.map((line, index) => ({ ...line, materialName: recipe[index]?.materialName, unit: recipe[index]?.unit })),
      unitCost: computed.unitCost, marginAmount: computed.marginAmount, marginPercent: computed.marginPercent
    });
  }

  router.get('/material-costs', async (_req, res) => {
    try {
      const { materials, costs } = await currentCosts();
      res.json(materials.filter((material) => material.data.active !== false).map((material) => ({ ...material.data, id: material._id.toString(), unitCost: costs.get(material._id.toString()) || 0 })));
    } catch (error) { fail(res, error); }
  });

  router.post('/cost-preview', async (req, res) => {
    try {
      const product = validateProduct(req.body);
      const materialRows = await validateRecipeMaterials(product.recipe);
      const { materials, costs } = await currentCosts();
      const calculated = calculateProductCost(product.recipe, costs, product.sellPrice);
      const names = new Map([...materials, ...materialRows].map((row) => [row._id.toString(), { name: row.data.name, unit: row.data.unit }]));
      res.json({ ...calculated, recipe: calculated.recipe.map((line) => ({ ...line, ...names.get(line.materialId) })) });
    } catch (error) { fail(res, error); }
  });

  router.get('/', async (_req, res) => {
    try {
      const records = await BusinessRecord.find({ resource: 'products' }).sort({ updatedAt: -1 }).lean();
      const { materials, costs } = await currentCosts();
      res.json(await Promise.all(records.map((record) => enrich(record, materials, costs))));
    } catch (error) { fail(res, error); }
  });

  router.post('/', async (req, res) => {
    try {
      const data = validateProduct(req.body);
      await validateSku(data.sku);
      await validateRecipeMaterials(data.recipe);
      const { materials, costs } = await currentCosts();
      const computed = calculateProductCost(data.recipe, costs, data.sellPrice);
      data.unitCost = computed.unitCost; data.marginAmount = computed.marginAmount; data.marginPercent = computed.marginPercent;
      const [record] = await BusinessRecord.create([{ resource: 'products', data }]);
      res.status(201).json(await enrich(record, materials, costs));
    } catch (error) { fail(res, error); }
  });

  router.get('/:id', async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) throw new InventoryValidationError('Product ID is invalid.');
      const record = await BusinessRecord.findOne({ _id: req.params.id, resource: 'products' }).lean();
      if (!record) throw new InventoryValidationError('Product not found.', 404);
      const { materials, costs } = await currentCosts();
      res.json(await enrich(record, materials, costs));
    } catch (error) { fail(res, error); }
  });

  router.patch('/:id', async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) throw new InventoryValidationError('Product ID is invalid.');
      const record = await BusinessRecord.findOne({ _id: req.params.id, resource: 'products' });
      if (!record) throw new InventoryValidationError('Product not found.', 404);
      const data = validateProduct(req.body);
      await validateSku(data.sku, record._id.toString());
      await validateRecipeMaterials(data.recipe);
      const { materials, costs } = await currentCosts();
      const computed = calculateProductCost(data.recipe, costs, data.sellPrice);
      record.data = { ...record.data, ...data, unitCost: computed.unitCost, marginAmount: computed.marginAmount, marginPercent: computed.marginPercent };
      record.markModified('data'); await record.save();
      res.json(await enrich(record, materials, costs));
    } catch (error) { fail(res, error); }
  });

  router.delete('/:id', async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) throw new InventoryValidationError('Product ID is invalid.');
      const record = await BusinessRecord.findOneAndDelete({ _id: req.params.id, resource: 'products' });
      if (!record) throw new InventoryValidationError('Product not found.', 404);
      res.status(204).end();
    } catch (error) { fail(res, error); }
  });

  return router;
}

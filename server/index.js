import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import { createPayrollRouter } from './routes/payroll.js';
import { createInventoryRouter } from './routes/inventory.js';
import { createBookingsRouter } from './routes/bookings.js';
import { createPurchasesRouter } from './routes/purchases.js';
import { createProductsRouter } from './routes/products.js';
import { validateEmployeePayrollData } from './services/payroll.js';

const app = express();
const port = Number(process.env.PORT) || 4000;
const resources = [
  'suppliers', 'products', 'inventory', 'prices', 'purchases', 'purchase-orders', 'purchase-order-counters', 'supplier-prices', 'excel-sheet',
  'scheduler', 'bookings', 'clients', 'income', 'expenses', 'profit', 'shareholders',
  'employees', 'payroll-runs', 'payroll-timesheets', 'materials', 'stock-movements',
  'money-tracker', 'notepad'
];

const businessRecordSchema = new mongoose.Schema({
  resource: { type: String, required: true, enum: resources, index: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

businessRecordSchema.index({ resource: 1, updatedAt: -1 });
businessRecordSchema.index({ resource: 1, 'data.number': 1 }, { unique: true, partialFilterExpression: { resource: 'purchase-orders' } });
businessRecordSchema.index(
  { resource: 1, 'data.idempotencyKey': 1, 'data.sourcePurchaseId': 1 },
  { unique: true, partialFilterExpression: { resource: 'supplier-prices', 'data.idempotencyKey': { $type: 'string' } } }
);
businessRecordSchema.index({ resource: 1, 'data.materialId': 1, 'data.date': -1 });
businessRecordSchema.index({ resource: 1, 'data.referenceType': 1, 'data.referenceId': 1 });
businessRecordSchema.index({ resource: 1, 'data.active': 1, 'data.supplierId': 1 });
businessRecordSchema.index(
  { resource: 1, 'data.idempotencyKey': 1 },
  { unique: true, partialFilterExpression: { resource: 'stock-movements', 'data.idempotencyKey': { $type: 'string' } } }
);
const BusinessRecord = mongoose.model('BusinessRecord', businessRecordSchema);
const inactiveBookingStatuses = ['cancelled', 'canceled', 'complete', 'completed'];

function isOngoingBooking(record) {
  return !inactiveBookingStatuses.includes(String(record.data.status || 'active').trim().toLowerCase());
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.use('/api', (_request, response, next) => {
  if (mongoose.connection.readyState !== 1) {
    return response.status(503).json({
      error: 'MongoDB is not connected. Configure MONGODB_URI and make sure the database is running.'
    });
  }
  next();
});

app.use('/api/payroll', createPayrollRouter(BusinessRecord, mongoose));
app.use('/api/materials', createInventoryRouter(BusinessRecord, mongoose));
app.use('/api/bookings', createBookingsRouter(BusinessRecord, mongoose));
app.use('/api', createPurchasesRouter(BusinessRecord, mongoose));
app.use('/api/products', createProductsRouter(BusinessRecord, mongoose));

app.get('/api/dashboard', async (_request, response, next) => {
  try {
    const records = await BusinessRecord.find().sort({ createdAt: -1 }).lean();
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString('en-US', { month: 'short' }),
        income: 0,
        expenses: 0,
        materialCosts: 0
      };
    });
    const monthByKey = new Map(months.map((month) => [month.key, month]));
    const amountOf = (record) => {
      const amount = Number(record.data.amount);
      return Number.isFinite(amount) ? amount : 0;
    };
    const incomeRecords = records.filter((record) => record.resource === 'income');
    const expenseRecords = records.filter((record) => record.resource === 'expenses');
    const bookings = records.filter((record) => record.resource === 'bookings' && isOngoingBooking(record));
    const costedBookings = records.filter((record) => record.resource === 'bookings' && record.data.completion?.status === 'completed');
    const materials = records.filter((record) => record.resource === 'materials');
    const lowStockMaterials = materials.filter((record) => record.data.active !== false && Number(record.data.quantity || 0) <= Number(record.data.reorderLevel || 0));
    for (const record of [...incomeRecords, ...expenseRecords]) {
      const entryDate = new Date(record.data.date || record.createdAt);
      if (Number.isNaN(entryDate.getTime())) continue;
      const month = monthByKey.get(`${entryDate.getFullYear()}-${entryDate.getMonth()}`);
      if (month) month[record.resource] += amountOf(record);
    }
    for (const record of costedBookings) {
      const completionDate = record.data.completion.completionDate || record.data.completion.completedAt || record.updatedAt;
      const entryDate = new Date(completionDate);
      if (Number.isNaN(entryDate.getTime())) continue;
      const month = monthByKey.get(`${entryDate.getFullYear()}-${entryDate.getMonth()}`);
      if (month) month.materialCosts += Number(record.data.completion.materialCost || 0);
    }

    const recent = records
      .filter((record) => ['income', 'expenses', 'purchases', 'bookings'].includes(record.resource))
      .slice(0, 5)
      .map((record) => ({
        id: record._id.toString(),
        name: record.data.name || record.data.description || record.resource,
        type: record.resource,
        date: record.data.date || record.createdAt,
        amount: amountOf(record)
      }));

    response.json({
      totals: {
        income: incomeRecords.reduce((total, record) => total + amountOf(record), 0),
        expenses: expenseRecords.reduce((total, record) => total + amountOf(record), 0),
        materialCosts: costedBookings.reduce((total, record) => total + Number(record.data.completion.materialCost || 0), 0),
        costedBookings: costedBookings.length,
        incomeEntries: incomeRecords.length,
        expenseEntries: expenseRecords.length,
        bookings: bookings.length,
        clients: records.filter((record) => record.resource === 'clients').length,
        materials: materials.filter((record) => record.data.active !== false).length,
        lowStockMaterials: lowStockMaterials.length,
        suppliers: records.filter((record) => record.resource === 'suppliers').length,
        products: records.filter((record) => record.resource === 'products').length,
        inventory: records.filter((record) => record.resource === 'products').length
      },
      months,
      recent
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/notifications', async (_request, response, next) => {
  try {
    const bookings = await BusinessRecord.find({ resource: 'bookings' }).sort({ createdAt: -1 }).lean();
    const ongoingBookings = bookings.filter(isOngoingBooking).map((record) => ({
      id: record._id.toString(),
      name: record.data.name || record.data.client || 'Untitled booking',
      client: record.data.client || '',
      date: record.data.date || '',
      status: record.data.status || 'Active'
    }));
    response.json({ count: ongoingBookings.length, bookings: ongoingBookings });
  } catch (error) {
    next(error);
  }
});

app.get('/api/records/:resource', async (request, response, next) => {
  if (!resources.includes(request.params.resource)) {
    return response.status(404).json({ error: 'This business area does not exist.' });
  }

  try {
    const records = await BusinessRecord.find({ resource: request.params.resource }).sort({ updatedAt: -1 }).lean();
    response.json(records.map(({ _id, data, createdAt, updatedAt }) => ({
      ...data, id: _id.toString(), createdAt, updatedAt
    })));
  } catch (error) {
    next(error);
  }
});

app.post('/api/records/:resource', async (request, response, next) => {
  if (!resources.includes(request.params.resource)) {
    return response.status(404).json({ error: 'This business area does not exist.' });
  }
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    return response.status(400).json({ error: 'A record must be a JSON object.' });
  }

  try {
    if (['suppliers', 'purchases', 'purchase-orders', 'purchase-order-counters', 'supplier-prices', 'products'].includes(request.params.resource)) return response.status(409).json({ error: 'Use the linked business page to manage these records.' });
    if (['materials', 'stock-movements'].includes(request.params.resource)) return response.status(409).json({ error: 'Use the Materials page to manage materials and stock movements.' });
    if (request.params.resource === 'payroll-timesheets') return response.status(409).json({ error: 'Use the employee monthly sheet to manage work hours and advances.' });
    if (request.params.resource === 'payroll-runs') return response.status(409).json({ error: 'Use the Pay runs page to generate and manage payroll.' });
    let data = request.params.resource === 'employees' ? validateEmployeePayrollData(request.body) : request.body;
    if (request.params.resource === 'bookings') {
      const { materialPlan: _plan, completion: _completion, completionHistory: _history, statusBeforeCompletion: _status, ...bookingFields } = request.body;
      data = { ...bookingFields, materialPlan: [], completion: null, completionHistory: [] };
    }
    const record = await BusinessRecord.create({ resource: request.params.resource, data });
    response.status(201).json({
      ...record.data, id: record._id.toString(),
      createdAt: record.createdAt, updatedAt: record.updatedAt
    });
  } catch (error) {
    if (error.status === 400) return response.status(400).json({ error: error.message });
    next(error);
  }
});

app.patch('/api/records/:resource/:id', async (request, response, next) => {
  if (!resources.includes(request.params.resource)) {
    return response.status(404).json({ error: 'This business area does not exist.' });
  }
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    return response.status(400).json({ error: 'A record must be a JSON object.' });
  }

  try {
    if (['suppliers', 'purchases', 'purchase-orders', 'purchase-order-counters', 'supplier-prices', 'products'].includes(request.params.resource)) return response.status(409).json({ error: 'Use the linked business page to manage these records.' });
    if (['materials', 'stock-movements'].includes(request.params.resource)) return response.status(409).json({ error: 'Use the Materials page to manage materials and stock movements.' });
    if (request.params.resource === 'bookings') return response.status(409).json({ error: 'Use the Bookings page to edit bookings and preserve material history.' });
    if (request.params.resource === 'payroll-timesheets') return response.status(409).json({ error: 'Use the employee monthly sheet to manage work hours and advances.' });
    if (request.params.resource === 'payroll-runs') return response.status(409).json({ error: 'Payroll runs can only be changed through the Pay runs page.' });
    if (request.params.resource === 'expenses') {
      const linked = await BusinessRecord.findOne({ _id: request.params.id, resource: 'expenses' }).lean();
      if (linked?.data?.payrollRunId) return response.status(409).json({ error: 'Payroll linked expenses are managed with their payroll run.' });
    }
    if (request.params.resource === 'employees') request.body = validateEmployeePayrollData(request.body);
    const record = await BusinessRecord.findOneAndUpdate(
      { _id: request.params.id, resource: request.params.resource },
      { $set: { data: request.body, updatedAt: new Date() } },
      { new: true, runValidators: true }
    ).lean();
    if (!record) return response.status(404).json({ error: 'Record not found.' });
    response.json({ ...record.data, id: record._id.toString(), createdAt: record.createdAt, updatedAt: record.updatedAt });
  } catch (error) {
    if (error.status === 400) return response.status(400).json({ error: error.message });
    if (error instanceof mongoose.Error.CastError) {
      return response.status(400).json({ error: 'The record ID is invalid.' });
    }
    next(error);
  }
});

app.delete('/api/records/:resource/:id', async (request, response, next) => {
  if (!resources.includes(request.params.resource)) {
    return response.status(404).json({ error: 'This business area does not exist.' });
  }
  try {
    if (['suppliers', 'purchases', 'purchase-orders', 'purchase-order-counters', 'supplier-prices', 'products'].includes(request.params.resource)) return response.status(409).json({ error: 'Use the linked business page to manage these records.' });
    if (['materials', 'stock-movements'].includes(request.params.resource)) return response.status(409).json({ error: 'Use the Materials page to manage materials and stock movements.' });
    if (request.params.resource === 'bookings') return response.status(409).json({ error: 'Use the Bookings page to delete bookings safely.' });
    if (request.params.resource === 'payroll-timesheets') return response.status(409).json({ error: 'Payroll timesheets are preserved through the employee sheet.' });
    if (request.params.resource === 'payroll-runs') return response.status(409).json({ error: 'Payroll history is preserved; reverse the run instead.' });
    if (request.params.resource === 'expenses') {
      const linked = await BusinessRecord.findOne({ _id: request.params.id, resource: 'expenses' }).lean();
      if (linked?.data?.payrollRunId) return response.status(409).json({ error: 'Payroll linked expenses are managed with their payroll run.' });
    }
    const record = await BusinessRecord.findOneAndDelete({
      _id: request.params.id, resource: request.params.resource
    });
    if (!record) return response.status(404).json({ error: 'Record not found.' });
    response.status(204).end();
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return response.status(400).json({ error: 'The record ID is invalid.' });
    }
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'The request could not be completed. Please try again.' });
});

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch((error) => console.error('Could not connect to MongoDB:', error.message));
} else {
  console.error('MONGODB_URI is not set. Configure it in .env to enable data storage.');
}

app.listen(port, () => console.log(`Business Hub API listening on http://localhost:${port}`));

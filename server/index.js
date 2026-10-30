import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import { createPayrollRouter } from './routes/payroll.js';
import { createInventoryRouter } from './routes/inventory.js';
import { createBookingsRouter } from './routes/bookings.js';
import { createPurchasesRouter } from './routes/purchases.js';
import { createProductsRouter } from './routes/products.js';
import { createAnalyticsRouter } from './routes/analytics.js';
import { validateEmployeePayrollData } from './services/payroll.js';
import { buildDashboardSummary } from './services/dashboard.js';
import { validateFinancialEntry } from './services/financial.js';
import { deriveBookingFinancials } from './services/booking-financials.js';
import { createAuthRouter, requireAuth } from './routes/auth.js';

const app = express();
const port = Number(process.env.PORT) || 4000;
const resources = [
  'suppliers', 'products', 'inventory', 'prices', 'purchases', 'purchase-orders', 'purchase-order-counters', 'supplier-prices', 'excel-sheet',
  'scheduler', 'bookings', 'clients', 'income', 'expenses', 'profit', 'shareholders',
  'employees', 'payroll-runs', 'payroll-timesheets', 'payroll-holidays', 'materials', 'stock-movements',
  'notepad', 'material-categories'
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

function collectSearchableText(value) {
  if (typeof value === 'string' || typeof value === 'number') return [String(value)];
  if (Array.isArray(value)) return value.flatMap(collectSearchableText);
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectSearchableText);
  return [];
}

function isOngoingBooking(record) {
  return !inactiveBookingStatuses.includes(String(record.data.status || 'active').trim().toLowerCase());
}

const allowedOrigins = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((origin) => origin.trim()).filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.use('/api/auth', (_request, response, next) => {
  if (mongoose.connection.readyState !== 1) return response.status(503).json({ error: 'MongoDB is not connected. Configure MONGODB_URI and make sure the database is running.' });
  next();
}, createAuthRouter());
app.use('/api', requireAuth);

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
app.use('/api/analytics', createAnalyticsRouter(BusinessRecord));

app.get('/api/dashboard', async (request, response, next) => {
  try {
    const resourcesForDashboard = ['income', 'expenses', 'bookings', 'payroll-runs', 'clients', 'materials', 'suppliers', 'products', 'purchase-orders'];
    const records = await BusinessRecord.find({ resource: { $in: resourcesForDashboard } }).select('resource data createdAt updatedAt').lean();
    response.json(buildDashboardSummary(records, request.query.period, new Date(), request.query.months));
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

app.get('/api/search', async (request, response, next) => {
  const query = String(request.query.q || '').trim().toLocaleLowerCase();
  if (query.length < 2) return response.json({ results: [] });
  if (query.length > 120) return response.status(400).json({ error: 'Search text must be 120 characters or fewer.' });
  try {
    const excludedResources = ['purchase-order-counters'];
    const records = await BusinessRecord.find({ resource: { $nin: excludedResources } })
      .sort({ updatedAt: -1 }).lean();
    const results = [];
    for (const record of records) {
      const data = record.data || {};
      if (!JSON.stringify(data).toLocaleLowerCase().includes(query)) continue;
      const title = String(data.name || data.title || data.clientName || data.supplierName || data.employee || data.number || data.period || data.description || data.sku || `${record.resource} record`);
      const matchedText = collectSearchableText(data).find((value) => value.toLocaleLowerCase().includes(query));
      const summary = matchedText && matchedText !== title ? matchedText.slice(0, 140) : '';
      results.push({ id: record._id.toString(), resource: record.resource, title, summary, updatedAt: record.updatedAt });
      if (results.length >= 30) break;
    }
    response.json({ results });
  } catch (error) { next(error); }
});

app.get('/api/records/:resource', async (request, response, next) => {
  if (!resources.includes(request.params.resource)) {
    return response.status(404).json({ error: 'This business area does not exist.' });
  }

  try {
    const records = await BusinessRecord.find({ resource: request.params.resource }).sort({ updatedAt: -1 }).lean();
    response.json(records.map(({ _id, data, createdAt, updatedAt }) => ({
      ...data,
      ...(request.params.resource === 'bookings' ? deriveBookingFinancials(data) : {}),
      id: _id.toString(), createdAt, updatedAt
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
    let data = ['income', 'expenses'].includes(request.params.resource)
      ? validateFinancialEntry(request.body, { resource: request.params.resource })
      : request.params.resource === 'employees' ? validateEmployeePayrollData(request.body) : request.body;
    if (request.params.resource === 'bookings') {
      const {
        materialPlan: _plan, completion: _completion, completionHistory: _history, statusBeforeCompletion: _status,
        payments: _payments, paymentTrackingStartedAt: _tracking, paidAmount: _paid, balance: _balance, paymentStatus: _paymentStatus,
        ...bookingFields
      } = request.body;
      data = { ...bookingFields, materialPlan: [], completion: null, completionHistory: [], payments: [], paymentTrackingStartedAt: new Date() };
    }
    const record = await BusinessRecord.create({ resource: request.params.resource, data });
    response.status(201).json({
      ...record.data,
      ...(request.params.resource === 'bookings' ? deriveBookingFinancials(record.data) : {}),
      id: record._id.toString(),
      createdAt: record.createdAt, updatedAt: record.updatedAt
    });
  } catch (error) {
    if (error.status === 400) return response.status(400).json({ error: error.message });
    next(error);
  }
});

const resourceWhitelists = {
  income: ['name', 'category', 'amount', 'date', 'notes', 'reference'],
  expenses: ['name', 'category', 'amount', 'date', 'notes', 'reference'],
  clients: ['name', 'company', 'email', 'phone', 'address', 'city', 'region', 'postalCode', 'country', 'preferredContact', 'status', 'notes'],
  scheduler: ['name', 'date', 'time', 'status', 'notes', 'location'],
  employees: ['employeeId', 'name', 'position', 'email', 'phone', 'salary', 'baseRate', 'overtimeRate', 'holidayRate', 'salaryType', 'allowances', 'bonus', 'commission', 'regularDeductions', 'effectiveDate', 'payFrequency', 'status'],
  shareholders: ['name', 'email', 'shares', 'percentage', 'notes'],
  'material-categories': ['name'],
  'excel-sheet': ['name', 'category', 'owner', 'updated', 'content', 'data'],
  profit: ['name', 'income', 'expenses', 'amount', 'period', 'notes'],
  notepad: ['name', 'content', 'updated']
};

const protectedFields = new Set([
  '_id', 'id', 'createdAt', 'updatedAt', 'resource',
  'payrollRunId', 'payrollPaymentId', 'purchaseOrderId', 'purchasePaymentId', 'expenseKind',
  'materialPlan', 'completion', 'completionHistory', 'payments', 'paymentTrackingStartedAt',
  'paidAmount', 'balance', 'paymentStatus', 'stockMigratedMaterialId', 'reversedAt', 'voidedAt'
]);

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
      if (linked?.data?.purchaseOrderId) return response.status(409).json({ error: 'Purchase order linked expenses are managed with their purchase order.' });
    }
    const existing = await BusinessRecord.findOne({ _id: request.params.id, resource: request.params.resource });
    if (!existing) return response.status(404).json({ error: 'Record not found.' });

    const whitelist = resourceWhitelists[request.params.resource];
    const patch = {};
    if (whitelist) {
      for (const key of whitelist) {
        if (Object.hasOwn(request.body, key) && !protectedFields.has(key)) {
          patch[key] = request.body[key];
        }
      }
    } else {
      for (const [key, value] of Object.entries(request.body)) {
        if (!protectedFields.has(key)) {
          patch[key] = value;
        }
      }
    }

    let merged = { ...existing.data, ...patch };
    if (['income', 'expenses'].includes(request.params.resource)) merged = validateFinancialEntry(merged, { resource: request.params.resource });
    if (request.params.resource === 'employees') merged = validateEmployeePayrollData(merged);

    existing.data = merged;
    existing.updatedAt = new Date();
    existing.markModified('data');
    await existing.save();

    response.json({ ...existing.data, id: existing._id.toString(), createdAt: existing.createdAt, updatedAt: existing.updatedAt });
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
      if (linked?.data?.purchaseOrderId) return response.status(409).json({ error: 'Purchase order linked expenses are managed with their purchase order.' });
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

export { app };

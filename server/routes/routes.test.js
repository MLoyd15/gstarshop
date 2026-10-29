import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { createPurchasesRouter } from './purchases.js';
import { requireAuth } from './auth.js';
import { validateFinancialEntry } from '../services/financial.js';

// Helper to start an Express app on an ephemeral port and fetch from it
function withServer(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const baseUrl = `http://127.0.0.1:${port}`;
      const close = () => new Promise((res) => server.close(res));
      resolve({ baseUrl, close });
    });
  });
}

test('Route Test [Issue 1]: unauthenticated requests are rejected with 401 across protected routes', async () => {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.post('/api/auth/login', (_req, res) => res.json({ user: { id: '1' } }));

  // Global auth guard
  app.use('/api', requireAuth);

  app.get('/api/dashboard', (_req, res) => res.json({ dashboard: true }));
  app.get('/api/records/expenses', (_req, res) => res.json([]));
  app.patch('/api/records/expenses/:id', (_req, res) => res.json({ updated: true }));
  app.post('/api/purchases/:id/pay', (_req, res) => res.json({ paid: true }));
  app.post('/api/payroll/runs/generate', (_req, res) => res.json({ generated: true }));

  const { baseUrl, close } = await withServer(app);

  try {
    // 1. Public health check works without auth
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);

    // 2. Public login works without auth
    const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST' });
    assert.equal(login.status, 200);

    // 3. Protected routes return 401 when no auth cookie is present
    const protectedRoutes = [
      { path: '/api/dashboard', method: 'GET' },
      { path: '/api/records/expenses', method: 'GET' },
      { path: '/api/records/expenses/64f1a2b3c4d5e6f7a8b9c0d1', method: 'PATCH' },
      { path: '/api/purchases/64f1a2b3c4d5e6f7a8b9c0d1/pay', method: 'POST' },
      { path: '/api/payroll/runs/generate', method: 'POST' }
    ];

    for (const route of protectedRoutes) {
      const res = await fetch(`${baseUrl}${route.path}`, {
        method: route.method,
        headers: { 'Content-Type': 'application/json' },
        body: ['POST', 'PATCH'].includes(route.method) ? JSON.stringify({}) : undefined
      });
      assert.equal(res.status, 401, `${route.method} ${route.path} should return 401`);
      const body = await res.json();
      assert.equal(body.error, 'Please sign in to continue.');
    }
  } finally {
    await close();
  }
});

test('Route Test [Issue 2 & 3]: purchase order /pay idempotency and expense creation in transaction', async () => {
  const records = new Map();
  let nextId = 1;

  function createRecord(resource, data) {
    const id = `rec-${nextId++}`;
    const doc = {
      _id: id,
      resource,
      data: { ...data },
      createdAt: new Date(),
      updatedAt: new Date(),
      markModified() {},
      async save() { return this; }
    };
    records.set(id, doc);
    return doc;
  }

  // Pre-seed a supplier and a received PO
  const supplier = createRecord('suppliers', { name: 'Acme Paper Co.', status: 'active' });
  const po = createRecord('purchase-orders', {
    number: 'PO-000100',
    supplierId: supplier._id,
    status: 'received',
    subtotal: 500,
    paidAmount: 0,
    payments: []
  });

  function mockQuery(result) {
    return {
      session() { return this; },
      then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); }
    };
  }

  const mockBusinessRecord = {
    findOne(filter) {
      const paymentId = filter['data.purchasePaymentId'];
      if (paymentId) {
        for (const r of records.values()) {
          if (r.resource === 'expenses' && r.data.purchasePaymentId === paymentId) {
            return mockQuery(r);
          }
        }
        return mockQuery(null);
      }
      const rec = records.get(filter._id);
      return mockQuery(rec && rec.resource === filter.resource ? rec : null);
    },
    async create(docs) {
      return docs.map(({ resource, data }) => createRecord(resource, data));
    }
  };

  const mockMongoose = {
    isValidObjectId: () => true,
    async startSession() {
      return {
        async withTransaction(work) { return work(); },
        async endSession() {}
      };
    }
  };

  const app = express();
  app.use(express.json());
  app.use('/api', createPurchasesRouter(mockBusinessRecord, mockMongoose));

  const { baseUrl, close } = await withServer(app);

  try {
    // 1. Initial valid payment of 200
    const payRes1 = await fetch(`${baseUrl}/api/purchases/${po._id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId: 'payment-abc-1',
        amount: 200,
        date: '2026-10-29'
      })
    });

    const payData1 = await payRes1.json();
    assert.equal(payRes1.status, 200, payData1.error || 'Should succeed');
    assert.equal(payData1.duplicate, false);
    assert.equal(payData1.paidAmount, 200);
    assert.equal(payData1.status, 'received');
    assert.equal(payData1.payments.length, 1);
    assert.equal(payData1.payments[0].id, 'payment-abc-1');
    assert.ok(payData1.payments[0].expenseId);

    // Verify Issue 3: Expense record was created
    const createdExpense = [...records.values()].find((r) => r.resource === 'expenses' && r.data.purchasePaymentId === 'payment-abc-1');
    assert.ok(createdExpense, 'An expense record should be created for the supplier payment');
    assert.equal(createdExpense.data.amount, 200);
    assert.equal(createdExpense.data.category, 'Purchases');
    assert.equal(createdExpense.data.expenseKind, 'purchase-payment');
    assert.equal(createdExpense.data.purchaseOrderId, po._id);

    // 2. Double-submit with EXACT SAME payment ID (Issue 2 idempotency)
    const payRes2 = await fetch(`${baseUrl}/api/purchases/${po._id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId: 'payment-abc-1',
        amount: 200,
        date: '2026-10-29'
      })
    });

    assert.equal(payRes2.status, 200);
    const payData2 = await payRes2.json();
    assert.equal(payData2.duplicate, true, 'Second payment submission should be recognized as duplicate');
    assert.equal(payData2.paidAmount, 200, 'paidAmount should not be incremented twice');
    assert.equal(payData2.payments.length, 1, 'payments array should not have duplicate entries');

    // 3. Resubmit same payment ID with CONFLICTING amount -> Should reject with 409
    const payResConflict = await fetch(`${baseUrl}/api/purchases/${po._id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId: 'payment-abc-1',
        amount: 300,
        date: '2026-10-29'
      })
    });

    assert.equal(payResConflict.status, 409, 'Reusing payment ID with changed amount must reject with 409');
    const conflictData = await payResConflict.json();
    assert.match(conflictData.error, /already used with different payment details/);
  } finally {
    await close();
  }
});

test('Route Test [Issue 4]: generic PATCH /api/records/:resource/:id merges fields without wiping untouched data', async () => {
  const records = new Map();
  let nextId = 1;

  function createRecord(resource, data) {
    const id = `rec-${nextId++}`;
    const doc = {
      _id: id,
      resource,
      data: { ...data },
      createdAt: new Date(),
      updatedAt: new Date(),
      markModified() {},
      async save() { return this; }
    };
    records.set(id, doc);
    return doc;
  }

  // Pre-seed an existing expense and an existing client
  const existingExpense = createRecord('expenses', {
    name: 'Internet Connection',
    category: 'Utilities',
    amount: 149.99,
    date: '2026-10-01'
  });

  const existingClient = createRecord('clients', {
    name: 'Big Corp',
    company: 'Big Corp Inc.',
    email: 'contact@bigcorp.test',
    phone: '555-0100',
    address: '100 Main St',
    city: 'Metro City',
    status: 'Active'
  });

  const resourceWhitelists = {
    expenses: ['name', 'category', 'amount', 'date', 'notes', 'reference'],
    clients: ['name', 'company', 'email', 'phone', 'address', 'city', 'region', 'postalCode', 'country', 'preferredContact', 'status', 'notes']
  };

  const protectedFields = new Set([
    '_id', 'id', 'createdAt', 'updatedAt', 'resource',
    'payrollRunId', 'payrollPaymentId', 'purchaseOrderId', 'purchasePaymentId', 'expenseKind'
  ]);

  const app = express();
  app.use(express.json());

  app.patch('/api/records/:resource/:id', async (req, res) => {
    const existing = records.get(req.params.id);
    if (!existing || existing.resource !== req.params.resource) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    const whitelist = resourceWhitelists[req.params.resource];
    const patch = {};
    for (const key of whitelist) {
      if (Object.hasOwn(req.body, key) && !protectedFields.has(key)) {
        patch[key] = req.body[key];
      }
    }

    let merged = { ...existing.data, ...patch };
    if (req.params.resource === 'expenses') {
      merged = validateFinancialEntry(merged, { resource: 'expenses' });
    }

    existing.data = merged;
    existing.updatedAt = new Date();
    await existing.save();

    res.json({ ...existing.data, id: existing._id, createdAt: existing.createdAt, updatedAt: existing.updatedAt });
  });

  const { baseUrl, close } = await withServer(app);

  try {
    // 1. Partial PATCH on expense: update ONLY amount
    const expenseRes = await fetch(`${baseUrl}/api/records/expenses/${existingExpense._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 189.99 })
    });

    assert.equal(expenseRes.status, 200);
    const updatedExpense = await expenseRes.json();
    assert.equal(updatedExpense.amount, 189.99);
    assert.equal(updatedExpense.name, 'Internet Connection', 'Untouched name must be preserved');
    assert.equal(updatedExpense.category, 'Utilities', 'Untouched category must be preserved');
    assert.equal(updatedExpense.date, '2026-10-01', 'Untouched date must be preserved');

    // 2. Partial PATCH on client: update phone and attempt to inject protected/unwhitelisted fields
    const clientRes = await fetch(`${baseUrl}/api/records/clients/${existingClient._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '555-9999',
        payrollRunId: 'malicious-id',
        hackField: 'injected'
      })
    });

    assert.equal(clientRes.status, 200);
    const updatedClient = await clientRes.json();
    assert.equal(updatedClient.phone, '555-9999');
    assert.equal(updatedClient.name, 'Big Corp', 'Untouched name must be preserved');
    assert.equal(updatedClient.email, 'contact@bigcorp.test', 'Untouched email must be preserved');
    assert.equal(updatedClient.address, '100 Main St', 'Untouched address must be preserved');
    assert.equal(updatedClient.payrollRunId, undefined, 'Protected field must be stripped');
    assert.equal(updatedClient.hackField, undefined, 'Unwhitelisted field must be ignored');
  } finally {
    await close();
  }
});

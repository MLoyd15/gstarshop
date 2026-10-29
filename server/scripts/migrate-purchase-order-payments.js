import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
const apply = process.argv.includes('--apply');

if (!uri) {
  console.error('MONGODB_URI is not configured.');
  process.exitCode = 1;
} else {
  const schema = new mongoose.Schema({
    resource: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }, { collection: 'businessrecords' });

  const BusinessRecord = mongoose.model('BusinessRecord', schema);

  try {
    await mongoose.connect(uri);
    const orders = await BusinessRecord.find({
      resource: 'purchase-orders',
      'data.paidAmount': { $gt: 0 }
    }).lean();

    const candidates = orders.filter((order) => {
      const payments = order.data.payments || [];
      const paymentSum = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      return Math.abs(paymentSum - Number(order.data.paidAmount)) > 0.0001;
    });

    console.log(`${apply ? 'Applying' : 'Dry run'}: Found ${candidates.length} purchase orders with unbacked paidAmount.`);

    for (const order of candidates) {
      const orderId = order._id.toString();
      const paidAmount = Number(order.data.paidAmount);
      const supplier = await BusinessRecord.findOne({ _id: order.data.supplierId, resource: 'suppliers' }).lean();
      const supplierName = supplier?.data?.name || 'Supplier';
      const orderDate = order.data.orderDate || order.createdAt?.toISOString?.().slice(0, 10) || new Date().toISOString().slice(0, 10);
      const paymentId = `legacy-payment-${orderId}`;

      console.log(`PO ${order.data.number || orderId}: backfilling payment ${paidAmount} on ${orderDate}`);

      if (!apply) continue;

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const po = await BusinessRecord.findOne({ _id: order._id, resource: 'purchase-orders' }).session(session);
          if (!po) return;

          let expense = await BusinessRecord.findOne({ resource: 'expenses', 'data.purchaseOrderId': orderId }).session(session);
          const expenseData = {
            name: `Purchase payment ${po.data.number || orderId} - ${supplierName}`,
            category: 'Purchases',
            amount: paidAmount,
            date: orderDate,
            purchaseOrderId: orderId,
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

          const payments = Array.isArray(po.data.payments) ? [...po.data.payments] : [];
          if (!payments.some((p) => p.id === paymentId)) {
            payments.push({
              id: paymentId,
              amount: paidAmount,
              date: orderDate,
              createdAt: po.updatedAt || new Date(),
              expenseId: expense._id.toString()
            });
          }
          po.data.payments = payments;
          po.data.paidAmount = Math.round(payments.reduce((sum, p) => sum + Number(p.amount || 0), 0) * 10000) / 10000;
          po.markModified('data');
          await po.save({ session });
        });
      } finally {
        await session.endSession();
      }
    }
    console.log('Migration finished.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}


import 'dotenv/config';
import mongoose from 'mongoose';
import { moneyCents } from '../services/booking-financials.js';

const uri = process.env.MONGODB_URI;
const apply = process.argv.includes('--apply');
if (!uri) {
  console.error('MONGODB_URI is not configured.');
  process.exitCode = 1;
} else {
  const schema = new mongoose.Schema({
    resource: { type: String, required: true }, data: { type: mongoose.Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now }, updatedAt: { type: Date, default: Date.now }
  }, { collection: 'businessrecords' });
  const BusinessRecord = mongoose.model('BusinessRecord', schema);
  try {
    await mongoose.connect(uri);
    const bookings = await BusinessRecord.find({
      resource: 'bookings',
      'data.completion.status': 'completed',
      'data.completion.revenueAmount': { $exists: false }
    }).select('_id data.name data.client data.amount data.completion.completionDate').sort({ _id: 1 }).lean();
    const candidates = [];
    const skipped = [];
    for (const booking of bookings) {
      try {
        const cents = moneyCents(booking.data.amount, 'Current booking amount', { positive: true });
        candidates.push({ booking, revenueAmount: cents / 100 });
      } catch (error) {
        skipped.push({ booking, reason: error.message });
      }
    }
    console.log(`${apply ? 'Applying' : 'Dry run'}: ${candidates.length} active completion(s) can receive an estimated revenue snapshot.`);
    console.log('Each proposed snapshot uses the booking amount as it exists now. It may differ from the amount charged when the job was completed. No payment records or payment status values will be changed.');
    for (const { booking, revenueAmount } of candidates) {
      console.log(`${booking._id} | ${booking.data.name || 'Untitled booking'} | ${booking.data.client || 'No client'} | completed ${booking.data.completion.completionDate || 'date unknown'} | current amount PHP ${revenueAmount.toFixed(2)}`);
      if (!apply) continue;
      const result = await BusinessRecord.updateOne(
        { _id: booking._id, resource: 'bookings', 'data.completion.status': 'completed', 'data.completion.revenueAmount': { $exists: false } },
        { $set: { 'data.completion.revenueAmount': revenueAmount, 'data.completion.revenueSource': 'migration-current-booking-amount', updatedAt: new Date() } }
      );
      if (result.modifiedCount !== 1) console.log(`Skipped ${booking._id}: it changed after the migration list was read.`);
    }
    for (const { booking, reason } of skipped) console.log(`Skipped ${booking._id} | ${booking.data.name || 'Untitled booking'} | ${reason}`);
    if (!apply) console.log('No data changed. Review this list; rerun with --apply only after confirming the proposed snapshots.');
    else console.log('Migration complete. Re-running will skip bookings that already have a revenue snapshot.');
  } catch (error) {
    console.error(`Migration failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

import express from 'express';
import {
  InventoryValidationError, applyStockMovement, toQuantity, validateBusinessDate
} from '../services/inventory.js';
import {
  addBookingPayment, confirmBookingPaymentHistory, deriveBookingFinancials, isCancelledBooking, snapshotCompletionRevenue, voidBookingPayment
} from '../services/booking-financials.js';

const serialize = (record) => ({
  ...record.data, ...deriveBookingFinancials(record.data),
  id: record._id.toString(), createdAt: record.createdAt, updatedAt: record.updatedAt
});
const roundCost = (value) => Math.round((value + Number.EPSILON) * 10000) / 10000;
const activeCompletion = (data) => data.completion?.status === 'completed';

export function createBookingsRouter(BusinessRecord, mongoose) {
  const router = express.Router();
  const fail = (res, error) => res.status(error.status || 500).json({ error: error.message || 'Booking action failed.' });
  const getBooking = async (id, session) => {
    if (!mongoose.isValidObjectId(id)) throw new InventoryValidationError('Booking ID is invalid.');
    const query = BusinessRecord.findOne({ _id: id, resource: 'bookings' });
    if (session) query.session(session);
    const booking = await query;
    if (!booking) throw new InventoryValidationError('Booking not found.', 404);
    return booking;
  };

  router.patch('/:id', async (req, res) => {
    try {
      const booking = await getBooking(req.params.id);
      if (activeCompletion(booking.data)) throw new InventoryValidationError('Reverse the completed job before editing its booking.', 409);
      const editable = Object.fromEntries(['name', 'client', 'date', 'amount', 'status'].filter((key) => Object.hasOwn(req.body, key)).map((key) => [key, req.body[key]]));
      booking.data = { ...booking.data, ...editable, materialPlan: booking.data.materialPlan || [], completion: booking.data.completion || null, completionHistory: booking.data.completionHistory || [] };
      booking.markModified('data');
      await booking.save();
      res.json(serialize(booking));
    } catch (error) { fail(res, error); }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const booking = await getBooking(req.params.id);
      if (activeCompletion(booking.data)) throw new InventoryValidationError('Reverse the completed job before deleting its booking.', 409);
      if ((booking.data.payments || []).length) throw new InventoryValidationError('Bookings with payment history cannot be deleted. Keep the booking for its payment audit history.', 409);
      await booking.deleteOne();
      res.status(204).end();
    } catch (error) { fail(res, error); }
  });

  router.patch('/:id/materials', async (req, res) => {
    try {
      const booking = await getBooking(req.params.id);
      if (activeCompletion(booking.data)) throw new InventoryValidationError('Reverse the completed job before changing planned materials.', 409);
      if (!Array.isArray(req.body.materials)) throw new InventoryValidationError('Planned materials must be a list.');
      const seen = new Set();
      const plan = [];
      for (const [index, line] of req.body.materials.entries()) {
        if (!mongoose.isValidObjectId(line.materialId)) throw new InventoryValidationError(`Choose a valid material for line ${index + 1}.`);
        const material = await BusinessRecord.findOne({ _id: line.materialId, resource: 'materials', 'data.active': true }).lean();
        if (!material) throw new InventoryValidationError(`Material on line ${index + 1} is unavailable.`, 404);
        const quantity = toQuantity(line.plannedQuantity, `Planned quantity on line ${index + 1}`, { positive: true });
        const lineId = String(line.lineId || `${line.materialId}-${index}`).slice(0, 100);
        if (seen.has(lineId)) throw new InventoryValidationError('Planned material lines must be unique.');
        seen.add(lineId);
        plan.push({ lineId, materialId: material._id.toString(), materialName: material.data.name, unit: material.data.unit, plannedQuantity: quantity });
      }
      booking.data.materialPlan = plan;
      booking.markModified('data');
      await booking.save();
      res.json(serialize(booking));
    } catch (error) { fail(res, error); }
  });

  router.post('/:id/complete', async (req, res) => {
    let session;
    try {
      if (!Array.isArray(req.body.materials)) throw new InventoryValidationError('Actual materials must be a list.');
      const date = validateBusinessDate(req.body.date);
      session = await mongoose.startSession();
      let result;
      await session.withTransaction(async () => {
        const booking = await getBooking(req.params.id, session);
        if (activeCompletion(booking.data)) { result = { booking: booking.toObject(), duplicate: true }; return; }
        const revenueSnapshot = snapshotCompletionRevenue(booking.data);
        if (!booking.data.materialPlan?.length) throw new InventoryValidationError('Add planned materials before completing the job.', 409);
        const planById = new Map(booking.data.materialPlan.map((line) => [line.lineId, line]));
        if (req.body.materials.length !== planById.size) throw new InventoryValidationError('Enter actual use and waste for every planned material line.');
        const completionId = new mongoose.Types.ObjectId().toString();
        const lines = [];
        const movementIds = [];
        let materialCost = 0;
        for (const actual of req.body.materials) {
          const planned = planById.get(String(actual.lineId));
          if (!planned) throw new InventoryValidationError('An actual material line does not match the saved plan.');
          const used = toQuantity(actual.usedQuantity, `${planned.materialName} used quantity`, { optional: true });
          const waste = toQuantity(actual.wasteQuantity, `${planned.materialName} waste quantity`, { optional: true });
          const material = await BusinessRecord.findOne({ _id: planned.materialId, resource: 'materials' }).session(session).lean();
          if (!material) throw new InventoryValidationError(`${planned.materialName} was not found.`, 404);
          const unitCost = Number(material.data.avgCost || 0);
          const lineCost = roundCost((used + waste) * unitCost);
          materialCost = roundCost(materialCost + lineCost);
          const movements = [];
          for (const [type, quantity, suffix] of [['job_use', used, 'use'], ['waste', waste, 'waste']]) {
            if (!quantity) continue;
            const movement = await applyStockMovement(BusinessRecord, session, planned.materialId, {
              type, quantity, date, note: `Booking ${booking.data.name || booking._id} completion`,
              referenceType: 'booking', referenceId: booking._id.toString(),
              idempotencyKey: `booking:${booking._id}:completion:${completionId}:${planned.lineId}:${suffix}`,
              extraData: { bookingId: booking._id.toString(), completionId, lineId: planned.lineId, materialCostMethod: 'average-cost' }
            });
            movements.push(movement.movement._id.toString()); movementIds.push(movement.movement._id.toString());
          }
          lines.push({ ...planned, usedQuantity: used, wasteQuantity: waste, averageCostAtCompletion: unitCost, materialCost: lineCost, movementIds: movements });
        }
        const data = booking.data;
        data.statusBeforeCompletion = data.status || 'Active';
        data.status = 'Completed';
        data.completion = { id: completionId, status: 'completed', completedAt: new Date(), completionDate: date, ...revenueSnapshot, materials: lines, materialCost, movementIds, reversalMovementIds: [] };
        booking.data = data; booking.markModified('data'); await booking.save({ session });
        result = { booking: booking.toObject(), duplicate: false };
      });
      res.status(result.duplicate ? 200 : 201).json(serialize(result.booking));
    } catch (error) { fail(res, error); }
    finally { await session?.endSession(); }
  });

  router.post('/:id/reverse-completion', async (req, res) => {
    let session;
    try {
      if (req.body.confirmReturned !== true) throw new InventoryValidationError('Confirm that all recorded material is physically returned and reusable.');
      const reason = String(req.body.reason || '').trim().slice(0, 500);
      if (!reason) throw new InventoryValidationError('Enter a reason for correcting this completed job.');
      const date = validateBusinessDate(req.body.date);
      session = await mongoose.startSession();
      let updated;
      await session.withTransaction(async () => {
        const booking = await getBooking(req.params.id, session);
        const completion = booking.data.completion;
        if (!activeCompletion(booking.data)) throw new InventoryValidationError('This booking has no active completion to reverse.', 409);
        const reversalIds = [];
        for (const line of completion.materials) {
          for (const movementId of line.movementIds || []) {
            const original = await BusinessRecord.findOne({ _id: movementId, resource: 'stock-movements' }).session(session).lean();
            if (!original || Number(original.data.change) >= 0) continue;
            const reversed = await applyStockMovement(BusinessRecord, session, line.materialId, {
              type: 'reversal', change: -Number(original.data.change), unitCost: Number(original.data.unitCost || 0), date,
              note: `Correction for booking ${booking.data.name || booking._id}: ${reason}`,
              referenceType: 'booking', referenceId: booking._id.toString(),
              idempotencyKey: `booking:${booking._id}:reversal:${completion.id}:${original._id}`,
              extraData: { bookingId: booking._id.toString(), completionId: completion.id, reversalOfMovementId: original._id.toString(), correctionReason: reason }
            });
            reversalIds.push(reversed.movement._id.toString());
          }
        }
        completion.status = 'reversed'; completion.reversedAt = new Date(); completion.reversalReason = reason; completion.reversalMovementIds = reversalIds;
        booking.data.completionHistory = [...(booking.data.completionHistory || []), completion];
        booking.data.status = booking.data.statusBeforeCompletion || 'Active'; delete booking.data.statusBeforeCompletion;
        booking.markModified('data'); await booking.save({ session }); updated = booking.toObject();
      });
      res.json(serialize(updated));
    } catch (error) { fail(res, error); }
    finally { await session?.endSession(); }
  });

  router.post('/:id/payments', async (req, res) => {
    let session;
    try {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new InventoryValidationError('Payment must be a JSON object.');
      session = await mongoose.startSession();
      let result;
      await session.withTransaction(async () => {
        const booking = await getBooking(req.params.id, session);
        if (isCancelledBooking(booking.data)) throw new InventoryValidationError('Payments cannot be added to a cancelled booking.', 409);
        result = addBookingPayment(booking.data, req.body);
        if (result.duplicate) { result.booking = booking.toObject(); return; }
        booking.data.payments = result.payments;
        booking.markModified('data');
        await booking.save({ session });
        result.booking = booking.toObject();
      });
      res.status(result.duplicate ? 200 : 201).json({ ...serialize(result.booking), payment: result.payment, duplicate: result.duplicate });
    } catch (error) { fail(res, error); }
    finally { await session?.endSession(); }
  });

  router.delete('/:id/payments/:paymentId', async (req, res) => {
    let session;
    try {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new InventoryValidationError('A void reason is required.');
      session = await mongoose.startSession();
      let result;
      await session.withTransaction(async () => {
        const booking = await getBooking(req.params.id, session);
        result = voidBookingPayment(booking.data, req.params.paymentId, req.body.reason);
        booking.data.payments = result.payments;
        booking.markModified('data');
        await booking.save({ session });
        result.booking = booking.toObject();
      });
      res.json({ ...serialize(result.booking), payment: result.payment });
    } catch (error) { fail(res, error); }
    finally { await session?.endSession(); }
  });

  router.post('/:id/payments/confirm-history', async (req, res) => {
    try {
      if (req.body?.confirmed !== true) throw new InventoryValidationError('Confirm that all earlier customer payments have been recorded.');
      const booking = await getBooking(req.params.id);
      booking.data = confirmBookingPaymentHistory(booking.data);
      booking.markModified('data');
      await booking.save();
      res.json(serialize(booking));
    } catch (error) { fail(res, error); }
  });
  return router;
}

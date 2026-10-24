import express from 'express';
import { buildAnalyticsSummary } from '../services/analytics.js';

export function createAnalyticsRouter(BusinessRecord) {
  const router = express.Router();

  router.get('/', async (req, res, next) => {
    try {
      const resourcesNeeded = ['income', 'expenses', 'bookings', 'payroll-runs'];
      const records = await BusinessRecord.find({ resource: { $in: resourcesNeeded } })
        .select('resource data createdAt updatedAt')
        .lean();

      const summary = buildAnalyticsSummary(records, req.query.period, new Date(), req.query.months);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  });

  return router;
}


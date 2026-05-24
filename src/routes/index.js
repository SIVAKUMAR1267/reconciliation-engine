// src/routes/index.js
const express = require('express');
const router = express.Router();

const ReconcileController = require('../controllers/ReconcileController');
const ReportController = require('../controllers/ReportController');

router.post('/reconcile', ReconcileController.triggerReconciliation);

router.get('/report/:runId', ReportController.downloadReport);
router.get('/report/:runId/summary', ReportController.getSummary);
router.get('/report/:runId/unmatched', ReportController.getUnmatched);

module.exports = router;
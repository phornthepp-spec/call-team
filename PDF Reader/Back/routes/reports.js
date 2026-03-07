const express = require('express');
const router = express.Router();
const db = require('../../Database/db');

// POST /api/reports — Save parsed report
router.post('/', (req, res) => {
  try {
    const { filename, total_records, total_amount, success_count, fail_count, pages_processed, transactions } = req.body;

    const reportId = db.insertReport({
      filename,
      total_records,
      total_amount,
      success_count,
      fail_count,
      pages_processed
    });

    if (transactions && transactions.length > 0) {
      db.insertTransactions(reportId, transactions);
    }

    res.json({ id: reportId, message: 'Report saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports — List all saved reports
router.get('/', (req, res) => {
  try {
    const reports = db.getReports();
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/:id — Get specific report with transactions
router.get('/:id', (req, res) => {
  try {
    const report = db.getReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    const transactions = db.getTransactionsByReportId(req.params.id);
    res.json({ ...report, transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/reports/:id — Delete report
router.delete('/:id', (req, res) => {
  try {
    const changes = db.deleteReport(req.params.id);
    if (changes === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json({ message: 'Report deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

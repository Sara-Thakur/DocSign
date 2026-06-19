const express = require('express');
const router = express.Router();
const { getAuditTrail } = require('../controllers/auditController');
const { protect } = require('../middleware/auth');

router.get('/:docId', protect, getAuditTrail);

module.exports = router;

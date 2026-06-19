const AuditLog = require('../models/AuditLog');
const Document = require('../models/Document');

// @desc    Get audit trail for a document
// @route   GET /api/audit/:docId
const getAuditTrail = async (req, res) => {
  try {
    // Verify document ownership
    const document = await Document.findOne({
      _id: req.params.docId,
      owner: req.user._id
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const auditLogs = await AuditLog.find({ document: req.params.docId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(auditLogs);
  } catch (error) {
    console.error('Audit trail error:', error);
    res.status(500).json({ message: 'Error fetching audit trail' });
  }
};

module.exports = { getAuditTrail };

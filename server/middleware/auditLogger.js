const AuditLog = require('../models/AuditLog');

/**
 * Creates an audit log entry
 */
const createAuditLog = async ({ documentId, action, performedBy, performedByUser, req, metadata = {} }) => {
  try {
    await AuditLog.create({
      document: documentId,
      action,
      performedBy,
      performedByUser: performedByUser || null,
      ipAddress: req ? (req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown') : 'system',
      userAgent: req ? (req.headers['user-agent'] || 'unknown') : 'system',
      metadata
    });
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
};

module.exports = { createAuditLog };

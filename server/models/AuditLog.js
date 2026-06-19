const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  document: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'document_uploaded',
      'document_viewed',
      'document_deleted',
      'signature_placed',
      'signature_signed',
      'signature_rejected',
      'document_shared',
      'document_finalized',
      'public_link_accessed',
      'email_sent'
    ]
  },
  performedBy: {
    type: String,
    required: true
  },
  performedByUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  ipAddress: {
    type: String,
    default: 'unknown'
  },
  userAgent: {
    type: String,
    default: 'unknown'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

auditLogSchema.index({ document: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

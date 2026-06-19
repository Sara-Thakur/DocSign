const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Document title is required'],
    trim: true
  },
  fileName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    default: 0
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'signed', 'rejected'],
    default: 'draft'
  },
  shareToken: {
    type: String,
    unique: true,
    sparse: true
  },
  shareTokenExpiry: {
    type: Date
  },
  signerEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  signerName: {
    type: String,
    trim: true
  },
  signedFilePath: {
    type: String,
    default: null
  },
  totalPages: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Index for quick lookups
documentSchema.index({ owner: 1, status: 1 });

module.exports = mongoose.model('Document', documentSchema);

const mongoose = require('mongoose');

const signatureSchema = new mongoose.Schema({
  document: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  signer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  signerName: {
    type: String,
    required: [true, 'Signer name is required'],
    trim: true
  },
  signerEmail: {
    type: String,
    required: [true, 'Signer email is required'],
    trim: true,
    lowercase: true
  },
  // Position as percentage (0-100) for responsive rendering
  x: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  y: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  page: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  width: {
    type: Number,
    default: 20 // percentage of page width
  },
  height: {
    type: Number,
    default: 8 // percentage of page height
  },
  signatureData: {
    type: String, // base64 encoded signature image
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'signed', 'rejected'],
    default: 'pending'
  },
  rejectionReason: {
    type: String,
    default: null
  },
  signedAt: {
    type: Date,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

signatureSchema.index({ document: 1 });

module.exports = mongoose.model('Signature', signatureSchema);

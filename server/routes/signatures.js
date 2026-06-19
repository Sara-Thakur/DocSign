const express = require('express');
const router = express.Router();
const {
  createSignature,
  getSignatures,
  shareDocument,
  getPublicDocument,
  publicSign,
  finalizeDocument,
  deleteSignature
} = require('../controllers/signatureController');
const { protect } = require('../middleware/auth');

// Protected routes (require auth)
router.post('/', protect, createSignature);
router.get('/:docId', protect, getSignatures);
router.post('/share', protect, shareDocument);
router.post('/finalize', protect, finalizeDocument);
router.delete('/:id', protect, deleteSignature);

// Public routes (no auth — accessed via share token)
router.get('/public/:token', getPublicDocument);
router.post('/public/:token/sign', publicSign);

module.exports = router;

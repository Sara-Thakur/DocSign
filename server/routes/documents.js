const express = require('express');
const router = express.Router();
const {
  uploadDocument,
  getDocuments,
  getDocument,
  getDocumentFile,
  getSignedFile,
  deleteDocument
} = require('../controllers/documentController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/upload', protect, upload.single('pdf'), uploadDocument);
router.get('/', protect, getDocuments);
router.get('/:id', protect, getDocument);
router.get('/:id/file', getDocumentFile);
router.get('/:id/signed', protect, getSignedFile);
router.delete('/:id', protect, deleteDocument);

module.exports = router;

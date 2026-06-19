const Document = require('../models/Document');
const Signature = require('../models/Signature');
const AuditLog = require('../models/AuditLog');
const { createAuditLog } = require('../middleware/auditLogger');
const { getPdfPageCount } = require('../utils/pdfUtils');
const path = require('path');
const fs = require('fs');

// @desc    Upload document
// @route   POST /api/docs/upload
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a PDF file' });
    }

    const title = req.body.title || req.file.originalname.replace('.pdf', '');
    const filePath = req.file.path;
    const pageCount = await getPdfPageCount(filePath);

    const document = await Document.create({
      title,
      fileName: req.file.originalname,
      filePath: filePath,
      fileSize: req.file.size,
      owner: req.user._id,
      totalPages: pageCount
    });

    await createAuditLog({
      documentId: document._id,
      action: 'document_uploaded',
      performedBy: req.user.name,
      performedByUser: req.user._id,
      req,
      metadata: { fileName: req.file.originalname, fileSize: req.file.size }
    });

    res.status(201).json(document);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error uploading document' });
  }
};

// @desc    Get all documents for user
// @route   GET /api/docs
const getDocuments = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { owner: req.user._id };
    if (status && status !== 'all') {
      query.status = status;
    }

    const documents = await Document.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Get signature counts for each document
    const docsWithSignatures = await Promise.all(
      documents.map(async (doc) => {
        const sigCount = await Signature.countDocuments({ document: doc._id });
        const signedCount = await Signature.countDocuments({ document: doc._id, status: 'signed' });
        return {
          ...doc,
          signatureCount: sigCount,
          signedSignatureCount: signedCount
        };
      })
    );

    res.json(docsWithSignatures);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ message: 'Error fetching documents' });
  }
};

// @desc    Get single document
// @route   GET /api/docs/:id
const getDocument = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    await createAuditLog({
      documentId: document._id,
      action: 'document_viewed',
      performedBy: req.user.name,
      performedByUser: req.user._id,
      req
    });

    res.json(document);
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ message: 'Error fetching document' });
  }
};

// @desc    Serve PDF file
// @route   GET /api/docs/:id/file
const getDocumentFile = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Try to authenticate user from query token
    const jwt = require('jsonwebtoken');
    const User = require('../models/User');
    let user = null;
    const token = req.query.token;
    
    if (token) {
      // Check if it's a JWT (has 3 parts)
      if (token.split('.').length === 3) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          user = await User.findById(decoded.id);
        } catch (err) {
          // invalid token, leave user as null
        }
      }
    }

    // Check ownership or public access via share token
    const isOwner = user && document.owner.toString() === user._id.toString();
    const hasShareToken = token && document.shareToken === token;

    if (!isOwner && !hasShareToken) {
      return res.status(403).json({ message: 'Not authorized to access this document' });
    }

    const filePath = document.filePath;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${document.fileName}"`);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ message: 'Error serving file' });
  }
};

// @desc    Get signed PDF file
// @route   GET /api/docs/:id/signed
const getSignedFile = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!document || !document.signedFilePath) {
      return res.status(404).json({ message: 'Signed document not found' });
    }

    if (!fs.existsSync(document.signedFilePath)) {
      return res.status(404).json({ message: 'Signed file not found on server' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="signed_${document.fileName}"`);
    const fileStream = fs.createReadStream(document.signedFilePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Get signed file error:', error);
    res.status(500).json({ message: 'Error serving signed file' });
  }
};

// @desc    Delete document
// @route   DELETE /api/docs/:id
const deleteDocument = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Delete files
    if (fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }
    if (document.signedFilePath && fs.existsSync(document.signedFilePath)) {
      fs.unlinkSync(document.signedFilePath);
    }

    // Delete related records
    await Signature.deleteMany({ document: document._id });
    await AuditLog.deleteMany({ document: document._id });
    await Document.findByIdAndDelete(document._id);

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: 'Error deleting document' });
  }
};

module.exports = {
  uploadDocument,
  getDocuments,
  getDocument,
  getDocumentFile,
  getSignedFile,
  deleteDocument
};

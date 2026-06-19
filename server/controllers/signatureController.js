const { v4: uuidv4 } = require('uuid');
const path = require('path');
const Signature = require('../models/Signature');
const Document = require('../models/Document');
const { createAuditLog } = require('../middleware/auditLogger');
const { generateSignedPDF } = require('../utils/pdfUtils');
const { sendSigningEmail, sendCompletionEmail } = require('../utils/emailService');

// @desc    Save signature position
// @route   POST /api/signatures
const createSignature = async (req, res) => {
  try {
    const { documentId, signerName, signerEmail, x, y, page, width, height } = req.body;

    const document = await Document.findOne({
      _id: documentId,
      owner: req.user._id
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const signature = await Signature.create({
      document: documentId,
      signer: null,
      signerName,
      signerEmail,
      x,
      y,
      page: page || 1,
      width: width || 20,
      height: height || 8
    });

    // Update document status
    if (document.status === 'draft') {
      document.status = 'pending';
      document.signerEmail = signerEmail;
      document.signerName = signerName;
      await document.save();
    }

    await createAuditLog({
      documentId: document._id,
      action: 'signature_placed',
      performedBy: req.user.name,
      performedByUser: req.user._id,
      req,
      metadata: { signerEmail, page, x, y }
    });

    res.status(201).json(signature);
  } catch (error) {
    console.error('Create signature error:', error);
    res.status(500).json({ message: 'Error creating signature field' });
  }
};

// @desc    Get signatures for a document
// @route   GET /api/signatures/:docId
const getSignatures = async (req, res) => {
  try {
    const signatures = await Signature.find({ document: req.params.docId })
      .sort({ createdAt: 1 });
    res.json(signatures);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching signatures' });
  }
};

// @desc    Generate share link and send email
// @route   POST /api/signatures/share
const shareDocument = async (req, res) => {
  try {
    const { documentId } = req.body;

    const document = await Document.findOne({
      _id: documentId,
      owner: req.user._id
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check if signatures exist
    const sigCount = await Signature.countDocuments({ document: documentId });
    if (sigCount === 0) {
      return res.status(400).json({ message: 'Please add at least one signature field before sharing' });
    }

    // Generate share token
    const shareToken = uuidv4();
    document.shareToken = shareToken;
    document.shareTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    document.status = 'pending';
    await document.save();

    const signLink = `${process.env.CLIENT_URL}/sign/${shareToken}`;

    // Send email to signer
    try {
      const signature = await Signature.findOne({ document: documentId });
      if (signature && signature.signerEmail) {
        await sendSigningEmail({
          to: signature.signerEmail,
          signerName: signature.signerName,
          documentTitle: document.title,
          signLink,
          senderName: req.user.name
        });

        await createAuditLog({
          documentId: document._id,
          action: 'email_sent',
          performedBy: req.user.name,
          performedByUser: req.user._id,
          req,
          metadata: { recipientEmail: signature.signerEmail, signLink }
        });
      }
    } catch (emailError) {
      console.error('Email send failed:', emailError.message);
      // Don't fail the request if email fails
    }

    await createAuditLog({
      documentId: document._id,
      action: 'document_shared',
      performedBy: req.user.name,
      performedByUser: req.user._id,
      req,
      metadata: { shareToken, signLink }
    });

    res.json({ shareToken, signLink, message: 'Document shared successfully' });
  } catch (error) {
    console.error('Share error:', error);
    res.status(500).json({ message: 'Error sharing document' });
  }
};

// @desc    Access public signing page
// @route   GET /api/signatures/public/:token
const getPublicDocument = async (req, res) => {
  try {
    const document = await Document.findOne({
      shareToken: req.params.token
    }).populate('owner', 'name email');

    if (!document) {
      return res.status(404).json({ message: 'Invalid or expired signing link' });
    }

    if (document.shareTokenExpiry && document.shareTokenExpiry < new Date()) {
      return res.status(410).json({ message: 'This signing link has expired' });
    }

    const signatures = await Signature.find({ document: document._id });

    await createAuditLog({
      documentId: document._id,
      action: 'public_link_accessed',
      performedBy: signatures[0]?.signerEmail || 'Unknown',
      req,
      metadata: { token: req.params.token }
    });

    res.json({
      document: {
        _id: document._id,
        title: document.title,
        fileName: document.fileName,
        status: document.status,
        totalPages: document.totalPages,
        ownerName: document.owner.name
      },
      signatures: signatures.map(s => ({
        _id: s._id,
        signerName: s.signerName,
        signerEmail: s.signerEmail,
        x: s.x,
        y: s.y,
        page: s.page,
        width: s.width,
        height: s.height,
        status: s.status
      })),
      shareToken: req.params.token
    });
  } catch (error) {
    console.error('Public access error:', error);
    res.status(500).json({ message: 'Error accessing document' });
  }
};

// @desc    Sign document via public link
// @route   POST /api/signatures/public/:token/sign
const publicSign = async (req, res) => {
  try {
    const { signatureId, signatureData, action, rejectionReason } = req.body;

    const document = await Document.findOne({
      shareToken: req.params.token
    }).populate('owner', 'name email');

    if (!document) {
      return res.status(404).json({ message: 'Invalid signing link' });
    }

    const signature = await Signature.findOne({
      _id: signatureId,
      document: document._id
    });

    if (!signature) {
      return res.status(404).json({ message: 'Signature field not found' });
    }

    if (signature.status !== 'pending') {
      return res.status(400).json({ message: 'This signature has already been processed' });
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';

    if (action === 'reject') {
      signature.status = 'rejected';
      signature.rejectionReason = rejectionReason || 'No reason provided';
      signature.ipAddress = ipAddress;
      await signature.save();

      document.status = 'rejected';
      await document.save();

      await createAuditLog({
        documentId: document._id,
        action: 'signature_rejected',
        performedBy: signature.signerEmail,
        req,
        metadata: { reason: rejectionReason }
      });

      // Notify document owner
      try {
        await sendCompletionEmail({
          to: document.owner.email,
          documentTitle: document.title,
          signerName: signature.signerName,
          status: 'rejected'
        });
      } catch (e) {
        console.error('Completion email failed:', e.message);
      }

      return res.json({ message: 'Document rejected', status: 'rejected' });
    }

    // Sign
    if (!signatureData) {
      return res.status(400).json({ message: 'Signature data is required' });
    }

    signature.signatureData = signatureData;
    signature.status = 'signed';
    signature.signedAt = new Date();
    signature.ipAddress = ipAddress;
    await signature.save();

    await createAuditLog({
      documentId: document._id,
      action: 'signature_signed',
      performedBy: signature.signerEmail,
      req,
      metadata: { signatureId: signature._id }
    });

    // Check if all signatures are completed
    const allSignatures = await Signature.find({ document: document._id });
    const allSigned = allSignatures.every(s => s.status === 'signed');

    if (allSigned) {
      // Generate the finalized signed PDF
      try {
        const outputPath = path.join(__dirname, '..', 'signed', `signed_${document.fileName}`);
        await generateSignedPDF(document.filePath, allSignatures, outputPath);
        document.signedFilePath = outputPath;
        document.status = 'signed';
        await document.save();

        await createAuditLog({
          documentId: document._id,
          action: 'document_finalized',
          performedBy: 'system',
          req,
          metadata: { signedFilePath: outputPath }
        });
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError);
      }

      // Notify owner
      try {
        await sendCompletionEmail({
          to: document.owner.email,
          documentTitle: document.title,
          signerName: signature.signerName,
          status: 'signed'
        });
      } catch (e) {
        console.error('Completion email failed:', e.message);
      }
    }

    res.json({
      message: allSigned ? 'Document fully signed!' : 'Signature recorded',
      status: allSigned ? 'signed' : 'pending'
    });
  } catch (error) {
    console.error('Public sign error:', error);
    res.status(500).json({ message: 'Error processing signature' });
  }
};

// @desc    Finalize document manually
// @route   POST /api/signatures/finalize
const finalizeDocument = async (req, res) => {
  try {
    const { documentId } = req.body;

    const document = await Document.findOne({
      _id: documentId,
      owner: req.user._id
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const signatures = await Signature.find({ document: documentId, status: 'signed' });
    if (signatures.length === 0) {
      return res.status(400).json({ message: 'No signed signatures to finalize' });
    }

    const outputPath = path.join(__dirname, '..', 'signed', `signed_${Date.now()}_${document.fileName}`);
    await generateSignedPDF(document.filePath, signatures, outputPath);

    document.signedFilePath = outputPath;
    document.status = 'signed';
    await document.save();

    await createAuditLog({
      documentId: document._id,
      action: 'document_finalized',
      performedBy: req.user.name,
      performedByUser: req.user._id,
      req
    });

    res.json({ message: 'Document finalized with signatures', document });
  } catch (error) {
    console.error('Finalize error:', error);
    res.status(500).json({ message: 'Error finalizing document' });
  }
};

// @desc    Delete a signature field
// @route   DELETE /api/signatures/:id
const deleteSignature = async (req, res) => {
  try {
    const signature = await Signature.findById(req.params.id).populate('document');
    if (!signature) {
      return res.status(404).json({ message: 'Signature not found' });
    }

    // Verify document ownership
    if (signature.document.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (signature.status === 'signed') {
      return res.status(400).json({ message: 'Cannot delete a completed signature' });
    }

    await Signature.findByIdAndDelete(req.params.id);
    res.json({ message: 'Signature field removed' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting signature' });
  }
};

module.exports = {
  createSignature,
  getSignatures,
  shareDocument,
  getPublicDocument,
  publicSign,
  finalizeDocument,
  deleteSignature
};

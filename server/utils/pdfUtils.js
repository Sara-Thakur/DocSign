const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

/**
 * Embed signatures into a PDF and save the signed version
 */
const generateSignedPDF = async (originalPdfPath, signatures, outputPath) => {
  // Read the original PDF
  const pdfBytes = fs.readFileSync(originalPdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const sig of signatures) {
    if (sig.status !== 'signed' || !sig.signatureData) continue;

    const pageIndex = (sig.page || 1) - 1;
    if (pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Convert percentage coordinates to absolute
    const x = (sig.x / 100) * pageWidth;
    const y = pageHeight - ((sig.y / 100) * pageHeight); // PDF y is from bottom
    const sigWidth = (sig.width / 100) * pageWidth;
    const sigHeight = (sig.height / 100) * pageHeight;

    try {
      // Embed signature image
      if (sig.signatureData.startsWith('data:image/png')) {
        const base64Data = sig.signatureData.replace(/^data:image\/png;base64,/, '');
        const sigImageBytes = Buffer.from(base64Data, 'base64');
        const sigImage = await pdfDoc.embedPng(sigImageBytes);
        
        page.drawImage(sigImage, {
          x: x,
          y: y - sigHeight,
          width: sigWidth,
          height: sigHeight
        });
      }
    } catch (imgError) {
      // Fallback: draw text signature
      console.log('Image embed failed, using text fallback:', imgError.message);
      page.drawText(sig.signerName, {
        x: x,
        y: y - sigHeight + 5,
        size: 14,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.4)
      });
    }

    // Add signature metadata below the signature
    const metaY = y - sigHeight - 12;
    page.drawText(`Signed by: ${sig.signerName} (${sig.signerEmail})`, {
      x: x,
      y: metaY,
      size: 7,
      font: helveticaFont,
      color: rgb(0.4, 0.4, 0.4)
    });
    
    const dateStr = sig.signedAt ? new Date(sig.signedAt).toLocaleString() : new Date().toLocaleString();
    page.drawText(`Date: ${dateStr} | IP: ${sig.ipAddress || 'N/A'}`, {
      x: x,
      y: metaY - 10,
      size: 7,
      font: helveticaFont,
      color: rgb(0.4, 0.4, 0.4)
    });
  }

  // Save signed PDF
  const signedPdfBytes = await pdfDoc.save();
  
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, signedPdfBytes);
  return outputPath;
};

/**
 * Get page count of a PDF
 */
const getPdfPageCount = async (pdfPath) => {
  try {
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    return pdfDoc.getPageCount();
  } catch (error) {
    return 1;
  }
};

module.exports = { generateSignedPDF, getPdfPageCount };

const nodemailer = require('nodemailer');

const createTransporter = () => {
  const port = parseInt(process.env.EMAIL_PORT) || 587;
  
  const config = {
    host: process.env.EMAIL_HOST,
    port: port,
    secure: port === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000 // 10 seconds
  };

  if (process.env.EMAIL_HOST && process.env.EMAIL_HOST.includes('gmail')) {
    delete config.host;
    delete config.port;
    delete config.secure;
    config.service = 'gmail';
  }

  return nodemailer.createTransport(config);
};

// Generic email sender that supports Resend API (HTTP) as a foolproof fallback
const sendEmail = async ({ to, subject, html }) => {
  // If RESEND_API_KEY is provided, send via HTTP API to completely bypass SMTP blocks
  if (process.env.RESEND_API_KEY) {
    console.log('📬 Sending email via Resend HTTP API...');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
        to: [to],
        subject,
        html
      })
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Resend API error');
    }
    console.log('📧 Email sent via Resend:', data.id);
    return { messageId: data.id };
  }

  // Fallback to Nodemailer SMTP
  console.log('📬 Sending email via SMTP...');
  const transporter = createTransporter();
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    html
  };
  const info = await transporter.sendMail(mailOptions);
  console.log('📧 Email sent via SMTP:', info.messageId);
  return info;
};

/**
 * Send signing invitation email
 */
const sendSigningEmail = async ({ to, signerName, documentTitle, signLink, senderName }) => {
  const subject = `📝 ${senderName} has requested your signature on "${documentTitle}"`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; padding:0; background-color:#f0f2f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <div style="max-width:600px; margin:0 auto; padding:40px 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius:16px 16px 0 0; padding:32px; text-align:center;">
          <h1 style="color:#fff; margin:0; font-size:28px; font-weight:700;">📝 DocSign</h1>
          <p style="color:rgba(255,255,255,0.85); margin:8px 0 0; font-size:14px;">Secure Document Signing</p>
        </div>
        <div style="background:#fff; padding:32px; border-radius:0 0 16px 16px; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <h2 style="color:#1a1a2e; margin:0 0 16px; font-size:20px;">Hello ${signerName},</h2>
          <p style="color:#4a4a68; line-height:1.6; margin:0 0 16px;">
            <strong>${senderName}</strong> has requested your signature on the document:
          </p>
          <div style="background:#f8f9ff; border-left:4px solid #667eea; padding:16px; border-radius:0 8px 8px 0; margin:0 0 24px;">
            <p style="color:#1a1a2e; font-weight:600; margin:0; font-size:16px;">📄 ${documentTitle}</p>
          </div>
          <p style="color:#4a4a68; line-height:1.6; margin:0 0 24px;">
            Click the button below to review and sign the document. This link is unique to you and will provide secure access.
          </p>
          <div style="text-align:center; margin:0 0 24px;">
            <a href="${signLink}" style="display:inline-block; background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:#fff; text-decoration:none; padding:14px 40px; border-radius:8px; font-weight:600; font-size:16px; box-shadow:0 4px 16px rgba(102,126,234,0.4);">
              Review & Sign Document
            </a>
          </div>
          <p style="color:#8a8aa0; font-size:13px; line-height:1.5; margin:0;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${signLink}" style="color:#667eea; word-break:break-all;">${signLink}</a>
          </p>
        </div>
        <div style="text-align:center; padding:24px 0 0;">
          <p style="color:#8a8aa0; font-size:12px; margin:0;">
            This email was sent by DocSign. If you didn't expect this, you can safely ignore it.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({ to, subject, html });
};

/**
 * Send signature completion notification
 */
const sendCompletionEmail = async ({ to, documentTitle, signerName, status }) => {
  const statusColor = status === 'signed' ? '#10b981' : '#ef4444';
  const statusText = status === 'signed' ? '✅ Signed' : '❌ Rejected';
  const statusIcon = status === 'signed' ? '🎉' : '⚠️';

  const subject = `${statusIcon} "${documentTitle}" has been ${status} by ${signerName}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0; padding:0; background-color:#f0f2f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <div style="max-width:600px; margin:0 auto; padding:40px 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius:16px 16px 0 0; padding:32px; text-align:center;">
          <h1 style="color:#fff; margin:0; font-size:28px; font-weight:700;">📝 DocSign</h1>
        </div>
        <div style="background:#fff; padding:32px; border-radius:0 0 16px 16px; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <h2 style="color:#1a1a2e; margin:0 0 16px;">Document ${status === 'signed' ? 'Signed' : 'Rejected'}</h2>
          <p style="color:#4a4a68; line-height:1.6;">
            <strong>${signerName}</strong> has <span style="color:${statusColor}; font-weight:600;">${statusText}</span> your document:
          </p>
          <div style="background:#f8f9ff; border-left:4px solid ${statusColor}; padding:16px; border-radius:0 8px 8px 0; margin:16px 0;">
            <p style="color:#1a1a2e; font-weight:600; margin:0;">📄 ${documentTitle}</p>
          </div>
          <p style="color:#4a4a68; line-height:1.6;">
            ${status === 'signed'
              ? 'You can now download the signed PDF from your dashboard.'
              : 'Please check your dashboard for more details.'
            }
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({ to, subject, html });
};

module.exports = { sendSigningEmail, sendCompletionEmail };

const nodemailer = require('nodemailer');

/**
 * Creates an email transporter.
 * Uses environment variables (EMAIL_USER/EMAIL_PASS or GMAIL_USER/GMAIL_APP_PASS or SMTP_HOST)
 * if configured; otherwise creates an Ethereal test account or logs to console.
 */
async function getTransporter() {
  const user = process.env.EMAIL_USER || process.env.GMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.GMAIL_APP_PASS || process.env.SMTP_PASS;

  if (user && pass) {
    if (process.env.SMTP_HOST) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user, pass },
      });
    }

    // Gmail service preset
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }

  // Fallback: Try Ethereal test account for dev
  try {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  } catch {
    return null;
  }
}

/**
 * Sends a password reset email containing the 6-digit code.
 */
async function sendPasswordResetEmail(toEmail, resetCode) {
  const senderEmail = process.env.EMAIL_USER || process.env.GMAIL_USER || process.env.SMTP_USER || 'no-reply@homeodesk.in';

  const mailOptions = {
    from: `"HomeoDesk Clinic" <${senderEmail}>`,
    to: toEmail,
    subject: 'Your HomeoDesk Password Reset Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #f9fbf9;">
        <h2 style="color: #1B4332; text-align: center; font-family: Georgia, serif;">HomeoDesk Password Reset</h2>
        <p style="color: #333; font-size: 15px;">Hello,</p>
        <p style="color: #444; font-size: 14px; line-height: 1.6;">You requested to reset your password for your HomeoDesk account. Use the following 6-digit verification code to complete your password reset:</p>
        <div style="text-align: center; margin: 28px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1B4332; background: #e8f5e9; padding: 14px 28px; border-radius: 10px; display: inline-block; border: 1px solid #c8e6c9;">${resetCode}</span>
        </div>
        <p style="color: #666; font-size: 13px; line-height: 1.5;">This code is valid for 1 hour. If you did not request a password reset, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #888; font-size: 12px; text-align: center;">Dr. Isha's Homeopathic Clinic · HomeoDesk Authentication System</p>
      </div>
    `,
  };

  const user = process.env.EMAIL_USER || process.env.GMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.GMAIL_APP_PASS || process.env.SMTP_PASS;

  if (!user || !pass) {
    console.log(`\n======================================================`);
    console.log(`🔑 [PASSWORD RESET CODE SENT TO ${toEmail}]: ${resetCode}`);
    console.log(`⚠️  NOTE: No real SMTP credentials (EMAIL_USER/EMAIL_PASS) set in server/.env`);
    console.log(`======================================================\n`);
  }

  try {
    const transporter = await getTransporter();
    if (transporter) {
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Password reset email successfully dispatched to ${toEmail} (Message ID: ${info.messageId})`);
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`🔗 Test Mail Preview URL: ${previewUrl}`);
      }
      return { success: true, messageId: info.messageId, previewUrl };
    }
  } catch (err) {
    console.error(`❌ Failed to deliver email to ${toEmail}:`, err.message);
  }

  return { success: true };
}

module.exports = { sendPasswordResetEmail };

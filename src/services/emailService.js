const logger = require('../utils/logger');

/**
 * ResCrafted 2.0 Email Service (Mock / Disconnected Mode)
 * Mailer is disconnected so registration and logins proceed directly without external SMTP dependency.
 */
class EmailService {
  constructor() {
    this.hasCredentials = false;
    this.transporter = null;
  }

  async sendEmail({ to, subject, html, text }) {
    logger.info(`[MAILER DISABLED] Email skipped to ${to} | Subject: ${subject}`);
    return { success: true, disabled: true, to, subject };
  }

  async sendOtpEmail(to, otp) {
    logger.info(`[MAILER DISABLED - OTP PREVIEW] To: ${to} | OTP: ${otp}`);
    return { success: true, disabled: true, to, otp };
  }

  async sendPasswordResetEmail(to, resetUrl) {
    logger.info(`[MAILER DISABLED - RESET PREVIEW] To: ${to} | Reset Link: ${resetUrl}`);
    return { success: true, disabled: true, to, resetUrl };
  }

  async sendOrderConfirmationEmail(to, order) {
    logger.info(
      `[MAILER DISABLED - ORDER CONFIRMATION] To: ${to} | Order: ${order.orderNumber}`
    );
    return { success: true, disabled: true, to, orderNumber: order.orderNumber };
  }
}

module.exports = new EmailService();

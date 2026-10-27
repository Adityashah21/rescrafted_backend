const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const env = require('../config/env');

class EmailService {
  constructor() {
    this.hasCredentials = Boolean(env.EMAIL_USER && env.EMAIL_PASS);

    if (this.hasCredentials) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: env.EMAIL_USER,
          pass: env.EMAIL_PASS,
        },
      });
    }
  }

  async sendEmail({ to, subject, html, text }) {
    // In development or when credentials are not supplied, provide safe console preview
    if (!this.hasCredentials || env.NODE_ENV === 'test') {
      logger.info(
        `[DEV EMAIL PREVIEW] To: ${to} | Subject: ${subject}\nContent: ${text || html}`
      );
      return { preview: true, to, subject };
    }

    try {
      const mailOptions = {
        from: `"ResCrafted 2.0" <${env.EMAIL_USER}>`,
        to,
        subject,
        text,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error(`Failed to send email to ${to}: ${error.message}`);
      // Do not throw in non-production environments to avoid blocking workflows
      if (env.NODE_ENV === 'production') {
        throw error;
      }
      return { error: error.message };
    }
  }

  async sendOtpEmail(to, otp) {
    const subject = 'Your ResCrafted Verification Code';
    const text = `Your verification code for ResCrafted is: ${otp}. It will expire in 10 minutes.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #E7DFD4; border-radius: 12px; background-color: #FBFBF7;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #1E3A2B; margin-bottom: 4px;">ResCrafted</h2>
          <p style="color: #4D7C5F; font-size: 13px; margin: 0;">Give Waste a Second Life</p>
        </div>
        <p style="color: #212529; font-size: 15px;">Welcome to the circular marketplace! Please use the 6-digit verification code below to verify your email address:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1E3A2B; background: #E7DFD4; padding: 12px 24px; border-radius: 8px;">
            ${otp}
          </span>
        </div>
        <p style="color: #6C757D; font-size: 12px; text-align: center;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
      </div>
    `;

    return this.sendEmail({ to, subject, html, text });
  }

  async sendPasswordResetEmail(to, resetUrl) {
    const subject = 'Reset Your ResCrafted Password';
    const text = `You requested a password reset for your ResCrafted account. Click the link to reset your password: ${resetUrl}. This link is valid for 1 hour.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #E7DFD4; border-radius: 12px; background-color: #FBFBF7;">
        <h2 style="color: #1E3A2B; text-align: center;">ResCrafted</h2>
        <p style="color: #212529;">You requested a password reset. Click the button below to choose a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #1E3A2B; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #6C757D; font-size: 12px;">This link expires in 1 hour. If you didn't request this reset, your account remains secure and no action is required.</p>
      </div>
    `;

    return this.sendEmail({ to, subject, html, text });
  }

  async sendOrderConfirmationEmail(to, order) {
    const formattedTotal = `₹${(order.pricing.totalPaise / 100).toFixed(2)}`;
    const subject = `Order Confirmed: ${order.orderNumber} - ResCrafted`;
    const text = `Thank you for your sustainable purchase! Your order ${order.orderNumber} for ${formattedTotal} has been confirmed. Give waste a second life!`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E7DFD4; border-radius: 12px; background-color: #FBFBF7;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #1E3A2B; margin-bottom: 4px;">ResCrafted</h2>
          <p style="color: #4D7C5F; font-size: 13px; margin: 0;">Give Waste a Second Life</p>
        </div>
        <h3 style="color: #1E3A2B; margin-top: 0;">Order Confirmed! 🌿</h3>
        <p style="color: #212529; font-size: 14px;">Thank you for supporting ethical artisans and circular economy craftsmanship. Your order has been placed successfully.</p>
        <div style="background-color: #ffffff; border: 1px solid #E7DFD4; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0; font-size: 13px; color: #6C757D;">Order Number: <strong style="color: #212529;">${order.orderNumber}</strong></p>
          <p style="margin: 4px 0; font-size: 13px; color: #6C757D;">Order Status: <strong style="color: #1E3A2B; text-transform: uppercase;">${order.orderStatus}</strong></p>
          <p style="margin: 4px 0; font-size: 13px; color: #6C757D;">Total Amount: <strong style="color: #1E3A2B;">${formattedTotal}</strong></p>
          <p style="margin: 4px 0; font-size: 13px; color: #6C757D;">Delivery To: <span style="color: #212529;">${order.shippingAddressSnapshot.fullName}, ${order.shippingAddressSnapshot.city}, ${order.shippingAddressSnapshot.state}</span></p>
        </div>
        <p style="color: #6C757D; font-size: 12px;">You can view live shipment tracking and order updates anytime in your ResCrafted customer dashboard.</p>
      </div>
    `;

    return this.sendEmail({ to, subject, html, text });
  }
}

const emailService = new EmailService();

module.exports = emailService;

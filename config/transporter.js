import { sendEmail } from "./brevo.service.js";
import dotenv from "dotenv";

dotenv.config();

// Drop-in replacement for nodemailer using Brevo
export const transporter = {
  async sendMail(mailOptions, callback) {
    try {
      const toEmail =
        typeof mailOptions.to === "string"
          ? mailOptions.to
          : mailOptions.to?.email || mailOptions.to;

      const result = await sendEmail(
        toEmail,
        mailOptions.subject,
        mailOptions.html,
        mailOptions.text,
        mailOptions.attachments || []
      );

      const response = {
        messageId: result.messageId,
        response: `Email sent via Brevo: ${result.messageId}`,
        accepted: [toEmail],
        rejected: [],
        envelope: {
          from: process.env.SENDER_EMAIL || "support@hrsystem.com",
          to: [toEmail],
        },
      };

      if (callback) {
        callback(null, response);
      }
      return response;
    } catch (error) {
      console.error("❌ Transporter sendMail error:", error);
      if (callback) {
        callback(error, null);
        return;
      }
      throw error;
    }
  },

  verify(callback) {
    if (!process.env.BREVO_API_KEY) {
      const error = new Error("BREVO_API_KEY is not configured");
      console.error("❌ Email transporter verification failed:", error.message);
      if (callback) callback(error, null);
      return Promise.reject(error);
    }

    const success = { message: "Brevo API ready" };
    console.log("✅ Email server is ready to send messages (via Brevo)");
    if (callback) callback(null, success);
    return Promise.resolve(success);
  },
};

transporter.verify();

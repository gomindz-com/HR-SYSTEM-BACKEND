import { transporter } from "../config/transporter.js";

// Email verification function
export const sendVerificationEmail = async (to, token, name) => {
  const baseUrl =
    process.env.NODE_ENV === "development"
      ? "http://localhost:8080"
      : process.env.CLIENT_URL;

  const verificationUrl = `${baseUrl}/verify-email/${token}`;

  const htmlContent = `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
      <h2 style="color: #28a745; margin-top: 0;">Welcome to HR System!</h2>
      <p>Hello ${name},</p>
      <p>Thank you for signing up with HR System. To get started, please verify your email address.</p>
      <p>Click the button below to verify your email:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" style="background: #28a745; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
          Verify Email Address
        </a>
      </div>
      <p style="color: #6c757d; font-size: 14px;">If you did not create this account, please ignore this email. This link will expire in 24 hours.</p>
      <p style="color: #6c757d; font-size: 14px;">Or copy and paste this link in your browser:<br/>
        <a href="${verificationUrl}" style="color: #007bff; word-break: break-all;">${verificationUrl}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
      <p style="color: #6c757d; font-size: 12px; margin-bottom: 0;">Thank you,<br/>The HR System Team</p>
    </div>
  </div>
`;

  const mailOptions = {
    from: `"HR System" <${process.env.GMAIL_USER}>`,
    to: to,
    subject: "Verify Your Email - HR System",
    html: htmlContent,
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending verification email:", {
          to: to,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
        reject(error);
      } else {
        console.log("Verification email sent successfully:", {
          to: to,
          messageId: info.messageId,
          response: info.response,
          timestamp: new Date().toISOString(),
        });
        resolve(info);
      }
    });
  });
};

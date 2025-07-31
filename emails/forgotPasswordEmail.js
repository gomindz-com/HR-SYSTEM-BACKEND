import { transporter } from "../config/transporter.js";

// Email sending function
export const forgotPasswordEmail = async (to, url) => {
  const htmlContent = `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff;">
      <h2 style="color: #007bff; margin-top: 0;">Password Reset Request</h2>
      <p>Hello,</p>
      <p>We received a request to reset your password for your HR System account.</p>
      <p>Please click the button below to reset your password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${url}" style="background: #007bff; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
          Reset Password
        </a>
      </div>
      <p style="color: #6c757d; font-size: 14px;">If you did not request this password reset, please ignore this email. This link will expire in 1 hour.</p>
      <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
      <p style="color: #6c757d; font-size: 12px; margin-bottom: 0;">Thank you,<br/>The HR System Team</p>
    </div>
  </div>
`;

  const mailOptions = {
    from: `"HR System" <${process.env.GMAIL_USER}>`,
    to,
    subject: "🔐 Password Reset Request | HR System",
    html: htmlContent,
    headers: {
      "X-Priority": "1",
      "X-MSMail-Priority": "High",
      Importance: "high",
    },
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
    } else {
      console.log("Reset email sent: " + info.response);
    }
  });
};

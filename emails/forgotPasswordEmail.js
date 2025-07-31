import { transporter } from "../config/transporter.js";

// Email sending function
export const forgotPasswordEmail = async (to, url) => {
  const htmlContent = `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff;">
      <h2 style="color: #007bff; margin-top: 0;">Account Access Update</h2>
      <p>Hello,</p>
      <p>We received a request to update your account access for the HR System.</p>
      <p>Please click the button below to complete this process:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${url}" style="background: #007bff; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
          Update Account Access
        </a>
      </div>
      <p style="color: #6c757d; font-size: 14px;">If you did not request this update, please ignore this email. This link will expire in 1 hour.</p>
      <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
      <p style="color: #6c757d; font-size: 12px; margin-bottom: 0;">Thank you,<br/>The HR System Team</p>
    </div>
  </div>
`;

  const mailOptions = {
    from: `"HR System" <${process.env.GMAIL_USER}>`,
    to: to,
    subject: "Your HR System Account - Action Required",
    html: htmlContent,
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        reject(error);
      } else {
        console.log("Reset email sent successfully:", info.response);
        resolve(info);
      }
    });
  });
};

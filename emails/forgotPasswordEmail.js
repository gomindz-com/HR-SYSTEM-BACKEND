import { transporter } from "../config/transporter.js";

// Email sending function
export const forgotPasswordEmail = async (to, url) => {
  const htmlContent = `
  <div style="font-family: Arial, sans-serif; color: #333;">
    <h2>Password Reset Request</h2>
    <p>Hello,</p>
    <p>We received a request to reset your password for your Demz Property Management account.</p>
    <p>
      <a href="${url}" style="background: #007bff; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
        Reset Password
      </a>
    </p>
    <p>If you did not request this, please ignore this email.</p>
    <p>Thank you,<br/>The Demz Property Management Team</p>
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

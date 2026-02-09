import { transporter } from "../config/transporter.js";
import { renderEmailLayout } from "./emailLayout.js";

export const forgotPasswordEmail = async (to, url) => {
  const htmlContent = renderEmailLayout({
    preheaderText: "Account access update",
    mainHeading: "Account access update",
    bodyParagraphs: [
      "We received a request to update your account access for the HR System.",
      "Please click the button below to complete this process.",
      "If you did not request this update, please ignore this email. This link will expire in 1 hour.",
      "Thank you, The HR System Team",
    ],
    cta: { text: "Update Account Access", href: url },
  });

  const fromEmail =
    process.env.RESEND_FROM_EMAIL || "support@gomindz.gm";
  const fromName =
    (process.env.RESEND_FROM_NAME &&
      process.env.RESEND_FROM_NAME.trim()) ||
    "GOMINDZ HR SYSTEM";

  const mailOptions = {
    from: `${fromName} <${fromEmail}>`,
    to: to,
    subject: "Your HR System Account - Action Required",
    html: htmlContent,
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending password reset email:", {
          to: to,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
        reject(error);
      } else {
        console.log("Password reset email sent successfully:", {
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

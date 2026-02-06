import { transporter } from "../config/transporter.js";
import { renderEmailLayout } from "./emailLayout.js";

export const sendVerificationEmail = async (to, token, name) => {
  const baseUrl =
    process.env.NODE_ENV === "development"
      ? "http://localhost:8080"
      : process.env.CLIENT_URL;

  const verificationUrl = `${baseUrl}/verify-email/${token}`;

  const htmlContent = renderEmailLayout({
    preheaderText: "Verify your email",
    mainHeading: "Welcome to HR System!",
    bodyParagraphs: [
      `Hello ${name},`,
      "Thank you for signing up with HR System. To get started, please verify your email address.",
      "Click the button below to verify your email:",
      "If you did not create this account, please ignore this email. This link will expire in 24 hours.",
      `Or copy and paste this link in your browser: <a href="${verificationUrl}" style="color: rgb(255,90,95); word-break: break-all;">${verificationUrl}</a>`,
      "Thank you, The HR System Team",
    ],
    cta: { text: "Verify Email Address", href: verificationUrl },
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

import { Resend } from "resend";
import dotenv from "dotenv";

// Ensure .env is loaded before we read RESEND_* variables
dotenv.config();

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  console.warn(
    "⚠️ RESEND_API_KEY is not set. Email sending via Resend will fail until it is configured."
  );
}

const resend = new Resend(resendApiKey);

export async function sendEmail(to, subject, html, text, attachments = []) {
  try {
    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@gomindz.gm";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const payload = {
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html,
      ...(text && { text }),
      ...(attachments.length > 0 && {
        attachments: attachments.map((att) => ({
          filename: att.filename,
          content: att.content,
          path: att.path,
        })),
      }),
    };

    const { data, error } = await resend.emails.send(payload);

    if (error) {
      console.error("❌ Error sending email via Resend:", error);
      throw new Error(error.message || "Failed to send email via Resend");
    }

    const messageId = data?.id || data?.messageId || "unknown";

    return { success: true, messageId };
  } catch (error) {
    console.error("❌ Error sending email via Resend:", error.message || error);
    throw error;
  }
}


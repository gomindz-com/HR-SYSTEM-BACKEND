import brevo from "@getbrevo/brevo";

export async function sendEmail(to, subject, html, text) {
  try {
    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      brevo.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY
    );
    const sendSmtpEmail = {
      sender: {
        email: process.env.SENDER_EMAIL || "support@hrsystem.com",
        name: process.env.SENDER_NAME || "HR System",
      },
      to: [
        {
          email: to,
        },
      ],

      subject: subject,
      htmlContent: html,
      ...(text && { textContent: text }),
    };

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);

    // Handle different possible response structures from Brevo API
    const messageId =
      result.messageId ||
      result.body?.messageId ||
      result.body?.id ||
      "unknown";
    console.log("✅ Email sent successfully via Brevo:", messageId);

    return { success: true, messageId };
  } catch (error) {
    console.error("❌ Error sending email via Brevo:", error.message);
    // Throw error so it can be caught by calling code's try/catch blocks
    throw error;
  }
}

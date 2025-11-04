import dotenv from "dotenv";
import { transporter } from "../config/transporter.js";

dotenv.config();

// Get test email from command line argument or use default
const testEmail =
  process.argv[2] || process.env.TEST_EMAIL || "test@example.com";
const senderEmail = process.env.SENDER_EMAIL || "support@hrsystem.com";

console.log("🧪 Testing Brevo Email Integration...\n");
console.log("📋 Configuration:");
console.log(`   Sender: ${senderEmail}`);
console.log(`   Recipient: ${testEmail}`);
console.log(
  `   Brevo API Key: ${process.env.BREVO_API_KEY ? "✅ Set" : "❌ Missing"}\n`
);

const mailOptions = {
  from: `"HR System" <${process.env.SENDER_EMAIL || "support@hrsystem.com"}>`,
  to: testEmail,
  subject: "Test Email - Brevo Integration",
  html: `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
        <h2 style="color: #28a745; margin-top: 0;">✅ Brevo Email Test</h2>
        <p>Hello!</p>
        <p>This is a test email to verify that your Brevo integration is working correctly.</p>
        <p>If you received this email, the migration from nodemailer to Brevo was successful! 🎉</p>
        <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
        <p style="color: #6c757d; font-size: 12px; margin-bottom: 0;">
          Sent at: ${new Date().toLocaleString()}<br/>
          Email service: Brevo
        </p>
      </div>
    </div>
  `,
  text: "This is a test email to verify Brevo integration. If you received this, everything is working!",
};

try {
  const result = await transporter.sendMail(mailOptions);
  console.log("\n✅ Email sent successfully!");
  console.log("📨 Message ID:", result.messageId);
  console.log("📬 Response:", result.response);
  console.log("\n📝 Important Notes:");
  console.log(
    "   1. Check your spam/junk folder - emails may be filtered there"
  );
  console.log("   2. Wait 1-2 minutes - delivery can take a moment");
  console.log("   3. Verify sender email in Brevo:");
  console.log(`      - Login to https://app.brevo.com`);
  console.log(`      - Go to Settings → Senders & IP`);
  console.log(`      - Make sure ${senderEmail} is verified`);
  console.log("\n💡 If email still not received:");
  console.log("   - Check Brevo dashboard for delivery status");
  console.log("   - Verify sender email domain is authenticated in Brevo");
  console.log("   - Try sending to a different email address");
  process.exit(0);
} catch (error) {
  console.error("\n❌ Failed to send email:");
  console.error("Error:", error.message);

  if (error.response) {
    console.error("\n📋 Brevo API Response:");
    console.error(
      JSON.stringify(error.response.body || error.response, null, 2)
    );
  }

  if (error.body) {
    console.error("\n📋 Error Details:", error.body);
  }

  console.error("\n💡 Troubleshooting:");
  console.error("   1. Verify BREVO_API_KEY is correct in .env");
  console.error("   2. Verify SENDER_EMAIL is set and verified in Brevo");
  console.error("   3. Check Brevo account status (not suspended)");
  console.error("   4. Verify sender email domain is authenticated");
  process.exit(1);
}

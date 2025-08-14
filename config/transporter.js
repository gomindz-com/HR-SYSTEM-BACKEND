import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASSWORD,
  },
  pool: true, // Use connection pooling for better performance
  maxConnections: 5, // Limit concurrent connections
  maxMessages: 100, // Limit messages per connection
  rateDelta: 1000, // 1 second rate limiting window
  rateLimit: 5, // Max 5 emails per second
});

// Verify connection configuration on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email transporter verification failed:", error);
  } else {
    console.log("✅ Email server is ready to send messages");
  }
});

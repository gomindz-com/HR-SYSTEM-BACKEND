import express from "express";
import crypto from "crypto";
import { handlePaymentWebhook } from "../services/paymentService.js";

const router = express.Router();

router.post("/modempay", async (req, res) => {
  try {
    const payload = JSON.stringify(req.body);
    const signature = req.headers["x-modem-signature"];

    // Ensure the signature is provided
    if (!signature) {
      console.error("❌ Webhook signature missing");
      return res.status(400).json({
        success: false,
        message: "Signature missing",
      });
    }

    const secretHash = process.env.MODEM_PAY_WEBHOOK_SECRET;

    // Generate the HMAC-SHA512 hash for signature comparison
    const computedSignature = crypto
      .createHmac("sha512", secretHash)
      .update(payload)
      .digest("hex");

    // Ensure the signature length matches to avoid timing attacks
    if (computedSignature.length !== signature.length) {
      console.error("❌ Invalid signature length");
      return res.status(400).json({
        success: false,
        message: "Invalid signature length",
      });
    }

    // Use timing-safe comparison to protect against timing attacks
    if (
      !crypto.timingSafeEqual(
        Buffer.from(computedSignature),
        Buffer.from(signature)
      )
    ) {
      console.error("❌ Invalid signature!");
      return res.status(400).json({
        success: false,
        message: "Invalid signature!",
      });
    }

    console.log(
      "Received Modem Pay webhook:",
      JSON.stringify(req.body, null, 2)
    );

    await handlePaymentWebhook(req.body);

    res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error("Webhook handling failed:", error);
    res.status(500).json({
      success: false,
      error: "Webhook processing failed",
    });
  }
});

// Health check for webhook endpoint
router.get("/modempay/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Webhook endpoint is healthy",
    timestamp: new Date().toISOString(),
  });
});

export default router;

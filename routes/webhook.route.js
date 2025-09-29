import express from "express";
import { handlePaymentWebhook } from "../services/paymentService.js";

const router = express.Router();

// Modem Pay webhook endpoint
router.post("/modempay", async (req, res) => {
  try {
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

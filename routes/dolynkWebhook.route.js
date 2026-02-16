import express from "express";
import { verifyDolynkSignature } from "../middleware/dolynkSignature.middleware.js";
import { dolynkWebhookController } from "../controller/dolynkWebhook.controller.js";

const router = express.Router();

router.post("/", verifyDolynkSignature, dolynkWebhookController);

export default router;

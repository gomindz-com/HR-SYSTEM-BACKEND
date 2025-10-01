import express from "express";
import {
  acceptInvitation,
  sendInvitation,
  sendBulkInvitations,
} from "../controller/invitation.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";

const router = express.Router();

// Invitation routes require: authentication + active subscription (all plans)
router.post("/send-invitation", verifyToken, checkSubscription, sendInvitation);
router.post(
  "/send-bulk-invitations",
  verifyToken,
  checkSubscription,
  sendBulkInvitations
);
router.post("/accept-invitation/:token", acceptInvitation); // Public route - no protection

export default router;

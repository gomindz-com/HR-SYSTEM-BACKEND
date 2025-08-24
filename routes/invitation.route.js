import express from "express";
import {
  acceptInvitation,
  sendInvitation,
  sendBulkInvitations,
} from "../controller/invitation.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/send-invitation", verifyToken, sendInvitation);
router.post("/send-bulk-invitations", verifyToken, sendBulkInvitations);
router.post("/accept-invitation/:token", acceptInvitation);

export default router;

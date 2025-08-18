import express from "express";
import {
  acceptInvitation,
  sendInvitation,
} from "../controller/invitation.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/send-invitation", verifyToken, sendInvitation);
router.post("/accept-invitation/:token", acceptInvitation);

export default router;

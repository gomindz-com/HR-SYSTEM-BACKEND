import express from "express";
import { acceptInvitation, sendInvitation } from "../controller/invitation.controller.js";

const router = express.Router();

router.post("/send-invitation", sendInvitation);
router.post("/accept-invitation/:token", acceptInvitation);

export default router;

import express from "express";

import {
  checkIn,
  checkOut,
  generateQrToken,
} from "../controller/attendance.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(verifyToken);

router.post("/check-in", checkIn);
router.post("/check-out", checkOut);
router.get("/generate-qr", generateQrToken);
export default router;

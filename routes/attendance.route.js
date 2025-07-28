import express from "express";

import {
  checkIn,
  checkOut,
  getAttendanceStats,
  listAttendance,
} from "../controller/attendance.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(verifyToken);

router.post("/check-in", checkIn);
router.post("/check-out", checkOut);
router.get("/my-attendance", verifyToken, listAttendance);
router.get("/", verifyToken, listAttendance);
router.get("/stats", getAttendanceStats);

export default router;

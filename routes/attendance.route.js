import express from "express";

import {
  checkIn,
  checkOut,
  getAttendanceStats,
  getCompanyAttendanceStats,
  listAttendance,
  listSpecificEmployeeAttendance,
  myAttendance,
} from "../controller/attendance.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(verifyToken);

router.post("/check-in", checkIn);
router.post("/check-out", checkOut);
router.get("/my-attendance", myAttendance);
router.get("/", listAttendance);
router.get("/stats", getAttendanceStats);
router.get("/company-stats", getCompanyAttendanceStats);
router.get("/employee/:employeeId", listSpecificEmployeeAttendance);

export default router;

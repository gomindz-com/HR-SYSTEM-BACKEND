import express from "express";

import {
  checkIn,
  checkOut,
  getAttendanceStats,
  getCompanyAttendanceStats,
  listAttendance,
  listSpecificEmployeeAttendance,
  myAttendance,
  adminAddAttendance,
  adminClockOut,
  viewEmployeeAttendanceStats,
  adminCreateAttendanceRecord,
} from "../controller/attendance.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(verifyToken);

router.post("/check-in", checkIn);
router.post("/check-out", checkOut);
router.get("/my-attendance", myAttendance);
router.get("/", listAttendance);
router.get("/stats", getAttendanceStats);
router.get("/employee-stats/:employeeId", viewEmployeeAttendanceStats);
router.get("/company-stats", getCompanyAttendanceStats);
router.get("/employee/:employeeId", listSpecificEmployeeAttendance);

// Admin routes for manual attendance management
router.post("/admin/add/:employeeId", adminAddAttendance);
router.post("/admin/clock-out/:employeeId", adminClockOut);
router.post("/admin/create-record", adminCreateAttendanceRecord);

export default router;

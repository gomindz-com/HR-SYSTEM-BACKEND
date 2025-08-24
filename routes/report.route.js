import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import {
  employeeReport,
  attendanceReport,
  leaveReport,
  reportStats,
} from "../controller/report.controller.js";
const router = express.Router();
router.use(verifyToken);

router.get("/employee-report", employeeReport);
router.get("/attendance-report", attendanceReport);
router.get("/leave-report", leaveReport);
router.get("/stats", reportStats);

export default router;

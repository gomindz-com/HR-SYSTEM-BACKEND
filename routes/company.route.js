import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import {
  signUpCompany,
  updateAttendanceSettings,
  getAttendanceSettings,
  getAvailableTimezones,
  updateCompanyInfo,
  getCompanyInfo,
} from "../controller/company.controller.js";

const router = express.Router();

// Company signup (public route)
router.post("/signup", signUpCompany);

// Company info routes (protected)
router.get("/info", verifyToken, getCompanyInfo);
router.put("/info", verifyToken, updateCompanyInfo);

// Attendance settings routes (protected)
router.get("/attendance-settings", verifyToken, getAttendanceSettings);
router.put("/attendance-settings", verifyToken, updateAttendanceSettings);
router.get("/timezones", verifyToken, getAvailableTimezones);

export default router;

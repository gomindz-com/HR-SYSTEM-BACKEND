import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import {
  signUpCompany,
  updateAttendanceSettings,
  getAttendanceSettings,
  getAvailableTimezones,
  updateCompanyInfo,
  getCompanyInfo,
  createCompanyLocation,
  getCompanyLocations,
  updateCompanyLocation,
  deleteCompanyLocation,
} from "../controller/company.controller.js";

const router = express.Router();

// Company signup (public route)
router.post("/signup", signUpCompany);

// Timezones (public route - needed for signup)
router.get("/timezones", getAvailableTimezones);

// Company info routes (protected)
router.get("/info", verifyToken, getCompanyInfo);
router.put("/info", verifyToken, updateCompanyInfo);

// Attendance settings routes (protected)
router.get("/attendance-settings", verifyToken, getAttendanceSettings);
router.put("/attendance-settings", verifyToken, updateAttendanceSettings);

router.post("/locations", verifyToken, createCompanyLocation);
router.get("/locations", verifyToken, getCompanyLocations);
router.put("/locations/:id", verifyToken, updateCompanyLocation);
router.delete("/locations/:id", verifyToken, deleteCompanyLocation);
export default router;

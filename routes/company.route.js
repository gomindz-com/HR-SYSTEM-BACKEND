import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";
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

// Company info routes (protected - require active subscription)
router.get("/info", verifyToken, checkSubscription, getCompanyInfo);
router.put("/info", verifyToken, checkSubscription, updateCompanyInfo);

// Attendance settings routes (protected - require active subscription)
router.get(
  "/attendance-settings",
  verifyToken,
  checkSubscription,
  getAttendanceSettings
);
router.put(
  "/attendance-settings",
  verifyToken,
  checkSubscription,
  updateAttendanceSettings
);

// Location routes (protected - require active subscription)
router.post(
  "/locations",
  verifyToken,
  checkSubscription,
  createCompanyLocation
);
router.get("/locations", verifyToken, checkSubscription, getCompanyLocations);
router.put(
  "/locations/:id",
  verifyToken,
  checkSubscription,
  updateCompanyLocation
);
router.delete(
  "/locations/:id",
  verifyToken,
  checkSubscription,
  deleteCompanyLocation
);
export default router;

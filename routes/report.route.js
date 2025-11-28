import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";
import { checkFeatureAccess } from "../middleware/feature.middleware.js";
import {
  employeeReport,
  attendanceReport,
  leaveReport,
  payrollReports,
  reportStats,
  taxAndSSNReport,
} from "../controller/report.controller.js";
const router = express.Router();

// Helper middleware to check if user has basic_reports OR reports feature
const checkBasicReports = (req, res, next) => {
  const subscription = req.subscription;
  const hasBasicReports = subscription.plan.features.includes("basic_reports");
  const hasAdvancedReports = subscription.plan.features.includes("reports");

  if (!hasBasicReports && !hasAdvancedReports) {
    return res.status(403).json({
      success: false,
      error: "Basic reports not available in your plan. Please upgrade.",
      currentPlan: subscription.plan.name,
    });
  }
  next();
};

// All reports require authentication + active subscription
router.use(verifyToken);
router.use(checkSubscription);

// Basic reports (available to plans with 'basic_reports' or 'reports')
router.get("/employee-report", checkBasicReports, employeeReport);
router.get("/attendance-report", checkBasicReports, attendanceReport);

// Advanced reports (require 'reports' feature - Pro+ plans only)
router.get("/leave-report", checkFeatureAccess("reports"), leaveReport);
router.get("/payroll-report", checkFeatureAccess("reports"), payrollReports);
router.get("/tax-ssn-report", checkFeatureAccess("reports"), taxAndSSNReport);
router.get("/stats", checkFeatureAccess("reports"), reportStats);

export default router;

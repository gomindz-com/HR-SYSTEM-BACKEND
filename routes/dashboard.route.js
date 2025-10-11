import express from "express";
import {
  getDashboardMetrics,
  getWeeklyAttendanceOverview,
  getDepartmentDistribution,
  getDashboardActivities,
} from "../controller/dashboard.cntroller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";

const router = express.Router();

// Dashboard requires: authentication + active subscription (all plans have access)
router.use(verifyToken);
router.use(checkSubscription);

// Test endpoint to verify basic connectivity
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Dashboard route is working",
    user: req.user,
  });
});

router.get("/metrics", getDashboardMetrics);
router.get("/weekly-attendance", getWeeklyAttendanceOverview);
router.get("/department-distribution", getDepartmentDistribution);
router.get("/activities", getDashboardActivities);

export default router;

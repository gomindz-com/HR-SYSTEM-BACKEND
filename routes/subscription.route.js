import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import {
  getPlans,
  createSubscription,
  getSubscriptionStatus,
  switchPlan,
  cancelSubscription,
  getPaymentHistory,
} from "../controller/subscription.controller.js";

const router = express.Router();

// Public routes
router.get("/plans", getPlans);

// Protected routes - require authentication
router.use(verifyToken);

router.post("/create", createSubscription);
router.get("/status", getSubscriptionStatus);
router.put("/switch-plan", switchPlan);
router.post("/cancel", cancelSubscription);
router.get("/payments", getPaymentHistory);

export default router;

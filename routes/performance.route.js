import express from "express";
import {
  // Settings
  getPerformanceSettings,
  updatePerformanceSettings,
  // Templates
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  // Cycles
  getCycles,
  getCycleById,
  createCycle,
  activateCycle,
  completeCycle,
  // Reviews
  getMyReviews,
  getReviewsToComplete,
  getReviewById,
  saveResponse,
  submitSelfReview,
  submitManagerReview,
  finalizeReview,
  acknowledgeReview,
} from "../controller/performance.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";
import { requireRole } from "../middleware/rbac.middleware.js";

const router = express.Router();

// All routes require auth + subscription
router.use(verifyToken);
router.use(checkSubscription);

// ============================================
// SETTINGS (Admin only for update)
// ============================================
router.get("/settings", getPerformanceSettings);
router.put("/settings", requireRole(["ADMIN"]), updatePerformanceSettings);

// ============================================
// TEMPLATES (Admin only for CUD)
// ============================================
router.get("/templates", getTemplates);
router.get("/templates/:templateId", getTemplateById);
router.post("/templates", requireRole(["ADMIN"]), createTemplate);
router.put("/templates/:templateId", requireRole(["ADMIN"]), updateTemplate);
router.delete("/templates/:templateId", requireRole(["ADMIN"]), deleteTemplate);

// ============================================
// CYCLES (Admin only for management)
// ============================================
router.get("/cycles", getCycles);
router.get("/cycles/:cycleId", getCycleById);
router.post("/cycles", requireRole(["ADMIN"]), createCycle);
router.post("/cycles/:cycleId/activate", requireRole(["ADMIN"]), activateCycle);
router.post("/cycles/:cycleId/complete", requireRole(["ADMIN"]), completeCycle);

// ============================================
// REVIEWS
// ============================================
router.get("/reviews/mine", getMyReviews); // Employee's own reviews
router.get("/reviews/to-complete", getReviewsToComplete); // Manager's queue
router.get("/reviews/:reviewId", getReviewById); // Single review details

// ============================================
// RESPONSES
// ============================================
router.post("/reviews/:reviewId/responses", saveResponse);
router.post("/reviews/:reviewId/submit-self", submitSelfReview);
router.post("/reviews/:reviewId/submit-manager", submitManagerReview);
router.post(
  "/reviews/:reviewId/finalize",
  requireRole(["ADMIN"]),
  finalizeReview
);
router.post("/reviews/:reviewId/acknowledge", acknowledgeReview);

export default router;

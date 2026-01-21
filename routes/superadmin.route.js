import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/rbac.middleware.js";
import {
  getCompanies,
  getCompanyDetail,
  getCompanyStats,
  grantLifetimeAccess,
  revokeLifetimeAccess,
  getLifetimeCompanies,
  listSubscriptions,
  updateSubscription,
} from "../controller/superadmin.controller.js";

const router = express.Router();

// All superadmin routes require authentication and SUPER_ADMIN role
router.use(verifyToken);
router.use(requireRole("SUPER_ADMIN"));

// Get companies with lifetime access (must come before /companies to avoid route conflicts)
router.get("/companies/lifetime", getLifetimeCompanies);

// Get all companies with pagination
router.get("/companies", getCompanies);

// Get company statistics
router.get("/company-stats", getCompanyStats);

// Lifetime access management (must come before /company/:id to avoid route conflicts)
router.post("/company/:id/lifetime-access/grant", grantLifetimeAccess);
router.post("/company/:id/lifetime-access/revoke", revokeLifetimeAccess);

// Get company detail
router.get("/company/:id", getCompanyDetail);

// Subscription management
router.get("/subscriptions", listSubscriptions);
router.patch("/subscription/:id", updateSubscription);

export default router;

